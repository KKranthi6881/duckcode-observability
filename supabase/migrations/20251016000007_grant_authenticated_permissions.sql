-- =====================================================
-- Grant explicit permissions to authenticated role
-- =====================================================
-- Even with RLS policies, we need to grant table-level permissions
-- to the authenticated role for INSERT, UPDATE, DELETE operations
-- =====================================================

-- Grant INSERT permission to authenticated users
GRANT INSERT ON enterprise.user_organization_roles TO authenticated;

-- Grant DELETE permission to authenticated users
GRANT DELETE ON enterprise.user_organization_roles TO authenticated;

-- Grant UPDATE permission to authenticated users (in case we need it later)
GRANT UPDATE ON enterprise.user_organization_roles TO authenticated;

-- Ensure authenticated users can SELECT (they already have this, but being explicit)
GRANT SELECT ON enterprise.user_organization_roles TO authenticated;

COMMENT ON TABLE enterprise.user_organization_roles IS 
  'User to organization role mappings with explicit grants to authenticated role';
