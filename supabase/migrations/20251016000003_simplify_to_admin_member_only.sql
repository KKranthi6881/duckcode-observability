-- =====================================================
-- SIMPLIFY ROLES TO ADMIN AND MEMBER ONLY
-- =====================================================
-- This migration removes the Viewer role and simplifies to 2 roles:
-- - Admin: Full access (both main dashboard + admin panel)
-- - Member: Main dashboard only (cannot access admin panel)

-- First, migrate any users with Viewer role to Member role
UPDATE enterprise.user_organization_roles
SET role_id = (
  SELECT r_member.id 
  FROM enterprise.organization_roles r_member
  WHERE r_member.organization_id = user_organization_roles.organization_id
  AND r_member.name = 'Member'
)
WHERE role_id IN (
  SELECT id 
  FROM enterprise.organization_roles 
  WHERE name = 'Viewer'
);

-- Delete the Viewer role
DELETE FROM enterprise.organization_roles
WHERE name = 'Viewer';

-- Update the default roles creation function to only create Admin and Member
CREATE OR REPLACE FUNCTION enterprise.create_default_roles_for_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ==================== ADMIN ROLE ====================
  -- Full access: Main dashboard + Admin panel
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
  
  -- ==================== MEMBER ROLE ====================
  -- Main dashboard only, no admin panel access
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
    '[
      "dashboard:read",
      "metadata:read",
      "metadata:write",
      "connectors:read",
      "connectors:create",
      "connectors:update",
      "teams:read",
      "teams:create",
      "teams:update"
    ]'::jsonb,
    true
  );
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enterprise.create_default_roles_for_organization IS 
  'Auto-creates 2 simplified roles (Admin, Member) for new organizations. Admin has full access, Member has main dashboard only.';

-- Update existing Member roles with dashboard permission
UPDATE enterprise.organization_roles
SET permissions = '[
  "dashboard:read",
  "metadata:read",
  "metadata:write",
  "connectors:read",
  "connectors:create",
  "connectors:update",
  "teams:read",
  "teams:create",
  "teams:update"
]'::jsonb
WHERE name = 'Member' AND is_default = true;

-- Verify we only have Admin and Member roles as defaults
DO $$
DECLARE
  role_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT name) INTO role_count
  FROM enterprise.organization_roles
  WHERE is_default = true;
  
  IF role_count != 2 THEN
    RAISE WARNING 'Expected 2 default roles (Admin, Member), found %', role_count;
  ELSE
    RAISE NOTICE 'Successfully simplified to 2 roles: Admin and Member';
  END IF;
END;
$$;

COMMENT ON TABLE enterprise.organization_roles IS 
  'Organization roles - 2 default roles only: Admin (full access including admin panel) and Member (main dashboard access only)';
