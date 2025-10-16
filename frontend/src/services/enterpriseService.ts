/**
 * Enterprise Service
 * Handles all API calls for enterprise/organization management
 */

import { supabase } from '../config/supabaseClient';
import type {
  Organization,
  OrganizationWithStats,
  Team,
  TeamWithMembers,
  TeamMember,
  TeamMemberWithUser,
  OrganizationRole,
  UserOrganizationRole,
  OrganizationApiKey,
  OrganizationInvitation,
  OrganizationInvitationWithDetails,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  CreateTeamRequest,
  UpdateTeamRequest,
  AddTeamMemberRequest,
  CreateApiKeyRequest,
  CreateRoleRequest,
  UpdateRoleRequest,
  InviteUserRequest,
  AcceptInvitationRequest,
  UserOrganizationsResult,
  UserTeamsResult,
  TeamHierarchyResult,
  OrganizationMembersResult,
} from '../types/enterprise';

// ==================== ORGANIZATIONS ====================

export const organizationService = {
  /**
   * Get all organizations the current user belongs to
   */
  async getUserOrganizations(): Promise<UserOrganizationsResult[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .schema('enterprise')
      .rpc('get_user_organizations', { p_user_id: user.id });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get organization by ID
   */
  async getOrganization(organizationId: string): Promise<Organization> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get organization with statistics
   */
  async getOrganizationWithStats(organizationId: string): Promise<OrganizationWithStats> {
    const { data: org, error: orgError } = await supabase
      .schema('enterprise')
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (orgError) throw orgError;

    // Get member count
    const { count: memberCount } = await supabase
      .schema('enterprise')
      .from('user_organization_roles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    // Get team count
    const { count: teamCount } = await supabase
      .schema('enterprise')
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    // Get API key count
    const { count: apiKeyCount } = await supabase
      .schema('enterprise')
      .from('organization_api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    return {
      ...org,
      member_count: memberCount || 0,
      team_count: teamCount || 0,
      api_key_count: apiKeyCount || 0,
    };
  },

  /**
   * Create a new organization
   */
  async createOrganization(request: CreateOrganizationRequest): Promise<Organization> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organizations')
      .insert(request)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update organization
   */
  async updateOrganization(
    organizationId: string,
    request: UpdateOrganizationRequest
  ): Promise<Organization> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organizations')
      .update(request)
      .eq('id', organizationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Check if current user is organization admin
   */
  async isOrganizationAdmin(organizationId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .schema('enterprise')
      .rpc('is_organization_admin', {
        p_user_id: user.id,
        p_organization_id: organizationId,
      });

    if (error) throw error;
    return data || false;
  },

  /**
   * Get organization members
   */
  async getOrganizationMembers(organizationId: string): Promise<OrganizationMembersResult[]> {
    const { data, error } = await supabase
      .schema('enterprise')
      .rpc('get_organization_members', { p_organization_id: organizationId });

    if (error) throw error;
    return data || [];
  },
};

// ==================== TEAMS ====================

export const teamService = {
  /**
   * Get all teams in an organization
   */
  async getTeams(organizationId: string): Promise<Team[]> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get team by ID with members
   */
  async getTeamWithMembers(teamId: string): Promise<TeamWithMembers> {
    const { data: team, error: teamError } = await supabase
      .schema('enterprise')
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError) throw teamError;

    // Get team members with user details
    const { data: members, error: membersError } = await supabase
      .schema('enterprise')
      .from('team_members')
      .select(`
        *,
        user:user_id (
          email,
          raw_user_meta_data
        )
      `)
      .eq('team_id', teamId);

    if (membersError) throw membersError;

    const membersWithUser: TeamMemberWithUser[] = (members || []).map((m: any) => ({
      ...m,
      user_email: m.user?.email,
      user_name: m.user?.raw_user_meta_data?.name,
    }));

    return {
      ...team,
      member_count: members?.length || 0,
      members: membersWithUser,
    };
  },

  /**
   * Get user's teams
   */
  async getUserTeams(): Promise<UserTeamsResult[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .schema('enterprise')
      .rpc('get_user_teams', { p_user_id: user.id });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get team hierarchy (recursive)
   */
  async getTeamHierarchy(teamId: string): Promise<TeamHierarchyResult[]> {
    const { data, error } = await supabase
      .schema('enterprise')
      .rpc('get_team_hierarchy', { p_team_id: teamId });

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new team
   */
  async createTeam(request: CreateTeamRequest): Promise<Team> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('teams')
      .insert(request)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update team
   */
  async updateTeam(teamId: string, request: UpdateTeamRequest): Promise<Team> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('teams')
      .update(request)
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete team
   */
  async deleteTeam(teamId: string): Promise<void> {
    const { error } = await supabase
      .schema('enterprise')
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
  },

  /**
   * Add member to team
   */
  async addTeamMember(request: AddTeamMemberRequest): Promise<TeamMember> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('team_members')
      .insert(request)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove member from team
   */
  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .schema('enterprise')
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Update team member role
   */
  async updateTeamMemberRole(
    teamId: string,
    userId: string,
    role: 'admin' | 'member' | 'viewer'
  ): Promise<TeamMember> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('team_members')
      .update({ role })
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Check if user is team admin
   */
  async isTeamAdmin(teamId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .schema('enterprise')
      .rpc('is_team_admin', {
        p_user_id: user.id,
        p_team_id: teamId,
      });

    if (error) throw error;
    return data || false;
  },
};

// ==================== ROLES & PERMISSIONS ====================

export const roleService = {
  /**
   * Get all roles in an organization
   */
  async getOrganizationRoles(organizationId: string): Promise<OrganizationRole[]> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organization_roles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new role
   */
  async createRole(request: CreateRoleRequest): Promise<OrganizationRole> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organization_roles')
      .insert(request)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update role
   */
  async updateRole(roleId: string, request: UpdateRoleRequest): Promise<OrganizationRole> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organization_roles')
      .update(request)
      .eq('id', roleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    const { error } = await supabase
      .schema('enterprise')
      .from('organization_roles')
      .delete()
      .eq('id', roleId);

    if (error) throw error;
  },

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: string,
    organizationId: string,
    roleId: string
  ): Promise<UserOrganizationRole> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('user_organization_roles')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        role_id: roleId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, organizationId: string, roleId: string): Promise<void> {
    const { error } = await supabase
      .schema('enterprise')
      .from('user_organization_roles')
      .delete()
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('role_id', roleId);

    if (error) throw error;
  },

  /**
   * Check if user has permission
   */
  async checkPermission(organizationId: string, permission: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .schema('enterprise')
      .rpc('check_permission', {
        p_user_id: user.id,
        p_organization_id: organizationId,
        p_permission: permission,
      });

    if (error) throw error;
    return data || false;
  },
};

// ==================== API KEYS ====================

export const apiKeyService = {
  /**
   * Get all API keys for an organization
   */
  async getApiKeys(organizationId: string): Promise<OrganizationApiKey[]> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organization_api_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new API key (Note: encryption happens server-side)
   */
  async createApiKey(request: CreateApiKeyRequest): Promise<OrganizationApiKey> {
    // This should call a backend API endpoint that handles encryption
    // For now, throwing error - implement backend endpoint first
    throw new Error('API key creation must be done through backend API endpoint for security');
  },

  /**
   * Update API key status
   */
  async updateApiKeyStatus(
    keyId: string,
    status: 'active' | 'inactive' | 'expired' | 'revoked'
  ): Promise<OrganizationApiKey> {
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organization_api_keys')
      .update({ status })
      .eq('id', keyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete API key
   */
  async deleteApiKey(keyId: string): Promise<void> {
    const { error } = await supabase
      .schema('enterprise')
      .from('organization_api_keys')
      .delete()
      .eq('id', keyId);

    if (error) throw error;
  },

  /**
   * Set API key as default
   */
  async setDefaultApiKey(organizationId: string, keyId: string): Promise<void> {
    // First, unset all defaults for this organization and provider
    const { data: key } = await supabase
      .schema('enterprise')
      .from('organization_api_keys')
      .select('provider')
      .eq('id', keyId)
      .single();

    if (key) {
      await supabase
        .schema('enterprise')
        .from('organization_api_keys')
        .update({ is_default: false })
        .eq('organization_id', organizationId)
        .eq('provider', key.provider);

      // Set this key as default
      await supabase
        .schema('enterprise')
        .from('organization_api_keys')
        .update({ is_default: true })
        .eq('id', keyId);
    }
  },
};

// ==================== INVITATIONS ====================

export const invitationService = {
  /**
   * Get all invitations for an organization
   */
  async getInvitations(organizationId: string): Promise<OrganizationInvitationWithDetails[]> {
    // Simplified query without cross-schema joins (auth.users is in different schema)
    // We'll just return the invited_by UUID without the email for now
    const { data, error } = await supabase
      .schema('enterprise')
      .from('organization_invitations')
      .select(`
        *,
        role:role_id (name, display_name),
        team:team_id (name)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((inv: any) => ({
      ...inv,
      invited_by_email: null, // TODO: Fetch from auth.users separately if needed
      role_name: inv.role?.name,
      role_display_name: inv.role?.display_name,
      team_name: inv.team?.name,
    }));
  },

  /**
   * Invite user to organization (handles multiple emails and sends email)
   */
  async inviteUser(request: InviteUserRequest): Promise<OrganizationInvitation> {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');

    // Handle multiple emails
    const emails = Array.isArray(request.emails) ? request.emails : [request.emails];

    // Call backend API which handles both DB insert and email sending
    const response = await fetch('http://localhost:3001/api/invitations/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        organization_id: request.organization_id,
        emails: emails,
        role_id: request.role_id,
        team_id: request.team_id,
        message: request.message,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send invitations');
    }

    const result = await response.json();
    
    // Return first invitation (for backward compatibility)
    return result.invitations[0];
  },

  /**
   * Accept invitation
   */
  async acceptInvitation(request: AcceptInvitationRequest): Promise<void> {
    // This should be handled by backend API to properly assign roles
    throw new Error('Invitation acceptance must be done through backend API endpoint');
  },

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
      .schema('enterprise')
      .from('organization_invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    if (error) throw error;
  },
};

// Export all services as a single object
export const enterpriseService = {
  organization: organizationService,
  team: teamService,
  role: roleService,
  apiKey: apiKeyService,
  invitation: invitationService,
};

export default enterpriseService;
