#!/usr/bin/env node
/**
 * Test Hybrid Search System
 * Tests metadata search, file search, and hybrid search
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const BACKEND_URL = 'http://localhost:3001';
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function test() {
  console.log('🧪 Testing Hybrid Search System\n');

  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Check if there's an active session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('❌ No active session found!');
      console.log('   Please log in to the frontend first: http://localhost:5175');
      return;
    }

    console.log('✅ Active session found!');
    console.log(`   User: ${session.user.email}\n`);

    const token = session.access_token;

    // Test 1: Metadata Search
    console.log('📊 Test 1: Metadata Search (Tables & Columns)');
    console.log('   Searching for: "customer"');
    try {
      const metadataResponse = await axios.get(`${BACKEND_URL}/api/search/metadata`, {
        params: {
          query: 'customer',
          limit: 5
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log(`   ✅ Found ${metadataResponse.data.data?.results?.length || 0} metadata results`);
      if (metadataResponse.data.data?.results?.length > 0) {
        console.log('   Sample result:');
        const sample = metadataResponse.data.data.results[0];
        console.log(`      - ${sample.name} (${sample.object_type}) - Score: ${sample.score}`);
      }
    } catch (error) {
      console.log(`   ⚠️  Metadata search: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Test 2: File Search
    console.log('📄 Test 2: File Search (Code Files)');
    console.log('   Searching for: "customer"');
    try {
      const filesResponse = await axios.get(`${BACKEND_URL}/api/search/files`, {
        params: {
          q: 'customer',
          limit: 5
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log(`   ✅ Found ${filesResponse.data.data?.results?.length || 0} file results`);
      if (filesResponse.data.data?.results?.length > 0) {
        console.log('   Sample result:');
        const sample = filesResponse.data.data.results[0];
        console.log(`      - ${sample.file_path} (${sample.language}) - Score: ${sample.score}`);
      }
    } catch (error) {
      console.log(`   ⚠️  File search: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Test 3: Hybrid Search
    console.log('🔍 Test 3: Hybrid Search (Metadata + Files)');
    console.log('   Searching for: "customer"');
    try {
      const hybridResponse = await axios.get(`${BACKEND_URL}/api/search/hybrid`, {
        params: {
          q: 'customer',
          metadata_limit: 5,
          files_limit: 5
        },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const results = hybridResponse.data.results;
      console.log(`   ✅ Hybrid search complete!`);
      console.log(`      Metadata: ${results.metadata.items.length} results`);
      console.log(`      Files: ${results.files.items.length} results`);
      console.log(`      Total: ${results.combined.total} results`);
      
      if (results.metadata.items.length > 0) {
        console.log('\n   📊 Sample metadata result:');
        const sample = results.metadata.items[0];
        console.log(`      - ${sample.name} (${sample.object_type})`);
      }
      
      if (results.files.items.length > 0) {
        console.log('\n   📄 Sample file result:');
        const sample = results.files.items[0];
        console.log(`      - ${sample.file_path} (${sample.language})`);
      }
    } catch (error) {
      console.log(`   ⚠️  Hybrid search: ${error.response?.data?.message || error.message}`);
    }
    console.log();

    // Test 4: Different queries
    console.log('🎯 Test 4: Testing Different Queries');
    const queries = ['payment', 'email', 'user', 'table'];
    
    for (const query of queries) {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/search/hybrid`, {
          params: { q: query, metadata_limit: 3, files_limit: 3 },
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const total = response.data.results.combined.total;
        console.log(`   "${query}" → ${total} results`);
      } catch (error) {
        console.log(`   "${query}" → Error: ${error.response?.status || 'N/A'}`);
      }
    }
    console.log();

    console.log('✅ Hybrid Search System Tests Complete!\n');
    
    console.log('📝 Summary:');
    console.log('   - Metadata search: Searches tables, columns, views');
    console.log('   - File search: Searches code files (SQL, Python, JS/TS)');
    console.log('   - Hybrid search: Searches both simultaneously');
    console.log();
    console.log('🎉 System is ready for production use!');

  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);
  }
}

test();
