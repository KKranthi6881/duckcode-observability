import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jtvqtfsezezsbykjwytv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dnF0ZnNlemV6c2J5a2p3eXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMDgyNTgsImV4cCI6MjA2NDU4NDI1OH0.MNcmVLBSiUVZmv0Dh_dT03r4AU2ST_4kGlhGoGoSqIo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to ensure the waitlist table exists
export async function ensureWaitlistTable() {
  try {
    // First check if the table exists by trying to select from it
    const { error: checkError } = await supabase
      .from('waitlist_entries')
      .select('id')
      .limit(1);
    
    // If there's no error, the table exists
    if (!checkError) {
      console.log('Waitlist table exists');
      return;
    }

    console.log('Creating waitlist_entries table...');
    
    // Create the table using SQL (requires storage-admin privileges)
    // Note: This won't work with the anon key, but we'll keep it here as a reference
    // You'll need to manually create the table in the Supabase dashboard
    
    console.log('Please create a table named "waitlist_entries" in your Supabase dashboard with the following columns:');
    console.log('- id: integer (primary key, auto-increment)');
    console.log('- name: text (required)');
    console.log('- organization: text (required)');
    console.log('- email: text (required, unique)');
    console.log('- phone: text (nullable)');
    console.log('- created_at: timestamp with timezone (default: now())');
    
    return false;
  } catch (err) {
    console.error('Error ensuring waitlist table:', err);
    return false;
  }
}
