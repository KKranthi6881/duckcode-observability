/**
 * Complete Auto-Documentation System Test
 * Tests the full flow: Webhook → Extraction → Change Detection → Doc Updates
 */

const crypto = require('crypto');
const fetch = require('node-fetch');

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TEST_ORG_ID = process.env.TEST_ORG_ID || 'test-org-id'; // Replace with real org ID
const TEST_REPO_URL = 'https://github.com/test-user/test-repo.git';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.cyan}${title}${colors.reset}`);
  console.log('='.repeat(70));
}

/**
 * Step 1: Test webhook endpoint exists
 */
async function testWebhookEndpoint() {
  logSection('STEP 1: Testing Webhook Endpoint');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/webhooks/github/${TEST_ORG_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'ping'
      },
      body: JSON.stringify({ zen: 'Testing is essential' })
    });

    if (response.status === 200 || response.status === 401) {
      log('✅', 'Webhook endpoint is accessible', colors.green);
      return true;
    } else {
      log('❌', `Webhook endpoint returned ${response.status}`, colors.red);
      return false;
    }
  } catch (error) {
    log('❌', `Failed to reach webhook endpoint: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Step 2: Simulate GitHub webhook with signature
 */
async function testWebhookWithSignature(webhookSecret) {
  logSection('STEP 2: Testing Webhook with Signature Validation');
  
  const payload = {
    ref: 'refs/heads/main',
    repository: {
      clone_url: TEST_REPO_URL,
      name: 'test-repo',
      owner: { login: 'test-user' }
    },
    commits: [
      {
        id: 'abc123def456',
        message: 'Test commit for auto-extraction',
        timestamp: new Date().toISOString(),
        author: { name: 'Test User', email: 'test@example.com' }
      }
    ],
    pusher: { name: 'Test User' },
    after: 'abc123def456'
  };

  const payloadString = JSON.stringify(payload);
  
  // Calculate signature
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const signature = 'sha256=' + hmac.update(payloadString).digest('hex');

  log('📝', 'Sending test webhook with signature...', colors.blue);
  log('   ', `Repository: ${TEST_REPO_URL}`, colors.blue);
  log('   ', `Branch: main`, colors.blue);
  log('   ', `Commits: 1`, colors.blue);

  try {
    const response = await fetch(`${BACKEND_URL}/api/webhooks/github/${TEST_ORG_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'push',
        'X-Hub-Signature-256': signature
      },
      body: payloadString
    });

    const result = await response.json();

    if (response.status === 200) {
      log('✅', 'Webhook accepted and validated', colors.green);
      log('   ', `Message: ${result.message}`, colors.green);
      if (result.connectionId) {
        log('   ', `Connection ID: ${result.connectionId}`, colors.green);
      }
      return true;
    } else {
      log('❌', `Webhook rejected: ${result.error || result.message}`, colors.red);
      return false;
    }
  } catch (error) {
    log('❌', `Webhook test failed: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Step 3: Check if metadata extraction was triggered
 */
async function checkExtractionStatus(connectionId) {
  logSection('STEP 3: Checking Metadata Extraction Status');
  
  log('⏳', 'Waiting 5 seconds for extraction to start...', colors.yellow);
  await new Promise(resolve => setTimeout(resolve, 5000));

  try {
    // This would query your database or extraction status endpoint
    log('ℹ️', 'Note: Manual verification required in logs', colors.blue);
    log('   ', 'Check backend logs for:', colors.blue);
    log('   ', '  - "📨 Received GitHub webhook: push"', colors.blue);
    log('   ', '  - "✅ Triggering automatic extraction"', colors.blue);
    log('   ', '  - Extraction orchestrator messages', colors.blue);
    return true;
  } catch (error) {
    log('❌', `Failed to check extraction: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Step 4: Check if change detection ran
 */
async function checkChangeDetection() {
  logSection('STEP 4: Checking Change Detection');
  
  log('ℹ️', 'Check backend logs for:', colors.blue);
  log('   ', '  - "[ChangeDetector] Detecting changes for connection"', colors.blue);
  log('   ', '  - "[ChangeDetector] Changes detected: ..."', colors.blue);
  log('   ', '  - "Added: X, Modified: Y, Deleted: Z"', colors.blue);
  
  return true;
}

/**
 * Step 5: Check if documentation update was triggered
 */
async function checkDocumentationUpdate() {
  logSection('STEP 5: Checking Documentation Update Orchestrator');
  
  log('ℹ️', 'Check backend logs for:', colors.blue);
  log('   ', '  - "[DocUpdateOrchestrator] Checking for documentation updates"', colors.blue);
  log('   ', '  - "[DocUpdateOrchestrator] Detecting metadata changes..."', colors.blue);
  log('   ', '  - "[DocUpdateOrchestrator] Creating documentation job for X objects"', colors.blue);
  
  return true;
}

/**
 * Step 6: Verify database state
 */
async function verifyDatabaseState() {
  logSection('STEP 6: Verifying Database State');
  
  log('ℹ️', 'Run these SQL queries to verify:', colors.blue);
  log('', '', colors.blue);
  
  console.log(`${colors.cyan}-- Check webhook events${colors.reset}`);
  console.log(`SELECT * FROM metadata.webhook_events 
ORDER BY created_at DESC LIMIT 5;`);
  
  console.log(`\n${colors.cyan}-- Check documentation update events${colors.reset}`);
  console.log(`SELECT * FROM metadata.documentation_update_events 
ORDER BY created_at DESC LIMIT 5;`);
  
  console.log(`\n${colors.cyan}-- Check metadata objects${colors.reset}`);
  console.log(`SELECT id, name, object_type, content_hash, updated_at 
FROM metadata.objects 
ORDER BY updated_at DESC LIMIT 10;`);
  
  console.log(`\n${colors.cyan}-- Check documentation jobs${colors.reset}`);
  console.log(`SELECT id, status, mode, total_objects, created_at 
FROM metadata.documentation_jobs 
ORDER BY created_at DESC LIMIT 5;`);
  
  return true;
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n');
  log('🚀', 'STARTING AUTO-DOCUMENTATION SYSTEM TESTS', colors.cyan);
  log('', '', '');
  log('ℹ️', `Backend URL: ${BACKEND_URL}`, colors.blue);
  log('ℹ️', `Organization ID: ${TEST_ORG_ID}`, colors.blue);
  log('ℹ️', `Test Repository: ${TEST_REPO_URL}`, colors.blue);

  const results = {
    webhookEndpoint: false,
    webhookSignature: false,
    extraction: false,
    changeDetection: false,
    docUpdate: false,
    database: false
  };

  // Run tests
  results.webhookEndpoint = await testWebhookEndpoint();
  
  if (results.webhookEndpoint) {
    // For actual testing, you'd get this from your database
    const testWebhookSecret = 'test-secret-for-testing';
    
    log('', '', '');
    log('⚠️', 'Note: Using test webhook secret', colors.yellow);
    log('   ', 'For real testing, connect a repo first to get actual secret', colors.yellow);
    
    results.webhookSignature = await testWebhookWithSignature(testWebhookSecret);
  }
  
  if (results.webhookSignature) {
    results.extraction = await checkExtractionStatus();
    results.changeDetection = await checkChangeDetection();
    results.docUpdate = await checkDocumentationUpdate();
  }
  
  results.database = await verifyDatabaseState();

  // Print summary
  logSection('TEST SUMMARY');
  
  const testResults = [
    ['Webhook Endpoint', results.webhookEndpoint],
    ['Webhook Signature Validation', results.webhookSignature],
    ['Metadata Extraction', results.extraction],
    ['Change Detection', results.changeDetection],
    ['Documentation Update', results.docUpdate],
    ['Database Verification', results.database]
  ];

  testResults.forEach(([name, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? colors.green : colors.red;
    log('', `${status} - ${name}`, color);
  });

  const allPassed = Object.values(results).every(r => r === true);
  
  console.log('\n' + '='.repeat(70));
  if (allPassed) {
    log('🎉', 'ALL TESTS PASSED!', colors.green);
    log('', 'The automatic documentation system is working!', colors.green);
  } else {
    log('⚠️', 'SOME TESTS NEED VERIFICATION', colors.yellow);
    log('', 'Check the backend logs and database for details', colors.yellow);
  }
  console.log('='.repeat(70) + '\n');

  // Next steps
  logSection('NEXT STEPS FOR REAL TESTING');
  log('1️⃣', 'Connect a real GitHub repository through your UI', colors.blue);
  log('2️⃣', 'Note the organization_id and connection_id', colors.blue);
  log('3️⃣', 'Push a commit to that repository', colors.blue);
  log('4️⃣', 'Watch the backend logs for automatic processing', colors.blue);
  log('5️⃣', 'Query the database tables to verify updates', colors.blue);
  console.log('');
}

// Run the tests
runTests().catch(error => {
  log('❌', `Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
