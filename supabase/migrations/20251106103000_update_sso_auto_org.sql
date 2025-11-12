BEGIN;

CREATE OR REPLACE FUNCTION enterprise.auto_create_organization_for_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_user_email TEXT;
  v_domain TEXT;
  v_connection_role UUID;
BEGIN
  -- Look up the user's email and derive the domain
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.id;

  IF v_user_email IS NOT NULL AND position('@' IN v_user_email) > 0 THEN
    v_domain := lower(split_part(v_user_email, '@', 2));
  END IF;

  IF v_domain IS NOT NULL THEN
    -- If the domain is claimed by an organization, attach the new user to that org
    SELECT sd.organization_id,
           COALESCE(sc.default_role_id, NULL)
      INTO v_org_id, v_connection_role
      FROM enterprise.sso_domains sd
      LEFT JOIN enterprise.sso_connections sc ON sc.id = sd.connection_id
     WHERE lower(sd.domain_name) = v_domain
       AND sd.is_verified = TRUE
     ORDER BY COALESCE(sd.verified_at, sd.created_at) DESC
     LIMIT 1;
  END IF;

  IF v_org_id IS NOT NULL THEN
    -- Update the user profile with the existing organization
    UPDATE duckcode.user_profiles
       SET organization_id = v_org_id
     WHERE id = NEW.id;

    -- Determine a role to assign (connection default, Member, else Admin)
    IF v_connection_role IS NULL THEN
      SELECT id INTO v_connection_role
        FROM enterprise.organization_roles
       WHERE organization_id = v_org_id
       ORDER BY CASE WHEN name = 'Member' THEN 1
                     WHEN name = 'Admin' THEN 2
                     ELSE 3 END
       LIMIT 1;
    END IF;

    IF v_connection_role IS NOT NULL THEN
      INSERT INTO enterprise.user_organization_roles (user_id, organization_id, role_id, assigned_by)
      SELECT NEW.id, v_org_id, v_connection_role, NEW.id
      WHERE NOT EXISTS (
        SELECT 1 FROM enterprise.user_organization_roles
        WHERE user_id = NEW.id AND organization_id = v_org_id
      );
    END IF;

    RETURN NEW;
  END IF;

  -- Fallback: create personal organization as before
  BEGIN
    PERFORM enterprise.migrate_user_to_personal_organization(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to auto-create organization for user %: %', NEW.id, SQLERRM;
    RAISE;
  END;

  RETURN NEW;
END;
$$;

COMMIT;
