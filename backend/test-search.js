// Test search functionality
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
const ORGANIZATION_ID = '7c52e02a-4f13-45a2-87d3-6eefc2b2f2af';

// Generate service token
const token = jwt.sign(
  {
    sub: 'backend-service',
    organization_id: ORGANIZATION_ID,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300
  },
  JWT_SECRET
);

console.log('🔍 Testing Search Functionality\n');

// Test 1: Simple search
console.log('Test 1: Searching for "customer"...');
axios.get(
  'http://localhost:3002/api/v2/search/query?q=customer&limit=5',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
)
.then(response => {
  console.log('✅ Search successful!');
  console.log('   Results:', response.data.total);
  if (response.data.results.length > 0) {
    console.log('   Top result:', response.data.results[0].name);
    console.log('   Score:', response.data.results[0].score);
  }
  console.log('');
  
  // Test 2: Search with object type filter
  console.log('Test 2: Searching for "table" (filtered by type)...');
  return axios.get(
    'http://localhost:3002/api/v2/search/query?q=table&object_type=table&limit=3',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
})
.then(response => {
  console.log('✅ Filtered search successful!');
  console.log('   Results:', response.data.total);
  if (response.data.results.length > 0) {
    response.data.results.forEach((r, i) => {
      console.log(`   ${i+1}. ${r.name} (${r.object_type}) - Score: ${r.score}`);
    });
  }
  console.log('');
  
  // Test 3: Autocomplete
  console.log('Test 3: Autocomplete for "cust"...');
  return axios.get(
    'http://localhost:3002/api/v2/search/autocomplete?prefix=cust&limit=5',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
})
.then(response => {
  console.log('✅ Autocomplete successful!');
  console.log('   Suggestions:', response.data.suggestions);
  console.log('');
  
  // Test 4: Index stats
  console.log('Test 4: Getting index stats...');
  return axios.get(
    'http://localhost:3002/api/v2/search/stats',
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
})
.then(response => {
  console.log('✅ Stats retrieved!');
  console.log('   Documents:', response.data.document_count);
  console.log('   Size:', response.data.size_bytes, 'bytes');
  console.log('   Version:', response.data.version);
  console.log('');
  console.log('🎉 All tests passed!');
})
.catch(error => {
  console.error('❌ Error:', error.response?.data || error.message);
});
