/**
 * Enterprise Schema TypeScript Types
 * Generated from Phase 1 database schema
 */

// ==================== ENUMS ====================

export type PlanType = 'trial' | 'starter' | 'professional' | 'enterprise';

export type OrganizationStatus = 'active' | 'suspended' | 'trial' | 'cancelled';

export type TeamType = 'organization' | 'division' | 'department' | 'business_unit' | 'group';

export type TeamMemberRole = 'admin' | 'member' | 'viewer';

export type ProviderType = 'openai' | 'anthropic' | 'azure' | 'gemini' | 'bedrock';

export type ApiKeyStatus = 'active' | 'inactive' | 'expired' | 'revoked';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

// ==================== DATABASE MODELS ====================

export interface Organization {
  id: string;
  name: string;
  display_name: string;
  domain?: string;
  plan_type: PlanType;
  max_users: number;
  status: OrganizationStatus;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRole {
  id: string;
  organization_id: string;
  name: string;
  display_name: string;
  permissions: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  organization_id: string;
  parent_team_id?: string;
  name: string;
  display_name: string;
  team_type: TeamType;
  description?: string;
  email?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  joined_at: string;
  updated_at: string;
}

export interface OrganizationApiKey {
  id: string;
  organization_id?: string;
  provider: ProviderType;
  masked_key: string; // Already masked by backend for security
  key_name: string;
  is_default: boolean;
  status: ApiKeyStatus;
  created_by?: string;
  created_at: string;
  last_used_at?: string;
}

export interface UserOrganizationRole {
  id: string;
  user_id: string;
  organization_id: string;
  role_id: string;
  assigned_by?: string;
  assigned_at: string;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  invited_by?: string;
  team_id?: string;
  role_id?: string;
  status: InvitationStatus;
  invitation_token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

// ==================== VIEW MODELS (Extended with joins) ====================

export interface OrganizationWithStats extends Organization {
  member_count?: number;
  team_count?: number;
  api_key_count?: number;
}

export interface TeamWithMembers extends Team {
  member_count?: number;
  members?: TeamMemberWithUser[];
  parent_team?: Team;
  child_teams?: Team[];
}

export interface TeamMemberWithUser extends TeamMember {
  user_email?: string;
  user_name?: string;
}

export interface UserOrganizationRoleWithDetails extends UserOrganizationRole {
  role_name?: string;
  role_display_name?: string;
  permissions?: string[];
}

export interface OrganizationInvitationWithDetails extends OrganizationInvitation {
  invited_by_email?: string;
  team_name?: string;
  role_name?: string;
}

// ==================== API REQUEST/RESPONSE TYPES ====================

export interface CreateOrganizationRequest {
  name: string;
  display_name: string;
  domain?: string;
  plan_type?: PlanType;
}

export interface UpdateOrganizationRequest {
  display_name?: string;
  domain?: string;
  plan_type?: PlanType;
  max_users?: number;
  status?: OrganizationStatus;
  settings?: Record<string, any>;
}

export interface CreateTeamRequest {
  organization_id: string;
  parent_team_id?: string;
  name: string;
  display_name: string;
  team_type?: TeamType;
  description?: string;
  email?: string;
}

export interface UpdateTeamRequest {
  display_name?: string;
  description?: string;
  email?: string;
  team_type?: TeamType;
  parent_team_id?: string;
}

export interface AddTeamMemberRequest {
  team_id: string;
  user_id: string;
  role?: TeamMemberRole;
}

export interface CreateApiKeyRequest {
  organization_id: string;
  provider: ProviderType;
  api_key: string; // Plain text, will be encrypted server-side
  key_name: string;
  is_default?: boolean;
}

export interface CreateRoleRequest {
  organization_id: string;
  name: string;
  display_name: string;
  permissions: string[];
  is_default?: boolean;
}

export interface UpdateRoleRequest {
  display_name?: string;
  permissions?: string[];
}

export interface InviteUserRequest {
  organization_id: string;
  emails: string[]; // Array of email addresses
  team_id?: string;
  role_id: string;
  message?: string;
}

export interface AcceptInvitationRequest {
  invitation_token: string;
}

// ==================== HELPER FUNCTION RETURN TYPES ====================

export interface UserOrganizationsResult {
  organization_id: string;
  organization_name: string;
  organization_display_name: string;
  user_role_name: string;
  is_admin: boolean;
  created_at: string;
}

export interface UserTeamsResult {
  team_id: string;
  team_name: string;
  team_display_name: string;
  team_type: string;
  organization_id: string;
  member_role: string;
}

export interface TeamHierarchyResult {
  team_id: string;
  team_name: string;
  team_type: string;
  parent_team_id?: string;
  level: number;
  path: string;
}

export interface OrganizationMembersResult {
  user_id: string;
  user_email: string;
  role_name: string;
  assigned_at: string;
}

// ==================== UI STATE TYPES ====================

export interface OrganizationSelectorState {
  selectedOrganization?: Organization;
  organizations: Organization[];
  loading: boolean;
  error?: string;
}

export interface TeamTreeNode extends Team {
  children: TeamTreeNode[];
  expanded: boolean;
}

export interface ApiKeyFormData {
  provider: ProviderType;
  api_key: string;
  key_name: string;
  is_default: boolean;
}

// ==================== PERMISSION CONSTANTS ====================

export const PERMISSIONS = {
  // Metadata permissions
  METADATA_READ: 'metadata:read',
  METADATA_WRITE: 'metadata:write',
  METADATA_DELETE: 'metadata:delete',
  
  // Team permissions
  TEAMS_READ: 'teams:read',
  TEAMS_CREATE: 'teams:create',
  TEAMS_UPDATE: 'teams:update',
  TEAMS_DELETE: 'teams:delete',
  
  // Connector permissions
  CONNECTORS_READ: 'connectors:read',
  CONNECTORS_CREATE: 'connectors:create',
  CONNECTORS_UPDATE: 'connectors:update',
  CONNECTORS_DELETE: 'connectors:delete',
  
  // User permissions
  USERS_READ: 'users:read',
  USERS_INVITE: 'users:invite',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  
  // Role permissions
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  
  // API Key permissions
  API_KEYS_READ: 'api_keys:read',
  API_KEYS_CREATE: 'api_keys:create',
  API_KEYS_UPDATE: 'api_keys:update',
  API_KEYS_DELETE: 'api_keys:delete',
  
  // Organization permissions
  ORGANIZATION_READ: 'organization:read',
  ORGANIZATION_UPDATE: 'organization:update',
  ORGANIZATION_DELETE: 'organization:delete',
  
  // Wildcard (all permissions)
  ALL: '*',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
