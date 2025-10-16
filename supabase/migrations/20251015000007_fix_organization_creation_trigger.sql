-- =====================================================
-- FIX: Organization Creation Trigger (Robust Version)
-- =====================================================
-- Fixes race condition and ensures organization + roles
-- are created properly when user registers
-- =====================================================

-- Drop and recreate the function with better error handling
CREATE OR REPLACE FUNCTION enterprise.migrate_user_to_personal_organization(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_org_id UUID;
  v_admin_role_id UUID;
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
  
  -- Check if user already has an organization
  SELECT organization_id INTO v_org_id
  FROM duckcode.user_profiles
  WHERE id = p_user_id
    AND organization_id IS NOT NULL;
  
  IF v_org_id IS NOT NULL THEN
    RAISE NOTICE 'User % already has organization %', v_user_email, v_org_id;
    RETURN v_org_id;
  END IF;
  
  -- Create personal organization
  BEGIN
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
    
    RAISE NOTICE 'Created organization % for user %', v_org_id, v_user_email;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create organization: %', SQLERRM;
  END;
  
  -- The trigger_create_default_roles will fire AFTER the organization INSERT
  -- We need to wait for it to complete before trying to assign the Admin role
  
  -- Wait for Admin role to be created (with retry logic)
  LOOP
    -- Try to get Admin role ID
    SELECT id INTO v_admin_role_id
    FROM enterprise.organization_roles
    WHERE organization_id = v_org_id
      AND name = 'Admin';
    
    -- If found, break the loop
    IF v_admin_role_id IS NOT NULL THEN
      RAISE NOTICE 'Found Admin role % after % attempts', v_admin_role_id, v_retry_count + 1;
      EXIT;
    END IF;
    
    -- Increment retry counter
    v_retry_count := v_retry_count + 1;
    
    -- If we've waited too long, create roles manually
    IF v_retry_count >= v_max_retries THEN
      RAISE WARNING 'Roles not created by trigger after % attempts, creating manually', v_max_retries;
      
      -- Create roles manually as fallback
      INSERT INTO enterprise.organization_roles (organization_id, name, display_name, permissions, is_default)
      VALUES 
        (v_org_id, 'Admin', 'Administrator', '["*"]'::jsonb, true),
        (v_org_id, 'Member', 'Member', '["metadata:read", "teams:read"]'::jsonb, true),
        (v_org_id, 'Viewer', 'Viewer', '["metadata:read"]'::jsonb, true)
      RETURNING id INTO v_admin_role_id;
      
      RAISE NOTICE 'Manually created 3 roles, Admin role: %', v_admin_role_id;
      EXIT;
    END IF;
    
    -- Wait 100ms before retrying
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  -- Verify we have the admin role ID
  IF v_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Failed to get or create Admin role for organization %', v_org_id;
  END IF;
  
  -- Assign user as admin
  BEGIN
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
    
    RAISE NOTICE 'Assigned user % as Admin in organization %', v_user_email, v_org_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'User % already has a role in organization %', v_user_email, v_org_id;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to assign role: %', SQLERRM;
  END;
  
  -- Update profile with organization
  UPDATE duckcode.user_profiles
  SET organization_id = v_org_id
  WHERE id = p_user_id;
  
  RAISE NOTICE 'Updated profile for user % with organization %', v_user_email, v_org_id;
  
  -- Note: GitHub installations migration removed - new users won't have installations yet
  -- Existing installations can be migrated separately if needed
  
  RAISE NOTICE '✅ Successfully set up organization for user %', v_user_email;
  
  RETURN v_org_id;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail silently
  RAISE EXCEPTION 'migrate_user_to_personal_organization failed for user %: %', p_user_id, SQLERRM;
END;
$$;

COMMENT ON FUNCTION enterprise.migrate_user_to_personal_organization IS 
  'Migrates user to their own personal organization with robust error handling and retry logic';

-- Ensure the trigger function has proper error handling too
CREATE OR REPLACE FUNCTION enterprise.auto_create_organization_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  BEGIN
    -- Create personal organization for new user
    v_org_id := enterprise.migrate_user_to_personal_organization(NEW.id);
    
    RAISE NOTICE '✅ Auto-created organization % for user %', v_org_id, NEW.id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't prevent user creation
    RAISE WARNING '❌ Failed to auto-create organization for user %: %', NEW.id, SQLERRM;
    -- Re-raise to make it visible
    RAISE;
  END;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enterprise.auto_create_organization_for_user IS 
  'Auto-creates personal organization when new user signs up (with error handling)';

-- Ensure trigger is properly set up on duckcode.user_profiles
DROP TRIGGER IF EXISTS trigger_auto_create_organization ON duckcode.user_profiles;
CREATE TRIGGER trigger_auto_create_organization
  AFTER INSERT ON duckcode.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.auto_create_organization_for_user();

COMMENT ON TRIGGER trigger_auto_create_organization ON duckcode.user_profiles IS
  'Automatically creates organization and assigns Admin role when user registers';
