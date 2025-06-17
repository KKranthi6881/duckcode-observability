import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: SUPABASE_URL');
}
if (!supabaseServiceRoleKey) {
  // For backend operations, especially admin tasks like writing installation data,
  // we typically use the service_role key.
  throw new Error('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY');
}

// Create a single Supabase client for use in the backend
// We use the service_role key here to bypass RLS for admin-like operations.
// Be very careful with how this client is used.
const supabaseAdmin: SupabaseClient<any, 'github_module'> = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // autoRefreshToken: false, // Optional: a service role key does not expire
    // persistSession: false, // Optional: a service role does not have a session
  },
  db: {
    schema: 'github_module', // Specify the schema for all operations with this client
  }
});

export default supabaseAdmin;