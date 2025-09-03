import { supabaseDuckCode } from '../config/supabaseClient';
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
}

export interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
}

export class SupabaseUser {
  static async create(userData: { email: string; password: string; fullName?: string; avatarUrl?: string }): Promise<any> {
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseDuckCode.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          full_name: userData.fullName,
          avatar_url: userData.avatarUrl
        }
      });

      if (authError) throw authError;

      // Profile will be automatically created by the trigger
      // Just return the user data
      return {
        id: authData.user.id,
        email: userData.email,
        fullName: userData.fullName,
        avatarUrl: userData.avatarUrl,
        subscriptionTier: 'free',
        totalTokensUsed: 0,
        monthlyTokensUsed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async findByEmail(email: string): Promise<any> {
    const { data, error } = await supabaseDuckCode
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find user: ${error.message}`);
    }

    return data;
  }

  static async findById(id: string): Promise<UserProfile | null> {
    try {
      // Get user from Supabase Auth
      const { data: authData, error: authError } = await supabaseDuckCode.auth.admin.getUserById(id);
      if (authError) throw authError;

      // Get profile data
      const { data: profile, error: profileError } = await supabaseDuckCode
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError) throw profileError;

      return {
        id: profile.id,
        email: authData.user.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        subscription_tier: profile.subscription_tier,
        total_tokens_used: profile.total_tokens_used,
        last_login: profile.last_login,
        last_activity: profile.last_activity,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      };
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  static async verifyPassword(email: string, password: string): Promise<UserProfile | null> {
    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabaseDuckCode.auth.signInWithPassword({
        email,
        password
      });

      if (authError) return null;
      if (!authData.user) return null;

      // Update login timestamps
      await supabaseDuckCode
        .from('user_profiles')
        .update({ 
          last_login: new Date().toISOString(),
          last_activity: new Date().toISOString()
        })
        .eq('id', authData.user.id);

      // Get full profile
      return await this.findById(authData.user.id);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }

  static async updateTokenUsage(userId: string, tokensUsed: number): Promise<void> {
    const { error } = await supabaseDuckCode
      .from('user_profiles')
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
    const { data, error } = await supabaseDuckCode
      .from('user_profiles')
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
