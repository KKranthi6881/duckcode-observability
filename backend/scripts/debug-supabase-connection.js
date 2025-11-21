
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ../.env');
  process.exit(1);
}

console.log('Connecting to:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function testConnection() {
  try {
    // 1. Test public schema access
    console.log('\n--- Testing public schema ---');
    const { data: publicData, error: publicError } = await supabase
      .from('profiles') // Assuming profiles exists in public or is exposed
      .select('count')
      .limit(1);
      
    if (publicError) {
        console.log('Public schema access failed:', publicError.message);
    } else {
        console.log('Public schema access successful.');
    }

    // 2. Test enterprise schema access
    console.log('\n--- Testing enterprise schema ---');
    // We need to specify the schema for the client or use the schema() modifier if supported/configured
    // The JS client supports .schema('enterprise')
    
    const { data: entData, error: entError } = await supabase
      .schema('enterprise')
      .from('connectors')
      .select('count')
      .limit(1);

    if (entError) {
      console.error('Enterprise schema access failed:', entError);
      console.error('Details:', JSON.stringify(entError, null, 2));
    } else {
      console.log('Enterprise schema access successful.');
    }

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

testConnection();
