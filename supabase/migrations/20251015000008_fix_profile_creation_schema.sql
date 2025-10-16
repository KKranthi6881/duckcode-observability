-- =====================================================
-- FIX: Remove public.profiles - Use duckcode schema only
-- =====================================================
-- We ONLY use duckcode.user_profiles (never public schema)
-- The enterprise trigger will reference duckcode.user_profiles
-- =====================================================

-- Keep the existing trigger - creates profiles ONLY in duckcode schema
CREATE OR REPLACE FUNCTION duckcode.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile in duckcode.user_profiles (our primary user table)
  INSERT INTO duckcode.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  RAISE NOTICE 'Created profile for user % in duckcode.user_profiles', NEW.email;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION duckcode.handle_new_user IS 
  'Creates user profile in duckcode.user_profiles';

-- Ensure the trigger is set up correctly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION duckcode.handle_new_user();
