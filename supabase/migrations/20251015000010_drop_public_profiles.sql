-- =====================================================
-- Drop public.profiles - We Use duckcode.user_profiles
-- =====================================================
-- The old public.profiles table is no longer needed
-- We exclusively use duckcode.user_profiles
-- =====================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can delete their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile." ON public.profiles;

-- Drop the table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop the associated function
DROP FUNCTION IF EXISTS public.handle_profile_update();

-- Drop the old trigger function (replaced by duckcode.handle_new_user)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

COMMENT ON SCHEMA public IS 
  'Public schema - no longer contains user profiles. Use duckcode.user_profiles instead.';
