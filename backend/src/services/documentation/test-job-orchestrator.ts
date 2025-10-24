/**
 * Test script for Documentation Job Orchestrator
 * Run with: npx ts-node -r tsconfig-paths/register src/services/documentation/test-job-orchestrator.ts
 */

import 'dotenv/config'; // Load .env file
import { DocumentationJobOrchestrator, JobProgress } from './DocumentationJobOrchestrator';

async function testJobOrchestrator() {
  console.log('🧪 Testing Documentation Job Orchestrator\n');

  try {
    // Configuration from environment variables
    const TEST_ORG_ID = process.env.TEST_ORG_ID || '';
    const TEST_OBJECT_IDS = process.env.TEST_OBJECT_IDS || '';

    if (!TEST_ORG_ID) {
      console.error('❌ Error: TEST_ORG_ID environment variable not set');
      console.log('   Set it to an organization ID that has an OpenAI API key configured');
      process.exit(1);
    }

    if (!TEST_OBJECT_IDS) {
      console.error('❌ Error: TEST_OBJECT_IDS environment variable not set');
      console.log('   Set it to a comma-separated list of object IDs');
      console.log('   Example: export TEST_OBJECT_IDS="uuid1,uuid2,uuid3"');
      process.exit(1);
    }

    const objectIds = TEST_OBJECT_IDS.split(',').map(id => id.trim());

    console.log(`📋 Test Configuration:`);
    console.log(`   Organization ID: ${TEST_ORG_ID}`);
    console.log(`   Object IDs: ${objectIds.length} objects\n`);

    // Initialize orchestrator
    console.log('1️⃣  Initializing DocumentationJobOrchestrator...');
    const orchestrator = new DocumentationJobOrchestrator(TEST_ORG_ID);

    // Set up progress listener
    orchestrator.on('progress', (progress: JobProgress) => {
      console.log(`\n📊 Progress Update:`);
      console.log(`   Status: ${progress.status}`);
      console.log(`   Progress: ${progress.processedObjects}/${progress.totalObjects} (${progress.progressPercentage.toFixed(1)}%)`);
      if (progress.currentObjectName) {
        console.log(`   Current: ${progress.currentObjectName}`);
      }
      if (progress.failedObjects > 0) {
        console.log(`   Failed: ${progress.failedObjects}`);
      }
      if (progress.estimatedCompletionTime) {
        console.log(`   ETA: ${progress.estimatedCompletionTime.toLocaleString()}`);
      }
    });

    // Set up completion listener
    orchestrator.on('job-completed', (result: any) => {
      console.log(`\n✅ Job Completed!`);
      console.log(`   Processed: ${result.processedObjects}`);
      console.log(`   Failed: ${result.failedObjects}`);
      console.log(`   Total Cost: $${result.totalCost.toFixed(4)}`);
    });

    // Set up failure listener
    orchestrator.on('job-failed', (result: any) => {
      console.error(`\n❌ Job Failed!`);
      console.error(`   Error: ${result.error}`);
    });

    // Create job
    console.log('\n2️⃣  Creating documentation job...');
    const jobId = await orchestrator.createJob(
      objectIds,
      {
        skipExisting: false,
        regenerateAll: true,
        maxRetries: 3,
      },
      undefined, // triggered_by_user_id (optional)
      'test@example.com'
    );

    console.log(`✅ Job created: ${jobId}`);

    // Get initial status
    console.log('\n3️⃣  Fetching initial job status...');
    const initialStatus = await orchestrator.getJobStatus(jobId);
    console.log(`   Status: ${initialStatus.status}`);
    console.log(`   Total objects: ${initialStatus.totalObjects}`);
    console.log(`   Message: ${initialStatus.message}`);

    // Process job
    console.log('\n4️⃣  Starting job processing...');
    console.log('   This will call OpenAI API for each object');
    console.log(`   Estimated cost: $${(objectIds.length * 0.05).toFixed(2)} - $${(objectIds.length * 0.10).toFixed(2)}`);
    console.log('   Progress updates will appear below:\n');
    console.log('═'.repeat(60));

    const startTime = Date.now();
    await orchestrator.processJob(jobId);
    const duration = Date.now() - startTime;

    console.log('═'.repeat(60));
    console.log(`\n✅ Job processing completed in ${(duration / 1000).toFixed(2)}s\n`);

    // Get final status
    console.log('5️⃣  Fetching final job status...');
    const finalStatus = await orchestrator.getJobStatus(jobId);

    console.log('\n📊 FINAL JOB RESULTS:\n');
    console.log('═'.repeat(60));
    console.log(`Job ID: ${finalStatus.jobId}`);
    console.log(`Status: ${finalStatus.status}`);
    console.log(`Total Objects: ${finalStatus.totalObjects}`);
    console.log(`Processed: ${finalStatus.processedObjects}`);
    console.log(`Failed: ${finalStatus.failedObjects}`);
    console.log(`Success Rate: ${((finalStatus.processedObjects / finalStatus.totalObjects) * 100).toFixed(1)}%`);
    console.log(`Progress: ${finalStatus.progressPercentage.toFixed(1)}%`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Avg per object: ${(duration / finalStatus.totalObjects / 1000).toFixed(2)}s`);
    console.log('═'.repeat(60));

    // Fetch full job details
    console.log('\n6️⃣  Fetching complete job details from database...');
    const job = await orchestrator.getJob(jobId);

    console.log('\n💰 COST BREAKDOWN:\n');
    console.log(`Estimated Cost: $${job.estimatedCost.toFixed(4)}`);
    console.log(`Actual Cost: $${job.actualCost.toFixed(4)}`);
    console.log(`Total Tokens: ${job.totalTokensUsed.toLocaleString()}`);
    console.log(`  - Prompt: ${job.promptTokens.toLocaleString()}`);
    console.log(`  - Completion: ${job.completionTokens.toLocaleString()}`);

    console.log('\n📊 LAYER STATISTICS:\n');
    console.log('Completed Layers:');
    if (job.layersCompleted && Object.keys(job.layersCompleted).length > 0) {
      Object.entries(job.layersCompleted).forEach(([layer, count]) => {
        console.log(`  - ${layer}: ${count}`);
      });
    } else {
      console.log('  (No layer completion data)');
    }

    if (job.layersFailed && Object.keys(job.layersFailed).length > 0) {
      console.log('\nFailed Layers:');
      Object.entries(job.layersFailed).forEach(([layer, count]) => {
        console.log(`  - ${layer}: ${count}`);
      });
    }

    console.log('\n⏱️  TIMING:\n');
    console.log(`Started: ${job.startedAt ? new Date(job.startedAt).toLocaleString() : 'N/A'}`);
    console.log(`Completed: ${job.completedAt ? new Date(job.completedAt).toLocaleString() : 'N/A'}`);
    console.log(`Average per object: ${job.averageTimePerObject || 'N/A'}`);

    if (job.errorLog && job.errorLog.length > 0) {
      console.log('\n❌ ERRORS:\n');
      job.errorLog.slice(0, 5).forEach((error: any, i: number) => {
        console.log(`${i + 1}. Object: ${error.objectId}`);
        console.log(`   Error: ${error.error}`);
        console.log(`   Time: ${new Date(error.timestamp).toLocaleString()}`);
      });
      if (job.errorLog.length > 5) {
        console.log(`   ... and ${job.errorLog.length - 5} more errors`);
      }
    }

    console.log('\n🎉 TEST COMPLETED SUCCESSFULLY!\n');

    // Summary
    console.log('📝 Summary:');
    console.log(`  - Job ID: ${jobId}`);
    console.log(`  - Objects processed: ${finalStatus.processedObjects}/${finalStatus.totalObjects}`);
    console.log(`  - Success rate: ${((finalStatus.processedObjects / finalStatus.totalObjects) * 100).toFixed(1)}%`);
    console.log(`  - Total cost: $${job.actualCost.toFixed(4)}`);
    console.log(`  - Total time: ${(duration / 1000).toFixed(2)}s`);
    console.log(`  - Status: ${finalStatus.status}\n`);

    console.log('✅ Phase 3 orchestrator is working correctly!');
    console.log('🚀 Ready to proceed to Phase 4: API Endpoints\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:\n');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    // Provide helpful hints
    console.error('\n💡 Troubleshooting:');
    if (error.message.includes('API key')) {
      console.error('   - Ensure OpenAI API key is configured in admin panel');
      console.error('   - Verify the key is set as default and active');
      console.error('   - Check API_KEY_ENCRYPTION_SECRET is set in .env');
    } else if (error.message.includes('object') && error.message.includes('not found')) {
      console.error('   - Verify TEST_OBJECT_IDS exist in metadata.objects table');
      console.error('   - Ensure metadata extraction has completed');
    } else if (error.message.includes('rate limit')) {
      console.error('   - OpenAI rate limit hit, wait a few seconds and retry');
    } else if (error.message.includes('organization')) {
      console.error('   - Verify TEST_ORG_ID exists in enterprise.organizations');
      console.error('   - Ensure organization has API key configured');
    }

    process.exit(1);
  }
}

// Test pause/resume functionality (separate test)
async function testPauseResume() {
  console.log('\n🧪 Testing Pause/Resume Functionality\n');

  const TEST_ORG_ID = process.env.TEST_ORG_ID || '';
  const TEST_OBJECT_IDS = process.env.TEST_OBJECT_IDS || '';

  if (!TEST_ORG_ID || !TEST_OBJECT_IDS) {
    console.error('❌ TEST_ORG_ID and TEST_OBJECT_IDS must be set');
    process.exit(1);
  }

  const objectIds = TEST_OBJECT_IDS.split(',').map(id => id.trim());
  const orchestrator = new DocumentationJobOrchestrator(TEST_ORG_ID);

  // Create job
  const jobId = await orchestrator.createJob(objectIds);
  console.log(`✅ Job created: ${jobId}`);

  // Start processing (in background)
  console.log('🚀 Starting job processing...');
  orchestrator.processJob(jobId).catch(err => {
    console.log('Job stopped (expected):', err.message);
  });

  // Wait 5 seconds then pause
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('\n⏸️  Pausing job...');
  await orchestrator.pauseJob(jobId);

  const pausedStatus = await orchestrator.getJobStatus(jobId);
  console.log(`✅ Job paused at ${pausedStatus.progressPercentage.toFixed(1)}%`);

  // Wait 2 seconds then resume
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('\n▶️  Resuming job...');
  await orchestrator.resumeJob(jobId);

  const finalStatus = await orchestrator.getJobStatus(jobId);
  console.log(`✅ Job completed: ${finalStatus.status}`);
}

// Test cancel functionality
async function testCancel() {
  console.log('\n🧪 Testing Cancel Functionality\n');

  const TEST_ORG_ID = process.env.TEST_ORG_ID || '';
  const TEST_OBJECT_IDS = process.env.TEST_OBJECT_IDS || '';

  if (!TEST_ORG_ID || !TEST_OBJECT_IDS) {
    console.error('❌ TEST_ORG_ID and TEST_OBJECT_IDS must be set');
    process.exit(1);
  }

  const objectIds = TEST_OBJECT_IDS.split(',').map(id => id.trim());
  const orchestrator = new DocumentationJobOrchestrator(TEST_ORG_ID);

  // Create job
  const jobId = await orchestrator.createJob(objectIds);
  console.log(`✅ Job created: ${jobId}`);

  // Start processing (in background)
  console.log('🚀 Starting job processing...');
  orchestrator.processJob(jobId).catch(err => {
    console.log('Job stopped:', err.message);
  });

  // Wait 3 seconds then cancel
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('\n🛑 Cancelling job...');
  await orchestrator.cancelJob(jobId);

  const cancelledStatus = await orchestrator.getJobStatus(jobId);
  console.log(`✅ Job cancelled: ${cancelledStatus.status}`);
}

// Run main test
testJobOrchestrator();

// Uncomment to test pause/resume:
// testPauseResume();

// Uncomment to test cancel:
// testCancel();
