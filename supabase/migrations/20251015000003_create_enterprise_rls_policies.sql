-- =====================================================
-- PHASE 1: Row-Level Security (RLS) Policies
-- =====================================================
-- Enforces multi-tenant data isolation
-- Users can only access data from their organizations
--
-- Created: 2025-01-15
-- Phase: 1 of 8
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE enterprise.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.organization_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.user_organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.organization_invitations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. ORGANIZATIONS POLICIES
-- =====================================================

-- Users can only see organizations they belong to
CREATE POLICY "users_see_their_organizations" ON enterprise.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id 
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Only organization admins can update organization settings
CREATE POLICY "admins_can_update_organizations" ON enterprise.organizations
  FOR UPDATE
  USING (
    enterprise.is_organization_admin(auth.uid(), id)
  );

-- Service role has full access (bypasses RLS)
CREATE POLICY "service_role_full_access_organizations" ON enterprise.organizations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 3. TEAMS POLICIES
-- =====================================================

-- Users can see teams in their organizations
CREATE POLICY "users_see_organization_teams" ON enterprise.teams
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Organization admins can create teams
CREATE POLICY "org_admins_can_create_teams" ON enterprise.teams
  FOR INSERT
  WITH CHECK (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Team admins and organization admins can update teams
CREATE POLICY "admins_can_update_teams" ON enterprise.teams
  FOR UPDATE
  USING (
    enterprise.is_organization_admin(auth.uid(), organization_id)
    OR enterprise.is_team_admin(auth.uid(), id)
  );

-- Organization admins can delete teams
CREATE POLICY "org_admins_can_delete_teams" ON enterprise.teams
  FOR DELETE
  USING (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_teams" ON enterprise.teams
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 4. TEAM MEMBERS POLICIES
-- =====================================================

-- Users can see members of their teams
CREATE POLICY "users_see_team_members" ON enterprise.team_members
  FOR SELECT
  USING (
    team_id IN (
      SELECT t.id
      FROM enterprise.teams t
      WHERE t.organization_id IN (
        SELECT organization_id
        FROM enterprise.user_organization_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Team admins and org admins can add members
CREATE POLICY "admins_can_add_team_members" ON enterprise.team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM enterprise.teams t
      WHERE t.id = team_id
        AND (
          enterprise.is_organization_admin(auth.uid(), t.organization_id)
          OR enterprise.is_team_admin(auth.uid(), t.id)
        )
    )
  );

-- Team admins and org admins can remove members
CREATE POLICY "admins_can_remove_team_members" ON enterprise.team_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM enterprise.teams t
      WHERE t.id = team_id
        AND (
          enterprise.is_organization_admin(auth.uid(), t.organization_id)
          OR enterprise.is_team_admin(auth.uid(), t.id)
        )
    )
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_team_members" ON enterprise.team_members
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 5. ORGANIZATION API KEYS POLICIES
-- =====================================================

-- Only organization admins can view API keys
CREATE POLICY "only_org_admins_see_api_keys" ON enterprise.organization_api_keys
  FOR SELECT
  USING (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Only organization admins can create API keys
CREATE POLICY "only_org_admins_create_api_keys" ON enterprise.organization_api_keys
  FOR INSERT
  WITH CHECK (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Only organization admins can update API keys
CREATE POLICY "only_org_admins_update_api_keys" ON enterprise.organization_api_keys
  FOR UPDATE
  USING (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Only organization admins can delete API keys
CREATE POLICY "only_org_admins_delete_api_keys" ON enterprise.organization_api_keys
  FOR DELETE
  USING (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_api_keys" ON enterprise.organization_api_keys
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 6. ORGANIZATION ROLES POLICIES
-- =====================================================

-- Users can see roles in their organizations
CREATE POLICY "users_see_organization_roles" ON enterprise.organization_roles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Only organization admins can manage roles
CREATE POLICY "org_admins_manage_roles" ON enterprise.organization_roles
  FOR ALL
  USING (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_org_roles" ON enterprise.organization_roles
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 7. USER ORGANIZATION ROLES POLICIES
-- =====================================================

-- Users can see role assignments in their organizations
CREATE POLICY "users_see_role_assignments" ON enterprise.user_organization_roles
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Only organization admins can assign roles
CREATE POLICY "org_admins_assign_roles" ON enterprise.user_organization_roles
  FOR INSERT
  WITH CHECK (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Only organization admins can revoke roles
CREATE POLICY "org_admins_revoke_roles" ON enterprise.user_organization_roles
  FOR DELETE
  USING (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_user_org_roles" ON enterprise.user_organization_roles
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 8. ORGANIZATION INVITATIONS POLICIES
-- =====================================================

-- Users can see invitations in their organizations
CREATE POLICY "users_see_organization_invitations" ON enterprise.organization_invitations
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Only organization admins can create invitations
CREATE POLICY "org_admins_create_invitations" ON enterprise.organization_invitations
  FOR INSERT
  WITH CHECK (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Only organization admins can cancel invitations
CREATE POLICY "org_admins_cancel_invitations" ON enterprise.organization_invitations
  FOR UPDATE
  USING (
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_invitations" ON enterprise.organization_invitations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 9. VERIFY RLS IS WORKING
-- =====================================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
  table_name TEXT;
  tables_with_rls TEXT[] := ARRAY[
    'organizations',
    'teams',
    'team_members',
    'organization_api_keys',
    'organization_roles',
    'user_organization_roles',
    'organization_invitations'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables_with_rls LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class
    WHERE relname = table_name
      AND relnamespace = 'enterprise'::regnamespace;
    
    IF NOT rls_enabled THEN
      RAISE EXCEPTION 'RLS not enabled on enterprise.%', table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'RLS successfully enabled on all enterprise tables';
END $$;

COMMIT;

-- =====================================================
-- RLS POLICIES SUMMARY
-- =====================================================
/*
Organizations:
  ✓ Users see only their organizations
  ✓ Only admins can update settings
  
Teams:
  ✓ Users see teams in their organizations
  ✓ Org admins can create/delete teams
  ✓ Team admins can update their teams

Team Members:
  ✓ Users see members of their teams
  ✓ Admins can add/remove members

API Keys:
  ✓ Only org admins can manage API keys
  ✓ Keys encrypted at rest (see Phase 6)

Roles:
  ✓ Users see roles in their organizations
  ✓ Only org admins can manage roles

Role Assignments:
  ✓ Users see assignments in their organizations
  ✓ Only org admins can assign/revoke roles

Invitations:
  ✓ Users see invitations in their organizations
  ✓ Only org admins can create/cancel invitations

Service Role:
  ✓ Bypasses all RLS policies (for backend operations)
*/
