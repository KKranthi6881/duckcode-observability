-- =====================================================
-- CLEANUP: Remove Duplicate Organizations
-- =====================================================
-- This migration identifies and removes duplicate organizations
-- created during the registration flow before the fix was applied.
-- 
-- Strategy:
-- 1. Find users with multiple organizations
-- 2. Keep the FIRST organization (by assigned_at timestamp)
-- 3. Update user_profiles to point to the kept organization
-- 4. Remove duplicate user_organization_roles
-- 5. Delete duplicate organizations
-- =====================================================

-- Step 1: Create temporary table to track duplicates
CREATE TEMP TABLE duplicate_orgs_analysis AS
WITH user_org_counts AS (
  SELECT 
    user_id,
    COUNT(DISTINCT organization_id) as org_count,
    ARRAY_AGG(organization_id ORDER BY assigned_at) as org_ids,
    MIN(assigned_at) as first_assigned_at
  FROM (
    -- Get distinct organization_id per user with earliest assigned_at
    SELECT DISTINCT ON (user_id, organization_id)
      user_id,
      organization_id,
      assigned_at
    FROM enterprise.user_organization_roles
    ORDER BY user_id, organization_id, assigned_at
  ) distinct_orgs
  GROUP BY user_id
  HAVING COUNT(DISTINCT organization_id) > 1
)
SELECT 
  uoc.user_id,
  uoc.org_count,
  uoc.org_ids[1] as primary_org_id,
  uoc.org_ids[2:] as duplicate_org_ids,
  u.email,
  up.organization_id as profile_org_id
FROM user_org_counts uoc
JOIN auth.users u ON u.id = uoc.user_id
LEFT JOIN duckcode.user_profiles up ON up.id = uoc.user_id;

-- Step 2: Log what we found
DO $$
DECLARE
  v_duplicate_count INTEGER;
  v_duplicate_record RECORD;
BEGIN
  SELECT COUNT(*) INTO v_duplicate_count FROM duplicate_orgs_analysis;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DUPLICATE ORGANIZATION CLEANUP ANALYSIS';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Found % users with multiple organizations', v_duplicate_count;
  
  IF v_duplicate_count > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Details:';
    RAISE NOTICE '--------';
    
    FOR v_duplicate_record IN 
      SELECT user_id, email, org_count, primary_org_id, duplicate_org_ids, profile_org_id
      FROM duplicate_orgs_analysis
    LOOP
      RAISE NOTICE 'User: % (%), Orgs: %, Keeping: %, Removing: %, Profile points to: %',
        v_duplicate_record.email,
        v_duplicate_record.user_id,
        v_duplicate_record.org_count,
        v_duplicate_record.primary_org_id,
        v_duplicate_record.duplicate_org_ids,
        v_duplicate_record.profile_org_id;
    END LOOP;
  ELSE
    RAISE NOTICE 'No duplicate organizations found! System is clean.';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- Step 3: Update user_profiles to point to primary organization (if not already)
UPDATE duckcode.user_profiles up
SET organization_id = doa.primary_org_id
FROM duplicate_orgs_analysis doa
WHERE up.id = doa.user_id
  AND (up.organization_id IS NULL OR up.organization_id != doa.primary_org_id);

-- Step 4: Remove duplicate user_organization_roles (keep only primary org)
DELETE FROM enterprise.user_organization_roles uor
USING duplicate_orgs_analysis doa
WHERE uor.user_id = doa.user_id
  AND uor.organization_id = ANY(doa.duplicate_org_ids);

-- Step 5: Delete duplicate organizations (only if they have no other users)
-- This is safe because we already removed the user_organization_roles above
DELETE FROM enterprise.organizations o
USING duplicate_orgs_analysis doa
WHERE o.id = ANY(doa.duplicate_org_ids)
  AND NOT EXISTS (
    -- Make sure no other users are assigned to this org
    SELECT 1 FROM enterprise.user_organization_roles uor2
    WHERE uor2.organization_id = o.id
  );

-- Step 6: Report final status
DO $$
DECLARE
  v_cleaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_cleaned_count
  FROM auth.users u
  WHERE EXISTS (
    SELECT 1 FROM enterprise.user_organization_roles uor
    WHERE uor.user_id = u.id
    GROUP BY uor.user_id
    HAVING COUNT(DISTINCT uor.organization_id) > 1
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANUP COMPLETE';
  RAISE NOTICE '========================================';
  
  IF v_cleaned_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All duplicate organizations have been cleaned up!';
    RAISE NOTICE 'All users now have exactly one organization.';
  ELSE
    RAISE NOTICE '⚠️  WARNING: % users still have multiple organizations', v_cleaned_count;
    RAISE NOTICE 'Manual intervention may be required.';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- Drop temporary table
DROP TABLE IF EXISTS duplicate_orgs_analysis;

-- Add comment documenting this cleanup
COMMENT ON TABLE enterprise.organizations IS 
  'Organization table - stores company/team information. Migration 20251017000001 cleaned up duplicates created by dual organization creation flow.';
