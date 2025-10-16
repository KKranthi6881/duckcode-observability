-- =====================================================
-- Add organization_id to duckcode.user_profiles
-- =====================================================
-- The enterprise system stores organization_id in user profiles
-- This adds the column to duckcode.user_profiles
-- =====================================================

-- Add organization_id column if it doesn't exist
ALTER TABLE duckcode.user_profiles 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization_id 
ON duckcode.user_profiles(organization_id);

COMMENT ON COLUMN duckcode.user_profiles.organization_id IS 
  'References the organization this user belongs to (enterprise feature)';
