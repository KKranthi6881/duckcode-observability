-- =====================================================
-- Add UPDATE policy for user_organization_roles
-- =====================================================
-- Now that we're using UPDATE instead of DELETE+INSERT,
-- we need an UPDATE policy
-- =====================================================

-- Allow authenticated users to update role assignments
CREATE POLICY "authenticated_can_update_roles" ON enterprise.user_organization_roles
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "authenticated_can_update_roles" ON enterprise.user_organization_roles IS
  'Authenticated users can update role assignments (frontend restricts to admins)';
