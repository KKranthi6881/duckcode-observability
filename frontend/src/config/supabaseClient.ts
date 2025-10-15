import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in .env file');
}

// Main Supabase client (defaults to public schema)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for duckcode schema (chat analytics)
export const supabaseDuckcode = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'duckcode'
  }
});

// Client for enterprise schema (organizations, teams, etc.)
export const supabaseEnterprise = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'enterprise'
  }
});
