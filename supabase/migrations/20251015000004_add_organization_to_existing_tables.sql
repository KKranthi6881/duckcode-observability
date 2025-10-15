-- =====================================================
-- PHASE 1: Link Existing Tables to Enterprise Schema
-- =====================================================
-- Adds organization_id to existing tables for multi-tenancy
--
-- Modified tables:
-- - public.profiles
-- - github_module.github_app_installations
--
-- Created: 2025-01-15
-- Phase: 1 of 8
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ADD ORGANIZATION_ID TO PROFILES
-- =====================================================

-- Add organization_id column (nullable initially for migration)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID 
REFERENCES enterprise.organizations(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_organization 
ON public.profiles(organization_id);

COMMENT ON COLUMN public.profiles.organization_id IS 'Primary organization the user belongs to';

-- =====================================================
-- 2. ADD ORGANIZATION_ID TO GITHUB INSTALLATIONS
-- =====================================================

-- Add organization_id column
ALTER TABLE github_module.github_app_installations
ADD COLUMN IF NOT EXISTS organization_id UUID
REFERENCES enterprise.organizations(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_github_installations_organization
ON github_module.github_app_installations(organization_id);

COMMENT ON COLUMN github_module.github_app_installations.organization_id IS 'Organization that owns this GitHub installation';

-- =====================================================
-- 3. UPDATE RLS POLICIES FOR GITHUB INSTALLATIONS
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users_see_own_installations" ON github_module.github_app_installations;
DROP POLICY IF EXISTS "service_role_full_access" ON github_module.github_app_installations;

-- Enable RLS if not already enabled
ALTER TABLE github_module.github_app_installations ENABLE ROW LEVEL SECURITY;

-- Users can only see installations in their organizations
CREATE POLICY "users_see_organization_installations" ON github_module.github_app_installations
  FOR SELECT
  USING (
    organization_id IS NULL -- Allow legacy installations
    OR organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Only organization admins can create/update installations
CREATE POLICY "org_admins_manage_installations" ON github_module.github_app_installations
  FOR ALL
  USING (
    organization_id IS NULL -- Allow legacy operations
    OR enterprise.is_organization_admin(auth.uid(), organization_id)
  );

-- Service role has full access
CREATE POLICY "service_role_full_access_installations" ON github_module.github_app_installations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 4. FUNCTION TO MIGRATE EXISTING USERS TO ORGANIZATIONS
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.migrate_user_to_personal_organization(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_org_id UUID;
  v_admin_role_id UUID;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- Check if user already has an organization
  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE id = p_user_id
    AND organization_id IS NOT NULL;
  
  IF v_org_id IS NOT NULL THEN
    -- User already has an organization
    RETURN v_org_id;
  END IF;
  
  -- Create personal organization
  INSERT INTO enterprise.organizations (
    name,
    display_name,
    plan_type,
    status
  ) VALUES (
    regexp_replace(lower(v_user_email), '[^a-z0-9]', '_', 'g') || '_org',
    v_user_email || '''s Organization',
    'trial',
    'active'
  )
  RETURNING id INTO v_org_id;
  
  -- Get Admin role ID
  SELECT id INTO v_admin_role_id
  FROM enterprise.organization_roles
  WHERE organization_id = v_org_id
    AND name = 'Admin';
  
  -- Assign user as admin
  INSERT INTO enterprise.user_organization_roles (
    user_id,
    organization_id,
    role_id,
    assigned_by
  ) VALUES (
    p_user_id,
    v_org_id,
    v_admin_role_id,
    p_user_id
  );
  
  -- Update profile with organization
  UPDATE public.profiles
  SET organization_id = v_org_id
  WHERE id = p_user_id;
  
  -- Migrate GitHub installations if any
  UPDATE github_module.github_app_installations
  SET organization_id = v_org_id
  WHERE supabase_user_id = p_user_id::TEXT
    AND organization_id IS NULL;
  
  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION enterprise.migrate_user_to_personal_organization IS 'Migrates existing user to their own personal organization';

-- =====================================================
-- 5. TRIGGER TO AUTO-CREATE ORGANIZATION FOR NEW USERS
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.auto_create_organization_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Create personal organization for new user
  v_org_id := enterprise.migrate_user_to_personal_organization(NEW.id);
  
  RAISE NOTICE 'Auto-created organization % for user %', v_org_id, NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table
DROP TRIGGER IF EXISTS trigger_auto_create_organization ON public.profiles;
CREATE TRIGGER trigger_auto_create_organization
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.auto_create_organization_for_user();

COMMENT ON FUNCTION enterprise.auto_create_organization_for_user IS 'Auto-creates personal organization when new user signs up';

-- =====================================================
-- 6. MIGRATE EXISTING USERS (Run manually or via API)
-- =====================================================

-- This will be run manually to avoid blocking the migration
-- See migration guide in documentation

COMMENT ON SCHEMA enterprise IS '
MIGRATION NOTE:
To migrate existing users, run:

SELECT enterprise.migrate_user_to_personal_organization(id)
FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.profiles WHERE organization_id IS NOT NULL
)
LIMIT 10;

This creates personal organizations for existing users.
For production, use batch processing via API.
';

COMMIT;

-- =====================================================
-- PHASE 1 COMPLETE
-- =====================================================
/*
✅ Enterprise schema created
✅ Organizations, teams, roles tables ready
✅ Helper functions implemented
✅ RLS policies enforcing multi-tenancy
✅ Existing tables linked to organizations
✅ Auto-organization creation for new users

Next: Phase 2 - Build Admin Portal UI
*/
