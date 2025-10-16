-- Fix users with NULL organization_id
-- This manually creates organizations for users who don't have one

DO $$
DECLARE
  v_user RECORD;
  v_org_id UUID;
  v_admin_role_id UUID;
  v_count INT := 0;
BEGIN
  -- Loop through users without organizations
  FOR v_user IN (
    SELECT 
      u.id as user_id,
      u.email,
      p.full_name
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.organization_id IS NULL
    ORDER BY u.created_at DESC
  )
  LOOP
    RAISE NOTICE 'Processing user: % (%)', v_user.email, v_user.user_id;
    
    -- Create organization for this user
    INSERT INTO enterprise.organizations (
      name,
      display_name,
      plan_type,
      status
    ) VALUES (
      regexp_replace(lower(v_user.email), '[^a-z0-9]', '_', 'g') || '_org',
      COALESCE(v_user.full_name, v_user.email) || '''s Organization',
      'trial',
      'active'
    )
    RETURNING id INTO v_org_id;
    
    RAISE NOTICE '  ✅ Created organization: %', v_org_id;
    
    -- Update profile with organization_id
    UPDATE public.profiles
    SET organization_id = v_org_id
    WHERE id = v_user.user_id;
    
    RAISE NOTICE '  ✅ Updated profile with organization_id';
    
    -- Wait a moment for trigger to create roles
    PERFORM pg_sleep(0.2);
    
    -- Get Admin role ID (should exist from trigger)
    SELECT id INTO v_admin_role_id
    FROM enterprise.organization_roles
    WHERE organization_id = v_org_id
      AND name = 'Admin'
    LIMIT 1;
    
    IF v_admin_role_id IS NULL THEN
      RAISE WARNING '  ⚠️ Admin role not found for org %, roles may not have been created', v_org_id;
      
      -- Create roles manually if trigger failed
      INSERT INTO enterprise.organization_roles (organization_id, name, display_name, permissions, is_default)
      VALUES 
        (v_org_id, 'Admin', 'Administrator', '["*"]'::jsonb, true),
        (v_org_id, 'Member', 'Member', '["metadata:read", "teams:read"]'::jsonb, true),
        (v_org_id, 'Viewer', 'Viewer', '["metadata:read"]'::jsonb, true)
      RETURNING id INTO v_admin_role_id;
      
      RAISE NOTICE '  ✅ Manually created roles';
    ELSE
      RAISE NOTICE '  ✅ Found Admin role: %', v_admin_role_id;
    END IF;
    
    -- Assign user as Admin
    INSERT INTO enterprise.user_organization_roles (
      user_id,
      organization_id,
      role_id,
      assigned_by
    ) VALUES (
      v_user.user_id,
      v_org_id,
      v_admin_role_id,
      v_user.user_id
    );
    
    RAISE NOTICE '  ✅ Assigned user as Admin';
    RAISE NOTICE '  ✨ User % fully set up!', v_user.email;
    RAISE NOTICE '';
    
    v_count := v_count + 1;
  END LOOP;
  
  IF v_count = 0 THEN
    RAISE NOTICE '✅ No users need fixing - all have organizations!';
  ELSE
    RAISE NOTICE '✨ Fixed % users!', v_count;
  END IF;
END $$;

-- Verify the fix
SELECT '=== VERIFICATION ===' as section;

SELECT 
  u.email,
  p.organization_id as has_org,
  o.display_name as org_name,
  r.name as role_name,
  CASE 
    WHEN p.organization_id IS NULL THEN '❌ Missing Org'
    WHEN uor.role_id IS NULL THEN '⚠️ Missing Role Assignment'
    ELSE '✅ All Good'
  END as status
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN enterprise.organizations o ON o.id = p.organization_id
LEFT JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
LEFT JOIN enterprise.organization_roles r ON r.id = uor.role_id
ORDER BY u.created_at DESC;
