/**
 * Quick test script for Docker-based automatic extraction
 * 
 * Usage:
 *   node test-extraction-flow.js <connection-id> <access-token>
 * 
 * Example:
 *   node test-extraction-flow.js abc-123 eyJhbGc...
 */

const http = require('http');

const CONNECTION_ID = process.argv[2];
const ACCESS_TOKEN = process.argv[3];
const API_URL = 'http://localhost:3001';

if (!CONNECTION_ID || !ACCESS_TOKEN) {
  console.error('❌ Usage: node test-extraction-flow.js <connection-id> <access-token>');
  process.exit(1);
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function pollProgress() {
  const response = await makeRequest('GET', `/api/metadata/connections/${CONNECTION_ID}/progress`);
  return response.data;
}

async function main() {
  console.log('🧪 Testing Docker-based Automatic Extraction\n');
  console.log(`Connection ID: ${CONNECTION_ID}`);
  console.log(`API URL: ${API_URL}\n`);

  // Step 1: Trigger extraction
  console.log('1️⃣ Triggering extraction...');
  const triggerResponse = await makeRequest('POST', `/api/metadata/connections/${CONNECTION_ID}/extract`);
  
  if (triggerResponse.status === 202) {
    console.log('✅ Extraction started (202 Accepted)');
    console.log(JSON.stringify(triggerResponse.data, null, 2));
  } else {
    console.error('❌ Failed to start extraction:', triggerResponse);
    process.exit(1);
  }

  // Step 2: Poll progress
  console.log('\n2️⃣ Polling progress every 3 seconds...\n');
  
  let lastPhase = '';
  while (true) {
    const progress = await pollProgress();
    
    if (progress.phase !== lastPhase) {
      console.log(`\n📊 Phase: ${progress.phase.toUpperCase()}`);
      lastPhase = progress.phase;
    }
    
    const progressBar = '█'.repeat(Math.floor(progress.progress / 5)) + '░'.repeat(20 - Math.floor(progress.progress / 5));
    console.log(`   [${progressBar}] ${progress.progress}% - ${progress.message}`);
    
    if (progress.errors && progress.errors.length > 0) {
      console.error('\n❌ Errors:', progress.errors);
    }
    
    if (progress.phase === 'completed') {
      console.log('\n✅ Extraction completed successfully!');
      break;
    }
    
    if (progress.phase === 'failed') {
      console.error('\n❌ Extraction failed!');
      process.exit(1);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Step 3: Get statistics
  console.log('\n3️⃣ Fetching extraction statistics...');
  const statsResponse = await makeRequest('GET', `/api/metadata/connections/${CONNECTION_ID}/stats`);
  console.log(JSON.stringify(statsResponse.data, null, 2));

  // Step 4: Get lineage preview
  console.log('\n4️⃣ Fetching lineage preview...');
  const lineageResponse = await makeRequest('GET', `/api/metadata/connections/${CONNECTION_ID}/lineage`);
  
  if (lineageResponse.data.objects) {
    console.log(`\n📊 Found ${lineageResponse.data.objects.length} objects`);
    console.log(`📊 Found ${lineageResponse.data.dependencies.length} dependencies`);
    
    console.log('\nSample objects:');
    lineageResponse.data.objects.slice(0, 5).forEach(obj => {
      console.log(`  - ${obj.object_type}: ${obj.name}`);
    });
  }

  console.log('\n✅ Test complete!\n');
  console.log('🎯 Next steps:');
  console.log(`   - View in UI: http://localhost:5173/metadata/connections/${CONNECTION_ID}/extract`);
  console.log(`   - Check backend logs for Docker activity`);
  console.log(`   - Query database for detailed lineage data`);
}

main().catch(err => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
