-- =====================================================
-- UPDATE DEFAULT ROLES TO SIMPLIFIED MODEL
-- =====================================================
-- This migration updates the default role permissions to follow
-- the simplified 3-tier model: Viewer, Member, Admin

-- Drop and recreate the function with updated permissions
CREATE OR REPLACE FUNCTION enterprise.create_default_roles_for_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ==================== ADMIN ROLE ====================
  -- Full access to everything
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
  -- Can work with data and run operations
  -- BUT cannot manage API keys or invite users
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
  
  -- ==================== VIEWER ROLE ====================
  -- Read-only access to data and analytics
  -- Cannot modify anything or see sensitive info
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
    '[
      "metadata:read",
      "teams:read"
    ]'::jsonb,
    true
  );
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enterprise.create_default_roles_for_organization IS 'Auto-creates simplified 3-tier roles (Admin, Member, Viewer) for new organizations';

-- =====================================================
-- UPDATE EXISTING ORGANIZATIONS
-- =====================================================
-- Update existing Member and Viewer roles to have correct permissions

UPDATE enterprise.organization_roles
SET permissions = '[
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

UPDATE enterprise.organization_roles
SET permissions = '[
  "metadata:read",
  "teams:read"
]'::jsonb
WHERE name = 'Viewer' AND is_default = true;

-- Mark all default roles as is_default = true
UPDATE enterprise.organization_roles
SET is_default = true
WHERE name IN ('Admin', 'Member', 'Viewer');

COMMENT ON TABLE enterprise.organization_roles IS 'Organization roles - 3 default roles: Admin (full access), Member (can work but no admin), Viewer (read-only)';
