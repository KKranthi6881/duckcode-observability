-- Fix orphaned users (users with organizations but no role assignments)
--
-- This script finds users who have an organization_id in their profile
-- but are missing from user_organization_roles table, and assigns them
-- as Admin.

DO $$
DECLARE
  v_user RECORD;
  v_admin_role_id UUID;
  v_count INT := 0;
BEGIN
  -- Loop through orphaned users
  FOR v_user IN (
    SELECT 
      p.id as user_id,
      p.organization_id,
      u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    LEFT JOIN enterprise.user_organization_roles uor ON uor.user_id = p.id
    WHERE p.organization_id IS NOT NULL
      AND uor.id IS NULL
  )
  LOOP
    -- Get Admin role for this organization
    SELECT id INTO v_admin_role_id
    FROM enterprise.organization_roles
    WHERE organization_id = v_user.organization_id
      AND name = 'Admin'
    LIMIT 1;
    
    IF v_admin_role_id IS NOT NULL THEN
      -- Assign user as Admin
      INSERT INTO enterprise.user_organization_roles (
        user_id,
        organization_id,
        role_id,
        assigned_by
      ) VALUES (
        v_user.user_id,
        v_user.organization_id,
        v_admin_role_id,
        v_user.user_id  -- Self-assigned
      );
      
      v_count := v_count + 1;
      RAISE NOTICE 'Fixed user %: assigned Admin role', v_user.email;
    ELSE
      RAISE WARNING 'No Admin role found for organization % (user %)', 
        v_user.organization_id, v_user.email;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Fixed % orphaned users', v_count;
END $$;

-- Verify the fix
SELECT 
  u.email,
  o.name as org_name,
  r.name as role_name
FROM enterprise.user_organization_roles uor
JOIN auth.users u ON u.id = uor.user_id
JOIN enterprise.organizations o ON o.id = uor.organization_id
JOIN enterprise.organization_roles r ON r.id = uor.role_id
ORDER BY uor.created_at DESC;
