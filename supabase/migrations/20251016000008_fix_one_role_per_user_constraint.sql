-- =====================================================
-- Fix: Ensure ONE role per user per organization
-- =====================================================
-- Current issue: user_org_roles_unique allows multiple roles per user
-- UNIQUE(user_id, organization_id, role_id) means user can have Admin AND Member
-- 
-- Solution: Change constraint to UNIQUE(user_id, organization_id) only
-- This ensures each user has exactly ONE role per organization
-- =====================================================

BEGIN;

-- First, clean up any duplicate role assignments
-- Keep only the most recently assigned role for each user
DELETE FROM enterprise.user_organization_roles
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, organization_id) id
  FROM enterprise.user_organization_roles
  ORDER BY user_id, organization_id, assigned_at DESC
);

-- Drop the old constraint that allowed multiple roles
ALTER TABLE enterprise.user_organization_roles
  DROP CONSTRAINT IF EXISTS user_org_roles_unique;

-- Add new constraint: ONE role per user per organization
ALTER TABLE enterprise.user_organization_roles
  ADD CONSTRAINT user_org_roles_one_per_user UNIQUE (user_id, organization_id);

COMMENT ON CONSTRAINT user_org_roles_one_per_user ON enterprise.user_organization_roles IS
  'Ensures each user has exactly one role per organization (enterprise standard)';

COMMIT;
