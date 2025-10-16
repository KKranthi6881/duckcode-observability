-- =====================================================
-- FIX: User Role Assignment Race Condition
-- =====================================================
-- The migrate_user_to_personal_organization function was trying
-- to get the Admin role before the trigger created it.
-- This fixes the race condition by waiting for the role to exist.
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
  v_retry_count INT := 0;
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
  FROM duckcode.user_profiles
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
  
  -- Wait for the trigger to create roles (with retry logic)
  -- The trigger_create_default_roles runs AFTER INSERT
  LOOP
    -- Try to get Admin role ID
    SELECT id INTO v_admin_role_id
    FROM enterprise.organization_roles
    WHERE organization_id = v_org_id
      AND name = 'Admin';
    
    -- If found, break the loop
    EXIT WHEN v_admin_role_id IS NOT NULL;
    
    -- Increment retry counter
    v_retry_count := v_retry_count + 1;
    
    -- If roles still don't exist after waiting, something is wrong
    IF v_retry_count > 5 THEN
      RAISE EXCEPTION 'Failed to create roles for organization %', v_org_id;
    END IF;
    
    -- Wait a bit and retry (PostgreSQL sleep in milliseconds)
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RAISE NOTICE 'Found Admin role % after % attempts', v_admin_role_id, v_retry_count;
  
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
  UPDATE duckcode.user_profiles
  SET organization_id = v_org_id
  WHERE id = p_user_id;
  
  -- Note: GitHub installations migration removed - new users won't have installations yet
  -- Existing installations can be migrated separately if needed
  
  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION enterprise.migrate_user_to_personal_organization IS 'Migrates existing user to their own personal organization with retry logic for role creation';
