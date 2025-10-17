-- =====================================================
-- API Key Sync Diagnostic Script
-- =====================================================
-- Run this to diagnose why API key sync is not working
-- Replace YOUR_EMAIL_HERE with your actual email
-- =====================================================

\echo '=============================================='
\echo 'API KEY SYNC DIAGNOSTIC REPORT'
\echo '=============================================='
\echo ''

-- Step 1: Check user and their organizations
\echo '1. USER ORGANIZATION MEMBERSHIP'
\echo '----------------------------------------------'
SELECT 
  u.id as user_id,
  u.email,
  COUNT(DISTINCT uor.organization_id) as org_count,
  STRING_AGG(DISTINCT o.name, ', ') as org_names,
  STRING_AGG(DISTINCT o.display_name, ', ') as org_display_names,
  STRING_AGG(DISTINCT r.name, ', ') as roles
FROM auth.users u
LEFT JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
LEFT JOIN enterprise.organizations o ON o.id = uor.organization_id
LEFT JOIN enterprise.organization_roles r ON r.id = uor.role_id
WHERE u.email = 'YOUR_EMAIL_HERE'  -- ⚠️ REPLACE THIS
GROUP BY u.id, u.email;

\echo ''
\echo 'Expected: org_count=1, roles should include Admin or Member'
\echo ''

-- Step 2: Detailed organization roles
\echo '2. DETAILED ORGANIZATION ROLES'
\echo '----------------------------------------------'
SELECT 
  u.email,
  o.id as organization_id,
  o.name as org_name,
  o.display_name,
  r.name as role_name,
  r.display_name as role_display_name,
  uor.assigned_at
FROM auth.users u
JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
JOIN enterprise.organizations o ON o.id = uor.organization_id
LEFT JOIN enterprise.organization_roles r ON r.id = uor.role_id
WHERE u.email = 'YOUR_EMAIL_HERE'  -- ⚠️ REPLACE THIS
ORDER BY uor.assigned_at;

\echo ''
\echo 'Expected: Single row with valid organization_id and role'
\echo ''

-- Step 3: Check API keys for user's organizations
\echo '3. ORGANIZATION API KEYS'
\echo '----------------------------------------------'
SELECT 
  k.id,
  k.organization_id,
  o.name as org_name,
  k.provider,
  k.key_name,
  k.is_default,  -- ⚠️ MUST BE TRUE
  k.status,      -- ⚠️ MUST BE 'active'
  LENGTH(k.encrypted_key) as key_length,
  k.created_at,
  k.last_used_at
FROM enterprise.organization_api_keys k
JOIN enterprise.organizations o ON o.id = k.organization_id
WHERE k.organization_id IN (
  SELECT uor.organization_id
  FROM auth.users u
  JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
  WHERE u.email = 'YOUR_EMAIL_HERE'  -- ⚠️ REPLACE THIS
)
ORDER BY k.created_at DESC;

\echo ''
\echo 'Expected: At least one row with is_default=t and status=active'
\echo ''

-- Step 4: Check for duplicate organizations (should be 0 after cleanup)
\echo '4. DUPLICATE ORGANIZATIONS CHECK'
\echo '----------------------------------------------'
SELECT 
  user_id,
  COUNT(DISTINCT organization_id) as org_count,
  ARRAY_AGG(DISTINCT organization_id) as org_ids
FROM enterprise.user_organization_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE'  -- ⚠️ REPLACE THIS
)
GROUP BY user_id
HAVING COUNT(DISTINCT organization_id) > 1;

\echo ''
\echo 'Expected: 0 rows (no duplicates)'
\echo ''

-- Step 5: Check user profile organization_id
\echo '5. USER PROFILE ORGANIZATION ID'
\echo '----------------------------------------------'
SELECT 
  up.id as user_id,
  u.email,
  up.organization_id as profile_org_id,
  o.name as org_name,
  o.display_name,
  up.created_at as profile_created_at
FROM duckcode.user_profiles up
JOIN auth.users u ON u.id = up.id
LEFT JOIN enterprise.organizations o ON o.id = up.organization_id
WHERE u.email = 'YOUR_EMAIL_HERE';  -- ⚠️ REPLACE THIS

\echo ''
\echo 'Expected: profile_org_id should match organization_id from step 2'
\echo ''

-- Step 6: Summary and recommendations
\echo '=============================================='
\echo 'DIAGNOSTIC SUMMARY'
\echo '=============================================='
\echo ''

DO $$
DECLARE
  v_user_id UUID;
  v_org_count INT;
  v_has_api_key BOOLEAN;
  v_org_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'YOUR_EMAIL_HERE';  -- ⚠️ REPLACE THIS
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ ISSUE: User not found with that email';
    RETURN;
  END IF;
  
  -- Check organization count
  SELECT COUNT(DISTINCT organization_id) INTO v_org_count
  FROM enterprise.user_organization_roles
  WHERE user_id = v_user_id;
  
  IF v_org_count = 0 THEN
    RAISE NOTICE '❌ ISSUE: User has no organizations assigned';
    RAISE NOTICE '   FIX: Run duplicate org cleanup migration or manually assign organization';
  ELSIF v_org_count > 1 THEN
    RAISE NOTICE '⚠️  WARNING: User has % organizations (should be 1)', v_org_count;
    RAISE NOTICE '   FIX: Run: DELETE FROM enterprise.user_organization_roles WHERE user_id = % AND organization_id != (SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = % ORDER BY assigned_at LIMIT 1);', v_user_id, v_user_id;
  ELSE
    RAISE NOTICE '✅ OK: User has exactly 1 organization';
    
    -- Get the organization ID
    SELECT organization_id INTO v_org_id
    FROM enterprise.user_organization_roles
    WHERE user_id = v_user_id
    LIMIT 1;
    
    -- Check for API keys
    SELECT EXISTS (
      SELECT 1 FROM enterprise.organization_api_keys
      WHERE organization_id = v_org_id
        AND status = 'active'
        AND is_default = true
    ) INTO v_has_api_key;
    
    IF v_has_api_key THEN
      RAISE NOTICE '✅ OK: Organization has active default API key';
    ELSE
      RAISE NOTICE '❌ ISSUE: No active default API key found for organization';
      RAISE NOTICE '   FIX: Add API key in admin panel and mark as default';
      RAISE NOTICE '   OR: UPDATE enterprise.organization_api_keys SET is_default=true, status=''active'' WHERE organization_id=% AND provider=''openai'';', v_org_id;
    END IF;
  END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'DIAGNOSTIC COMPLETE'
\echo '=============================================='
