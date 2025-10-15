import { createClient } from '@supabase/supabase-js';

// Use local Supabase instance for development
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

console.log('[SupabaseClient] Connecting to:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Create admin client for user management
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Create client for code insights schema
export const supabaseCodeInsights = createClient(supabaseUrl, supabaseKey, {
  db: { 
    schema: 'code_insights' 
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Create client for duckcode schema (chat analytics)
export const supabaseDuckCode = createClient(supabaseUrl, supabaseKey, {
  db: { 
    schema: 'duckcode' 
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

// Create client for enterprise schema (organizations, teams, roles)
export const supabaseEnterprise = createClient(supabaseUrl, supabaseKey, {
  db: { 
    schema: 'enterprise' 
  },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

console.log('[SupabaseClient] supabaseAdmin initialized:', typeof supabaseAdmin, !!supabaseAdmin, Object.keys(supabaseAdmin));
console.log('[SupabaseClient] supabaseCodeInsights initialized:', typeof supabaseCodeInsights, !!supabaseCodeInsights, Object.keys(supabaseCodeInsights));
console.log('[SupabaseClient] supabaseDuckCode initialized:', typeof supabaseDuckCode, !!supabaseDuckCode, Object.keys(supabaseDuckCode));
console.log('[SupabaseClient] supabaseEnterprise initialized:', typeof supabaseEnterprise, !!supabaseEnterprise, Object.keys(supabaseEnterprise)); 