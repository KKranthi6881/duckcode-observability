#!/usr/bin/env node
/**
 * Test frontend search flow
 * Simulates what the frontend does when searching
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function test() {
  console.log('🧪 Testing Frontend Search Flow\n');

  try {
    // Step 1: Get a valid Supabase JWT (simulate logged-in user)
    console.log('Step 1: Simulating Supabase auth...');
    
    // For testing, we'll use the anon key as a placeholder
    // In reality, the frontend gets this from supabase.auth.getSession()
    const supabaseToken = SUPABASE_ANON_KEY;
    console.log(`   Token: ${supabaseToken.substring(0, 50)}...\n`);

    // Step 2: Call backend search endpoint (what frontend does)
    console.log('Step 2: Calling backend search endpoint...');
    console.log(`   URL: ${BACKEND_URL}/api/search/metadata?query=customer&limit=5`);
    
    const response = await axios.get(`${BACKEND_URL}/api/search/metadata`, {
      params: {
        query: 'customer',
        limit: 5
      },
      headers: {
        'Authorization': `Bearer ${supabaseToken}`
      }
    });

    console.log('\n✅ Search successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ Search failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

test();
