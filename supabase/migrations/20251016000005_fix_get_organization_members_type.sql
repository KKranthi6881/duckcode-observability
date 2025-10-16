-- Fix get_organization_members function to handle varchar(255) email type
-- Issue: auth.users.email is varchar(255) but function expects TEXT

CREATE OR REPLACE FUNCTION enterprise.get_organization_members(p_organization_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_email TEXT,
  role_name TEXT,
  assigned_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::TEXT AS user_email,  -- Cast varchar(255) to TEXT
    r.display_name::TEXT AS role_name,  -- Cast to TEXT for consistency
    uor.assigned_at
  FROM auth.users u
  INNER JOIN enterprise.user_organization_roles uor ON uor.user_id = u.id
  INNER JOIN enterprise.organization_roles r ON r.id = uor.role_id
  WHERE uor.organization_id = p_organization_id
  ORDER BY uor.assigned_at DESC;
END;
$$;

COMMENT ON FUNCTION enterprise.get_organization_members IS 'Returns all members of an organization with their roles (fixed type casting)';
