-- =====================================================
-- PHASE 1: Enterprise Helper Functions
-- =====================================================
-- Utility functions for working with enterprise schema
-- 
-- Created: 2025-01-15
-- Phase: 1 of 8
-- =====================================================

BEGIN;

-- =====================================================
-- 1. GET USER'S ORGANIZATIONS
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.get_user_organizations(p_user_id UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_display_name TEXT,
  user_role_name TEXT,
  is_admin BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    o.id AS organization_id,
    o.name AS organization_name,
    o.display_name AS organization_display_name,
    r.name AS user_role_name,
    (r.name = 'Admin') AS is_admin
  FROM enterprise.organizations o
  INNER JOIN enterprise.user_organization_roles uor ON uor.organization_id = o.id
  INNER JOIN enterprise.organization_roles r ON r.id = uor.role_id
  WHERE uor.user_id = p_user_id
    AND o.status = 'active'
  ORDER BY o.created_at DESC;
END;
$$;

COMMENT ON FUNCTION enterprise.get_user_organizations IS 'Returns all organizations a user belongs to with their roles';

-- =====================================================
-- 2. CHECK IF USER IS ORGANIZATION ADMIN
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.is_organization_admin(
  p_user_id UUID,
  p_organization_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM enterprise.user_organization_roles uor
    INNER JOIN enterprise.organization_roles r ON r.id = uor.role_id
    WHERE uor.user_id = p_user_id
      AND uor.organization_id = p_organization_id
      AND r.name = 'Admin'
  ) INTO v_is_admin;
  
  RETURN v_is_admin;
END;
$$;

COMMENT ON FUNCTION enterprise.is_organization_admin IS 'Checks if user has Admin role in organization';

-- =====================================================
-- 3. GET USER'S TEAMS
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.get_user_teams(p_user_id UUID)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  team_display_name TEXT,
  team_type TEXT,
  organization_id UUID,
  member_role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS team_id,
    t.name AS team_name,
    t.display_name AS team_display_name,
    t.team_type::TEXT AS team_type,
    t.organization_id,
    tm.role::TEXT AS member_role
  FROM enterprise.teams t
  INNER JOIN enterprise.team_members tm ON tm.team_id = t.id
  WHERE tm.user_id = p_user_id
  ORDER BY t.created_at DESC;
END;
$$;

COMMENT ON FUNCTION enterprise.get_user_teams IS 'Returns all teams a user is member of';

-- =====================================================
-- 4. CHECK IF USER IS TEAM ADMIN
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.is_team_admin(
  p_user_id UUID,
  p_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM enterprise.team_members tm
    WHERE tm.user_id = p_user_id
      AND tm.team_id = p_team_id
      AND tm.role = 'admin'
  ) INTO v_is_admin;
  
  RETURN v_is_admin;
END;
$$;

COMMENT ON FUNCTION enterprise.is_team_admin IS 'Checks if user has admin role in team';

-- =====================================================
-- 5. GET TEAM HIERARCHY (recursive)
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.get_team_hierarchy(p_team_id UUID)
RETURNS TABLE (
  team_id UUID,
  team_name TEXT,
  team_type TEXT,
  parent_team_id UUID,
  level INTEGER,
  path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE team_tree AS (
    -- Base case: start with the specified team
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      t.team_type::TEXT AS team_type,
      t.parent_team_id,
      0 AS level,
      t.name AS path
    FROM enterprise.teams t
    WHERE t.id = p_team_id
    
    UNION ALL
    
    -- Recursive case: get all child teams
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      t.team_type::TEXT AS team_type,
      t.parent_team_id,
      tt.level + 1 AS level,
      tt.path || ' > ' || t.name AS path
    FROM enterprise.teams t
    INNER JOIN team_tree tt ON t.parent_team_id = tt.team_id
  )
  SELECT * FROM team_tree
  ORDER BY level, team_name;
END;
$$;

COMMENT ON FUNCTION enterprise.get_team_hierarchy IS 'Returns team and all its descendant teams (recursive)';

-- =====================================================
-- 6. CHECK USER PERMISSION
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.check_permission(
  p_user_id UUID,
  p_organization_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- Check if user has the specific permission or wildcard (*)
  SELECT EXISTS (
    SELECT 1
    FROM enterprise.user_organization_roles uor
    INNER JOIN enterprise.organization_roles r ON r.id = uor.role_id
    WHERE uor.user_id = p_user_id
      AND uor.organization_id = p_organization_id
      AND (
        r.permissions @> to_jsonb(ARRAY[p_permission])
        OR r.permissions @> to_jsonb(ARRAY['*'])
      )
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$;

COMMENT ON FUNCTION enterprise.check_permission IS 'Checks if user has specific permission in organization';

-- =====================================================
-- 7. GET ORGANIZATION MEMBERS
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.get_organization_members(p_organization_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  role_name TEXT,
  assigned_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email AS user_email,
    r.display_name AS role_name,
    uor.assigned_at
  FROM auth.users u
  INNER JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
  INNER JOIN enterprise.organization_roles r ON r.id = uor.role_id
  WHERE uor.organization_id = p_organization_id
  ORDER BY uor.assigned_at DESC;
END;
$$;

COMMENT ON FUNCTION enterprise.get_organization_members IS 'Returns all members of an organization with their roles';

-- =====================================================
-- 8. TRIGGER: Auto-create default roles for new organization
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.create_default_roles_for_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create Admin role
  INSERT INTO enterprise.organization_roles (
    organization_id,
    name,
    display_name,
    permissions,
    is_default
  ) VALUES (
    NEW.id,
    'Admin',
    'Administrator',
    '["*"]'::jsonb, -- All permissions
    true
  );
  
  -- Create Member role
  INSERT INTO enterprise.organization_roles (
    organization_id,
    name,
    display_name,
    permissions,
    is_default
  ) VALUES (
    NEW.id,
    'Member',
    'Member',
    '["metadata:read", "teams:read"]'::jsonb,
    false
  );
  
  -- Create Viewer role
  INSERT INTO enterprise.organization_roles (
    organization_id,
    name,
    display_name,
    permissions,
    is_default
  ) VALUES (
    NEW.id,
    'Viewer',
    'Viewer',
    '["metadata:read"]'::jsonb,
    false
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_create_default_roles ON enterprise.organizations;
CREATE TRIGGER trigger_create_default_roles
  AFTER INSERT ON enterprise.organizations
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.create_default_roles_for_organization();

COMMENT ON FUNCTION enterprise.create_default_roles_for_organization IS 'Auto-creates Admin, Member, and Viewer roles for new organizations';

-- =====================================================
-- 9. TRIGGER: Auto-expire invitations
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.auto_expire_invitations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set default expiration to 7 days if not provided
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := now() + interval '7 days';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_expire_invitations ON enterprise.organization_invitations;
CREATE TRIGGER trigger_auto_expire_invitations
  BEFORE INSERT ON enterprise.organization_invitations
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.auto_expire_invitations();

COMMENT ON FUNCTION enterprise.auto_expire_invitations IS 'Automatically sets invitation expiration to 7 days';

-- =====================================================
-- 10. UPDATE TIMESTAMPS TRIGGER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to all tables with updated_at column
CREATE TRIGGER trigger_update_organizations_timestamp
  BEFORE UPDATE ON enterprise.organizations
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.update_updated_at_column();

CREATE TRIGGER trigger_update_teams_timestamp
  BEFORE UPDATE ON enterprise.teams
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.update_updated_at_column();

CREATE TRIGGER trigger_update_team_members_timestamp
  BEFORE UPDATE ON enterprise.team_members
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.update_updated_at_column();

CREATE TRIGGER trigger_update_org_roles_timestamp
  BEFORE UPDATE ON enterprise.organization_roles
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.update_updated_at_column();

COMMENT ON FUNCTION enterprise.update_updated_at_column IS 'Automatically updates updated_at timestamp on row updates';

COMMIT;
