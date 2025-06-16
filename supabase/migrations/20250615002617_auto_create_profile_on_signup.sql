-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER -- Important for functions that write to tables with RLS
AS $$
BEGIN
  INSERT INTO public.profiles (id) -- Add email or other defaults if desired
  VALUES (NEW.id); -- NEW.id refers to the id of the new user in auth.users
  RETURN NEW;
END;
$$;

-- Trigger to call the function after a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();