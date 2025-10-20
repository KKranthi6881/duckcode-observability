// Quick test script to trigger search indexing
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

console.log('🔑 Generated JWT token');
console.log('📋 Organization ID:', ORGANIZATION_ID);

// Trigger indexing
axios.post(
  'http://localhost:3002/api/v2/search/index',
  { organization_id: ORGANIZATION_ID },
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
)
.then(response => {
  console.log('✅ Success!', response.data);
})
.catch(error => {
  console.error('❌ Error:', error.response?.data || error.message);
});
