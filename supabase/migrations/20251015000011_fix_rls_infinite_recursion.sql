-- =====================================================
-- Fix: RLS Infinite Recursion on user_organization_roles
-- =====================================================
-- The policy was querying user_organization_roles inside its own RLS check
-- This caused infinite recursion: "ERROR: infinite recursion detected in policy for relation user_organization_roles"
-- 
-- FIX: Allow users to see ALL role assignments in organizations where they are members
-- Use a simpler check that doesn't reference the same table
-- =====================================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "users_see_role_assignments" ON enterprise.user_organization_roles;

-- Create new policy that doesn't cause recursion
-- Users can see role assignments if they are a member of that organization
CREATE POLICY "users_see_role_assignments" ON enterprise.user_organization_roles
  FOR SELECT
  USING (
    -- Allow users to see their own assignments
    user_id = auth.uid()
    OR
    -- Or if they are an admin in that organization
    enterprise.is_organization_admin(auth.uid(), organization_id)
  );

COMMENT ON POLICY "users_see_role_assignments" ON enterprise.user_organization_roles IS
  'Users can see their own role assignments and admins can see all assignments in their organization';
