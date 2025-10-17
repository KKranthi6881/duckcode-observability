-- =====================================================
-- Debug IDE-SAAS API Key Sync Issue
-- =====================================================

\echo '=== 1. CHECK ALL USERS ==='
SELECT 
  u.id,
  u.email,
  u.created_at
FROM auth.users u
ORDER BY u.created_at DESC;

\echo ''
\echo '=== 2. CHECK USER ORGANIZATIONS ==='
SELECT 
  u.email,
  o.id as org_id,
  o.name as org_name,
  o.display_name,
  r.name as role
FROM auth.users u
JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
JOIN enterprise.organizations o ON o.id = uor.organization_id
LEFT JOIN enterprise.organization_roles r ON r.id = uor.role_id
ORDER BY u.created_at DESC;

\echo ''
\echo '=== 3. CHECK USER PROFILES ==='
SELECT 
  up.id as user_id,
  u.email,
  up.organization_id as profile_org_id,
  o.display_name as profile_org_name
FROM duckcode.user_profiles up
JOIN auth.users u ON u.id = up.id
LEFT JOIN enterprise.organizations o ON o.id = up.organization_id
ORDER BY up.created_at DESC;

\echo ''
\echo '=== 4. CHECK ALL API KEYS ==='
SELECT 
  k.id,
  k.organization_id,
  o.display_name as org_name,
  k.provider,
  k.key_name,
  k.is_default,
  k.status,
  k.created_at
FROM enterprise.organization_api_keys k
LEFT JOIN enterprise.organizations o ON o.id = k.organization_id
ORDER BY k.created_at DESC;

\echo ''
\echo '=== 5. CHECK IDE SESSIONS ==='
SELECT 
  s.session_token_prefix,
  u.email,
  s.created_at,
  s.expires_at,
  s.last_used_at,
  CASE WHEN s.expires_at > NOW() THEN 'Valid' ELSE 'Expired' END as status
FROM duckcode.ide_sessions s
JOIN auth.users u ON u.id = s.user_id
ORDER BY s.created_at DESC
LIMIT 5;

\echo ''
\echo '=== 6. DIAGNOSTIC SUMMARY ==='
DO $$
DECLARE
  v_user_count INTEGER;
  v_newest_user_email TEXT;
  v_newest_user_id UUID;
  v_org_id UUID;
  v_has_api_key BOOLEAN;
  v_api_key_is_default BOOLEAN;
BEGIN
  -- Get newest user
  SELECT COUNT(*), MAX(email), MAX(id) INTO v_user_count, v_newest_user_email, v_newest_user_id
  FROM auth.users;
  
  RAISE NOTICE '📊 Total users: %', v_user_count;
  RAISE NOTICE '👤 Newest user: %', v_newest_user_email;
  
  -- Get user's organization
  SELECT organization_id INTO v_org_id
  FROM enterprise.user_organization_roles
  WHERE user_id = v_newest_user_id
  LIMIT 1;
  
  IF v_org_id IS NULL THEN
    RAISE NOTICE '❌ User has NO organization assigned';
  ELSE
    RAISE NOTICE '✅ User organization ID: %', v_org_id;
    
    -- Check for API key
    SELECT 
      EXISTS(SELECT 1 FROM enterprise.organization_api_keys WHERE organization_id = v_org_id),
      COALESCE(MAX(is_default), FALSE)
    INTO v_has_api_key, v_api_key_is_default
    FROM enterprise.organization_api_keys
    WHERE organization_id = v_org_id AND status = 'active';
    
    IF NOT v_has_api_key THEN
      RAISE NOTICE '❌ Organization has NO API keys';
      RAISE NOTICE '   FIX: Add API key in admin panel';
    ELSIF NOT v_api_key_is_default THEN
      RAISE NOTICE '⚠️  Organization has API key but NOT marked as default';
      RAISE NOTICE '   FIX: Run this command:';
      RAISE NOTICE '   UPDATE enterprise.organization_api_keys SET is_default=true WHERE organization_id=''%'';', v_org_id;
    ELSE
      RAISE NOTICE '✅ Organization has active default API key';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔍 IDE SHOULD USE THIS ORG ID: %', v_org_id;
  RAISE NOTICE '   API endpoint should be: /api/organizations/%/api-keys/active', v_org_id;
END $$;
