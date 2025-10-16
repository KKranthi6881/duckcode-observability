-- =====================================================
-- PERMANENT FIX: Prevent Duplicate Organizations
-- =====================================================
-- Problem: migrate_user_to_personal_organization doesn't check
-- if an organization for this user's email pattern already exists.
-- 
-- Solution: Check for existing org before creating new one
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
  v_org_name TEXT;
  v_retry_count INT := 0;
  v_max_retries INT := 10;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  RAISE NOTICE 'migrate_user_to_personal_organization: Processing user %', v_user_email;
  
  -- ✅ FIX 1: Check if user already has an organization in their profile
  SELECT organization_id INTO v_org_id
  FROM duckcode.user_profiles
  WHERE id = p_user_id
    AND organization_id IS NOT NULL;
  
  IF v_org_id IS NOT NULL THEN
    RAISE NOTICE '✅ User % already has organization % in profile, reusing it', v_user_email, v_org_id;
    RETURN v_org_id;
  END IF;
  
  -- ✅ FIX 2: Check if an organization with this user's name pattern already exists
  -- This prevents duplicates if user is recreated after deletion
  v_org_name := regexp_replace(lower(v_user_email), '[^a-z0-9]', '_', 'g') || '_org';
  
  SELECT id INTO v_org_id
  FROM enterprise.organizations
  WHERE name = v_org_name
  LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    RAISE NOTICE '✅ Found existing organization % with name %, reusing it', v_org_id, v_org_name;
    
    -- Update the user's profile to point to this organization
    UPDATE duckcode.user_profiles
    SET organization_id = v_org_id
    WHERE id = p_user_id;
    
    -- Check if user already has a role in this org
    IF NOT EXISTS (
      SELECT 1 FROM enterprise.user_organization_roles
      WHERE user_id = p_user_id AND organization_id = v_org_id
    ) THEN
      -- Get Admin role
      SELECT id INTO v_admin_role_id
      FROM enterprise.organization_roles
      WHERE organization_id = v_org_id AND name = 'Admin'
      LIMIT 1;
      
      IF v_admin_role_id IS NOT NULL THEN
        -- Assign user as admin
        INSERT INTO enterprise.user_organization_roles (
          user_id, organization_id, role_id, assigned_by
        ) VALUES (
          p_user_id, v_org_id, v_admin_role_id, p_user_id
        );
        RAISE NOTICE '✅ Assigned user % as Admin in existing organization %', v_user_email, v_org_id;
      END IF;
    END IF;
    
    RETURN v_org_id;
  END IF;
  
  -- ✅ FIX 3: Create new organization (only if none exists)
  BEGIN
    INSERT INTO enterprise.organizations (
      name,
      display_name,
      plan_type,
      status
    ) VALUES (
      v_org_name,
      v_user_email || '''s Organization',
      'trial',
      'active'
    )
    RETURNING id INTO v_org_id;
    
    RAISE NOTICE '✅ Created NEW organization % for user %', v_org_id, v_user_email;
  EXCEPTION 
    WHEN unique_violation THEN
      -- Race condition: another process created the org between our check and insert
      RAISE NOTICE '⚠️  Organization already exists (race condition), fetching it';
      SELECT id INTO v_org_id
      FROM enterprise.organizations
      WHERE name = v_org_name
      LIMIT 1;
      
      IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create or find organization for %', v_user_email;
      END IF;
      
      -- Update profile and continue
      UPDATE duckcode.user_profiles
      SET organization_id = v_org_id
      WHERE id = p_user_id;
      
      RETURN v_org_id;
    WHEN OTHERS THEN
      RAISE EXCEPTION 'Failed to create organization: %', SQLERRM;
  END;
  
  -- Wait for Admin role to be created (with retry logic)
  LOOP
    SELECT id INTO v_admin_role_id
    FROM enterprise.organization_roles
    WHERE organization_id = v_org_id AND name = 'Admin';
    
    IF v_admin_role_id IS NOT NULL THEN
      RAISE NOTICE 'Found Admin role % after % attempts', v_admin_role_id, v_retry_count + 1;
      EXIT;
    END IF;
    
    v_retry_count := v_retry_count + 1;
    
    IF v_retry_count >= v_max_retries THEN
      RAISE WARNING 'Roles not created by trigger after % attempts, creating manually', v_max_retries;
      
      INSERT INTO enterprise.organization_roles (organization_id, name, display_name, permissions, is_default)
      VALUES 
        (v_org_id, 'Admin', 'Administrator', '["*"]'::jsonb, true),
        (v_org_id, 'Member', 'Member', '["metadata:read", "teams:read"]'::jsonb, true)
      ON CONFLICT (organization_id, name) DO NOTHING
      RETURNING id INTO v_admin_role_id;
      
      -- If RETURNING didn't work (conflict), fetch it
      IF v_admin_role_id IS NULL THEN
        SELECT id INTO v_admin_role_id
        FROM enterprise.organization_roles
        WHERE organization_id = v_org_id AND name = 'Admin';
      END IF;
      
      RAISE NOTICE 'Manually created roles, Admin role: %', v_admin_role_id;
      EXIT;
    END IF;
    
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  IF v_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Failed to get or create Admin role for organization %', v_org_id;
  END IF;
  
  -- Assign user as admin
  BEGIN
    INSERT INTO enterprise.user_organization_roles (
      user_id, organization_id, role_id, assigned_by
    ) VALUES (
      p_user_id, v_org_id, v_admin_role_id, p_user_id
    );
    
    RAISE NOTICE '✅ Assigned user % as Admin in organization %', v_user_email, v_org_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '⚠️  User % already has a role in organization %', v_user_email, v_org_id;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to assign role: %', SQLERRM;
  END;
  
  -- Update profile with organization
  UPDATE duckcode.user_profiles
  SET organization_id = v_org_id
  WHERE id = p_user_id;
  
  RAISE NOTICE '✅ Successfully set up organization for user %', v_user_email;
  
  RETURN v_org_id;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'migrate_user_to_personal_organization failed for user %: %', p_user_id, SQLERRM;
END;
$$;

COMMENT ON FUNCTION enterprise.migrate_user_to_personal_organization IS 
  'Creates or reuses personal organization for user - prevents duplicates by checking existing orgs by name pattern';

-- ✅ Add unique constraint on organization name to prevent duplicates at DB level
ALTER TABLE enterprise.organizations 
ADD CONSTRAINT organizations_name_unique UNIQUE (name);

COMMENT ON CONSTRAINT organizations_name_unique ON enterprise.organizations IS
  'Prevents duplicate organizations with the same name (important for user personal orgs)';
