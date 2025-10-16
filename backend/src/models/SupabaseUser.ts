import { supabase } from '../config/supabase';
import { supabaseEnterprise } from '../config/supabase';
import bcrypt from 'bcryptjs';

export interface UserProfile {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  website?: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
  total_tokens_used: number;
  last_login?: string;
  last_activity?: string;
  created_at?: string;
  updated_at?: string;
  organization_id?: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
}

export class SupabaseUser {
  /**
   * Create user for SaaS/Admin Portal (uses standard Supabase Auth)
   */
  static async create(userData: { 
    email: string; 
    password: string; 
    fullName?: string; 
    avatarUrl?: string;
    organizationName?: string;
  }): Promise<any> {
    try {
      console.log('Creating user with standard Supabase Auth:', userData.email);
      
      // Create user in Supabase Auth (public schema)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // Auto-confirm for now (can enable email verification later)
        user_metadata: {
          full_name: userData.fullName,
          avatar_url: userData.avatarUrl
        }
      });

      if (authError) {
        console.error('Supabase auth error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('User creation failed - no user returned');
      }

      console.log('User created successfully:', authData.user.id);

      // Profile will be automatically created by database trigger
      // Auto-create organization for the user
      // Use provided organizationName or fallback to email-based name
      const displayName = userData.organizationName || `${userData.fullName || 'My'} Organization`;
      const orgSlug = (userData.organizationName || userData.email.split('@')[0])
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase();
      
      try {
        const { data: orgData, error: orgError } = await supabaseEnterprise
          .from('organizations')
          .insert({
            name: orgSlug,
            display_name: displayName,
            plan_type: 'trial',
            max_users: 10,
            status: 'trial',
            settings: {},
          })
          .select()
          .single();

        if (orgError) {
          console.error('Organization creation error:', orgError);
        } else if (orgData) {
          console.log('Organization created:', orgData.id);
          
          // Create default roles for the organization
          await supabaseEnterprise.rpc('create_default_roles', { 
            p_organization_id: orgData.id 
          });

          // Assign user as admin
          const { data: adminRole, error: roleError } = await supabaseEnterprise
            .from('organization_roles')
            .select('id')
            .eq('organization_id', orgData.id)
            .eq('name', 'Admin')
            .single();

          if (roleError) {
            console.error('Error fetching admin role:', roleError);
          } else if (adminRole) {
            const { error: assignError } = await supabaseEnterprise
              .from('user_organization_roles')
              .insert({
                organization_id: orgData.id,
                user_id: authData.user.id,
                role_id: adminRole.id,
              });
            
            if (assignError) {
              console.error('Error assigning admin role:', assignError);
            } else {
              console.log('User assigned as admin');
            }
          }
        }
      } catch (orgError) {
        console.error('Error setting up organization:', orgError);
        // Don't fail registration if org creation fails
      }

      return {
        id: authData.user.id,
        email: userData.email,
        fullName: userData.fullName,
        avatarUrl: userData.avatarUrl,
        createdAt: authData.user.created_at,
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by email (checks Supabase Auth)
   */
  static async findByEmail(email: string): Promise<any> {
    try {
      // List all users and find by email
      const { data, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        console.error('Error listing users:', error);
        throw new Error(`Failed to find user: ${error.message}`);
      }

      const user = data.users.find(u => u.email === email);
      
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name,
        avatarUrl: user.user_metadata?.avatar_url,
        createdAt: user.created_at,
      };
    } catch (error: any) {
      console.error('Error finding user by email:', error);
      throw new Error(`Failed to find user: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<UserProfile | null> {
    try {
      // Get user from Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.getUserById(id);
      if (authError) throw authError;

      // Get profile data from public.profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile error:', profileError);
        // Profile might not exist yet, return basic user data
      }

      return {
        id: authData.user.id,
        email: authData.user.email || '',
        full_name: authData.user.user_metadata?.full_name || profile?.full_name,
        avatar_url: authData.user.user_metadata?.avatar_url || profile?.avatar_url,
        subscription_tier: profile?.subscription_tier || 'free',
        total_tokens_used: profile?.total_tokens_used || 0,
        last_login: profile?.last_login,
        last_activity: profile?.last_activity,
        created_at: authData.user.created_at,
        updated_at: profile?.updated_at || authData.user.updated_at,
      };
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  static async verifyPassword(email: string, password: string): Promise<UserProfile | null> {
    try {
      // Sign in with Supabase Auth (standard auth, not admin)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) return null;
      if (!authData.user) return null;

      // Update login timestamps in profiles table
      try {
        await supabase
          .from('profiles')
          .update({ 
            last_login: new Date().toISOString(),
            last_activity: new Date().toISOString()
          })
          .eq('id', authData.user.id);
      } catch (updateError) {
        console.error('Error updating login timestamps:', updateError);
        // Don't fail login if timestamp update fails
      }

      // Get full profile
      return await this.findById(authData.user.id);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }

  static async updateTokenUsage(userId: string, tokensUsed: number): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        total_tokens_used: tokensUsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update token usage: ${error.message}`);
    }
  }

  static async updateSubscriptionTier(userId: string, tier: string): Promise<any> {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        subscription_tier: tier,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to update subscription tier: ${error.message}`);
    }

    return data;
  }
}
