-- =====================================================
-- Fix: Invitations INSERT Policy
-- =====================================================
-- The policy using is_organization_admin() is causing permission issues
-- Simplify to check user_organization_roles directly in the policy
-- =====================================================

-- Drop the existing policy
DROP POLICY IF EXISTS "org_admins_create_invitations" ON enterprise.organization_invitations;

-- Create new policy that checks admin role directly
CREATE POLICY "org_admins_create_invitations" ON enterprise.organization_invitations
  FOR INSERT
  WITH CHECK (
    -- User must be an admin in the organization they're inviting to
    EXISTS (
      SELECT 1
      FROM enterprise.user_organization_roles uor
      INNER JOIN enterprise.organization_roles r ON r.id = uor.role_id
      WHERE uor.user_id = auth.uid()
        AND uor.organization_id = organization_invitations.organization_id
        AND r.name = 'Admin'
    )
  );

COMMENT ON POLICY "org_admins_create_invitations" ON enterprise.organization_invitations IS
  'Only organization admins can create invitations';
