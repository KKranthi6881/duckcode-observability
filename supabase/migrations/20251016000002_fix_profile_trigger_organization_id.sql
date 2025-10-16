-- Fix handle_new_user trigger to include organization_id from user metadata
-- This ensures profiles created via invitation acceptance have the correct organization

CREATE OR REPLACE FUNCTION duckcode.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create profile in duckcode.user_profiles (our primary user table)
  INSERT INTO duckcode.user_profiles (id, email, full_name, avatar_url, organization_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid
  );

  RAISE NOTICE 'Created profile for user % in duckcode.user_profiles with organization_id %', 
    NEW.email, 
    NULLIF(NEW.raw_user_meta_data->>'organization_id', '')::uuid;

  RETURN NEW;
END;
$$;

-- Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION duckcode.handle_new_user();

COMMENT ON FUNCTION duckcode.handle_new_user() IS 
  'Automatically create user profile when new user is created in Supabase Auth. Includes organization_id from user metadata for invitation flow.';
