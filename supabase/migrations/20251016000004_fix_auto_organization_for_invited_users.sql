-- =====================================================
-- FIX: Don't auto-create organization for invited users
-- =====================================================
-- Problem: The trigger auto_create_organization_for_user runs for ALL new users,
-- even those who are invited to existing organizations.
-- 
-- Solution: Only auto-create organization if user doesn't already have one
-- (i.e., organization_id is NULL when profile is created)
-- =====================================================

CREATE OR REPLACE FUNCTION enterprise.auto_create_organization_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  -- ✅ FIX: Only create organization if user doesn't already have one
  -- Invited users will have organization_id set when profile is created
  -- Only first-time registrations (org creators) will have NULL organization_id
  IF NEW.organization_id IS NOT NULL THEN
    RAISE NOTICE '✅ User % already has organization %, skipping auto-creation', NEW.id, NEW.organization_id;
    RETURN NEW;
  END IF;
  
  BEGIN
    -- Create personal organization for new user (first-time registration)
    v_org_id := enterprise.migrate_user_to_personal_organization(NEW.id);
    
    RAISE NOTICE '✅ Auto-created organization % for user % (first-time registration)', v_org_id, NEW.id;
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
  'Auto-creates personal organization ONLY for first-time registrations (when organization_id is NULL). Invited users skip this step.';

-- Note: No need to recreate trigger, just updating the function is enough
COMMENT ON TRIGGER trigger_auto_create_organization ON duckcode.user_profiles IS
  'Automatically creates organization and assigns Admin role ONLY for first-time registrations (organization_id IS NULL)';
