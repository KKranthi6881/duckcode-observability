/**
 * Test script to manually trigger Tantivy indexing
 * This helps debug why indexes aren't being created after metadata extraction
 */

require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');

const TANTIVY_URL = process.env.TANTIVY_SERVICE_URL || 'http://localhost:3002';
const JWT_SECRET = process.env.JWT_SECRET;
const ORG_ID = 'a6feee1a-47c7-4256-bb34-a3fb2c269cc1'; // Replace with your org ID

console.log('🧪 Testing Tantivy Indexing Integration\n');
console.log('Configuration:');
console.log(`  Tantivy URL: ${TANTIVY_URL}`);
console.log(`  JWT Secret: ${JWT_SECRET ? '✅ Configured' : '❌ Missing'}`);
console.log(`  Organization ID: ${ORG_ID}\n`);

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET not found in .env file!');
  console.error('   Please add JWT_SECRET to backend/.env');
  process.exit(1);
}

// Generate service JWT token (same as backend)
function generateServiceToken(organizationId) {
  const payload = {
    sub: 'backend-service',
    organization_id: organizationId,
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300 // 5 minutes
  };
  
  return jwt.sign(payload, JWT_SECRET);
}

async function testIndexing() {
  try {
    console.log('1️⃣ Checking Tantivy service health...');
    const healthResponse = await axios.get(`${TANTIVY_URL}/api/v2/search/health`);
    console.log('   ✅ Service is healthy:', healthResponse.data);
    console.log('');

    console.log('2️⃣ Generating JWT token...');
    const token = generateServiceToken(ORG_ID);
    console.log(`   ✅ Token generated (first 30 chars): ${token.substring(0, 30)}...`);
    console.log('');

    console.log('3️⃣ Triggering index creation...');
    const indexResponse = await axios.post(
      `${TANTIVY_URL}/api/v2/search/index`,
      { organization_id: ORG_ID },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    console.log('   ✅ Indexing response:', JSON.stringify(indexResponse.data, null, 2));
    console.log('');

    if (indexResponse.data.success) {
      console.log('✅ SUCCESS! Index created successfully!');
      console.log(`   Objects indexed: ${indexResponse.data.objects_indexed}`);
      console.log(`   Check Supabase Storage bucket: tantivy-indexes`);
      console.log(`   Look for folder: ${ORG_ID}/`);
    } else {
      console.log('⚠️  Indexing completed but returned unsuccessful response');
    }

  } catch (error) {
    console.error('❌ Test failed!');
    if (axios.isAxiosError(error)) {
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Message: ${error.response?.data?.message || error.message}`);
      console.error(`   URL: ${error.config?.url}`);
      if (error.response?.data) {
        console.error(`   Response data:`, JSON.stringify(error.response.data, null, 2));
      }
    } else {
      console.error(`   Error:`, error.message);
    }
    process.exit(1);
  }
}

// Run the test
testIndexing();
