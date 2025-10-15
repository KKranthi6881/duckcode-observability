-- =====================================================
-- PHASE 1: Enterprise Multi-Tenant Schema
-- =====================================================
-- Creates enterprise-grade team and organization management
-- supporting 2-50+ users per organization with hierarchy.
--
-- Schema inspired by OpenMetadata's team repository pattern
-- Supports: Organization → Division → Department → Business Unit → Team → Users
--
-- Created: 2025-01-15
-- Phase: 1 of 8
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CREATE ENTERPRISE SCHEMA
-- =====================================================

CREATE SCHEMA IF NOT EXISTS enterprise;

GRANT USAGE ON SCHEMA enterprise TO postgres, service_role, authenticated, anon;

COMMENT ON SCHEMA enterprise IS 'Enterprise multi-tenant team and organization management';

-- =====================================================
-- 2. CREATE ENUMS
-- =====================================================

CREATE TYPE enterprise.plan_type AS ENUM ('trial', 'starter', 'professional', 'enterprise');
CREATE TYPE enterprise.organization_status AS ENUM ('active', 'suspended', 'trial', 'cancelled');
CREATE TYPE enterprise.team_type AS ENUM ('organization', 'division', 'department', 'business_unit', 'group');
CREATE TYPE enterprise.team_member_role AS ENUM ('admin', 'member', 'viewer');
CREATE TYPE enterprise.provider_type AS ENUM ('openai', 'anthropic', 'azure', 'gemini', 'bedrock');
CREATE TYPE enterprise.api_key_status AS ENUM ('active', 'inactive', 'expired', 'revoked');
CREATE TYPE enterprise.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- =====================================================
-- 3. ORGANIZATIONS TABLE
-- =====================================================

CREATE TABLE enterprise.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  domain TEXT, -- e.g., "acme.com"
  plan_type enterprise.plan_type DEFAULT 'trial' NOT NULL,
  max_users INTEGER DEFAULT 5 NOT NULL,
  status enterprise.organization_status DEFAULT 'trial' NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT organizations_name_length CHECK (length(name) >= 3 AND length(name) <= 100),
  CONSTRAINT organizations_display_name_length CHECK (length(display_name) >= 1 AND length(display_name) <= 255)
);

CREATE INDEX idx_organizations_status ON enterprise.organizations(status);
CREATE INDEX idx_organizations_plan_type ON enterprise.organizations(plan_type);
CREATE INDEX idx_organizations_domain ON enterprise.organizations(domain);

COMMENT ON TABLE enterprise.organizations IS 'Enterprise customer organizations';
COMMENT ON COLUMN enterprise.organizations.name IS 'Unique organization identifier (slug)';
COMMENT ON COLUMN enterprise.organizations.max_users IS 'Maximum number of users allowed based on plan';
COMMENT ON COLUMN enterprise.organizations.settings IS 'Organization-wide settings (JSON)';

-- =====================================================
-- 4. TEAMS TABLE (with hierarchy support)
-- =====================================================

CREATE TABLE enterprise.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL,
  parent_team_id UUID REFERENCES enterprise.teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  team_type enterprise.team_type DEFAULT 'group' NOT NULL,
  description TEXT,
  email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT teams_unique_name_per_org UNIQUE(organization_id, name),
  CONSTRAINT teams_name_length CHECK (length(name) >= 1 AND length(name) <= 100),
  CONSTRAINT teams_no_self_parent CHECK (id != parent_team_id)
);

CREATE INDEX idx_teams_organization ON enterprise.teams(organization_id);
CREATE INDEX idx_teams_parent ON enterprise.teams(parent_team_id);
CREATE INDEX idx_teams_type ON enterprise.teams(team_type);

COMMENT ON TABLE enterprise.teams IS 'Hierarchical team structure supporting nested teams';
COMMENT ON COLUMN enterprise.teams.team_type IS 'Team hierarchy level: organization, division, department, business_unit, group';
COMMENT ON COLUMN enterprise.teams.parent_team_id IS 'Parent team for nested hierarchy (NULL for root teams)';

-- =====================================================
-- 5. TEAM MEMBERS TABLE
-- =====================================================

CREATE TABLE enterprise.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES enterprise.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role enterprise.team_member_role DEFAULT 'member' NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT team_members_unique UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON enterprise.team_members(team_id);
CREATE INDEX idx_team_members_user ON enterprise.team_members(user_id);
CREATE INDEX idx_team_members_role ON enterprise.team_members(role);

COMMENT ON TABLE enterprise.team_members IS 'Maps users to teams with roles';
COMMENT ON COLUMN enterprise.team_members.role IS 'Team-level role: admin (manage team), member (use resources), viewer (read-only)';

-- =====================================================
-- 6. ORGANIZATION API KEYS TABLE
-- =====================================================

CREATE TABLE enterprise.organization_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL,
  provider enterprise.provider_type NOT NULL,
  encrypted_key TEXT NOT NULL,
  encryption_iv TEXT NOT NULL, -- Initialization vector for AES-256-GCM
  encryption_auth_tag TEXT NOT NULL, -- Authentication tag for AES-256-GCM
  key_name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  status enterprise.api_key_status DEFAULT 'active' NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_used_at TIMESTAMPTZ,
  
  CONSTRAINT api_keys_key_name_length CHECK (length(key_name) >= 1 AND length(key_name) <= 255)
);

CREATE INDEX idx_api_keys_organization ON enterprise.organization_api_keys(organization_id);
CREATE INDEX idx_api_keys_provider ON enterprise.organization_api_keys(provider);
CREATE INDEX idx_api_keys_status ON enterprise.organization_api_keys(status);
CREATE INDEX idx_api_keys_is_default ON enterprise.organization_api_keys(organization_id, is_default) WHERE is_default = true;

COMMENT ON TABLE enterprise.organization_api_keys IS 'Customer-provided LLM API keys (DuckCode does not provide LLMs)';
COMMENT ON COLUMN enterprise.organization_api_keys.encrypted_key IS 'AES-256-GCM encrypted API key';
COMMENT ON COLUMN enterprise.organization_api_keys.is_default IS 'Default API key for this provider';

-- =====================================================
-- 7. ORGANIZATION ROLES TABLE
-- =====================================================

CREATE TABLE enterprise.organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
  is_default BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT org_roles_unique_name UNIQUE(organization_id, name),
  CONSTRAINT org_roles_name_length CHECK (length(name) >= 1 AND length(name) <= 100)
);

CREATE INDEX idx_org_roles_organization ON enterprise.organization_roles(organization_id);
CREATE INDEX idx_org_roles_is_default ON enterprise.organization_roles(organization_id, is_default) WHERE is_default = true;

COMMENT ON TABLE enterprise.organization_roles IS 'Custom roles with permissions (RBAC)';
COMMENT ON COLUMN enterprise.organization_roles.permissions IS 'Array of permission strings (e.g., ["metadata:read", "connectors:create"])';

-- =====================================================
-- 8. USER ORGANIZATION ROLES TABLE
-- =====================================================

CREATE TABLE enterprise.user_organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES enterprise.organization_roles(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT user_org_roles_unique UNIQUE(user_id, organization_id, role_id)
);

CREATE INDEX idx_user_org_roles_user ON enterprise.user_organization_roles(user_id);
CREATE INDEX idx_user_org_roles_organization ON enterprise.user_organization_roles(organization_id);
CREATE INDEX idx_user_org_roles_role ON enterprise.user_organization_roles(role_id);

COMMENT ON TABLE enterprise.user_organization_roles IS 'Maps users to organization-level roles';

-- =====================================================
-- 9. ORGANIZATION INVITATIONS TABLE
-- =====================================================

CREATE TABLE enterprise.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES enterprise.teams(id) ON DELETE SET NULL,
  role_id UUID REFERENCES enterprise.organization_roles(id) ON DELETE SET NULL,
  status enterprise.invitation_status DEFAULT 'pending' NOT NULL,
  invitation_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT invitations_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_invitations_organization ON enterprise.organization_invitations(organization_id);
CREATE INDEX idx_invitations_email ON enterprise.organization_invitations(email);
CREATE INDEX idx_invitations_token ON enterprise.organization_invitations(invitation_token);
CREATE INDEX idx_invitations_status ON enterprise.organization_invitations(status);
CREATE INDEX idx_invitations_expires ON enterprise.organization_invitations(expires_at);

COMMENT ON TABLE enterprise.organization_invitations IS 'User invitations to join organizations';
COMMENT ON COLUMN enterprise.organization_invitations.invitation_token IS 'Unique token for invitation link';
COMMENT ON COLUMN enterprise.organization_invitations.expires_at IS 'Invitation expiration (default 7 days)';

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================

-- Grant appropriate permissions to service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA enterprise TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA enterprise TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA enterprise TO service_role;

-- Grant read access to authenticated users (RLS will control what they see)
GRANT SELECT ON ALL TABLES IN SCHEMA enterprise TO authenticated;

-- Update default privileges for future objects
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA enterprise
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA enterprise
  GRANT SELECT ON TABLES TO authenticated;

-- =====================================================
-- 11. SEED DEFAULT ROLES
-- =====================================================

-- These will be created per organization by a trigger (see next migration)

COMMENT ON SCHEMA enterprise IS 'Phase 1 Complete: Enterprise multi-tenant schema created';

COMMIT;
