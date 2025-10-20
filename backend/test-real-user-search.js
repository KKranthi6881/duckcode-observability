#!/usr/bin/env node
/**
 * Test with a real logged-in user
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const BACKEND_URL = 'http://localhost:3001';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function test() {
  console.log('🧪 Testing with Real User Session\n');

  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Check if there's an active session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('❌ No active session found!');
      console.log('   Please log in to the frontend first, then run this test again.');
      console.log('\n   Steps:');
      console.log('   1. Open http://localhost:5175 in browser');
      console.log('   2. Log in');
      console.log('   3. Run this test again');
      return;
    }

    console.log('✅ Active session found!');
    console.log('   User ID:', session.user.id);
    console.log('   User email:', session.user.email);
    console.log('   Token:', session.access_token.substring(0, 50) + '...\n');

    // Now test the search
    console.log('Testing search with real user token...');
    const response = await axios.get(`${BACKEND_URL}/api/search/metadata`, {
      params: {
        query: 'customer',
        limit: 5
      },
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    console.log('\n✅ Search successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

test();
