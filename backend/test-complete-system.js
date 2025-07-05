#!/usr/bin/env node

/**
 * COMPREHENSIVE SYSTEM TEST
 * Tests all 5 phases of sequential processing to ensure they work correctly
 */

const axios = require('axios');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://localhost:3001/api';
const TEST_REPO = 'test-user/test-repo';
const TEST_LANGUAGE = 'javascript';

// Mock JWT token for testing (replace with real token in production)
const JWT_TOKEN = 'test-jwt-token';

console.log('🧪 COMPREHENSIVE SYSTEM TEST');
console.log('============================');
console.log(`🎯 Testing Repository: ${TEST_REPO}`);
console.log(`🌐 API Base URL: ${BASE_URL}`);
console.log();

/**
 * Test Phase 1: Documentation Analysis
 */
async function testPhase1Documentation() {
  console.log('📄 PHASE 1: Testing Documentation Analysis');
  console.log('------------------------------------------');
  
  try {
    const response = await axios.post(`${BASE_URL}/phases/documentation`, {
      repositoryFullName: TEST_REPO,
      selectedLanguage: TEST_LANGUAGE
    }, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Phase 1 Response:', response.status, response.data.message);
    console.log(`📊 Files Queued: ${response.data.filesQueued}`);
    return true;
  } catch (error) {
    console.error('❌ Phase 1 Error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Phase 2: Vector Generation
 */
async function testPhase2Vectors() {
  console.log('\n🔍 PHASE 2: Testing Vector Generation');
  console.log('------------------------------------');
  
  try {
    const response = await axios.post(`${BASE_URL}/phases/vectors`, {
      repositoryFullName: TEST_REPO
    }, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Phase 2 Response:', response.status, response.data.message);
    console.log(`📊 Files Queued: ${response.data.filesQueued}`);
    return true;
  } catch (error) {
    console.error('❌ Phase 2 Error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Phase 3: Lineage Extraction
 */
async function testPhase3Lineage() {
  console.log('\n🔗 PHASE 3: Testing Lineage Extraction');
  console.log('-------------------------------------');
  
  try {
    const response = await axios.post(`${BASE_URL}/phases/lineage`, {
      repositoryFullName: TEST_REPO
    }, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Phase 3 Response:', response.status, response.data.message);
    console.log(`📊 Files Queued: ${response.data.filesQueued}`);
    return true;
  } catch (error) {
    console.error('❌ Phase 3 Error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Phase 4: Dependency Resolution
 */
async function testPhase4Dependencies() {
  console.log('\n🌐 PHASE 4: Testing Dependency Resolution');
  console.log('----------------------------------------');
  
  try {
    const response = await axios.post(`${BASE_URL}/phases/dependencies`, {
      repositoryFullName: TEST_REPO
    }, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Phase 4 Response:', response.status, response.data.message);
    console.log(`📊 Analysis Results:`, response.data.results);
    return true;
  } catch (error) {
    console.error('❌ Phase 4 Error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Phase 5: Impact Analysis
 */
async function testPhase5Analysis() {
  console.log('\n📊 PHASE 5: Testing Impact Analysis');
  console.log('----------------------------------');
  
  try {
    const response = await axios.post(`${BASE_URL}/phases/analysis`, {
      repositoryFullName: TEST_REPO
    }, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Phase 5 Response:', response.status, response.data.message);
    console.log(`📊 Risk Score: ${response.data.results?.riskAssessment?.riskScore}%`);
    console.log(`📊 Complexity: ${response.data.results?.complexityAnalysis?.averageComplexity}`);
    return true;
  } catch (error) {
    console.error('❌ Phase 5 Error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Sequential Processing Flow
 */
async function testSequentialFlow() {
  console.log('\n🔄 SEQUENTIAL PROCESSING: Testing Complete Flow');
  console.log('===============================================');
  
  try {
    const response = await axios.post(`${BASE_URL}/sequential/start`, {
      repositoryFullName: TEST_REPO,
      selectedLanguage: TEST_LANGUAGE
    }, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Sequential Processing Started:', response.status);
    console.log(`📊 Job ID: ${response.data.jobId}`);
    console.log(`📊 Current Phase: ${response.data.currentPhase}`);
    console.log(`📊 Files Scanned: ${response.data.filesScanned}`);
    console.log(`📊 Files Queued: ${response.data.filesQueued}`);
    
    return response.data.jobId;
  } catch (error) {
    console.error('❌ Sequential Processing Error:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test Status Endpoint
 */
async function testStatusEndpoint() {
  console.log('\n📊 STATUS: Testing Status Endpoint');
  console.log('----------------------------------');
  
  try {
    const response = await axios.get(`${BASE_URL}/sequential/status/${encodeURIComponent(TEST_REPO)}`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Status Response:', response.status);
    console.log(`📊 Current Phase: ${response.data.currentPhase}`);
    console.log(`📊 Overall Progress: ${response.data.progress}%`);
    console.log(`📊 Total Files: ${response.data.totalFiles}`);
    
    // Show phase details
    const phases = response.data.phases;
    console.log('\n📋 Phase Details:');
    Object.keys(phases).forEach(phaseKey => {
      const phase = phases[phaseKey];
      console.log(`  ${phaseKey}: ${phase.status} (${phase.progress || 0}%)`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Status Error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test Health Check
 */
async function testHealthCheck() {
  console.log('🏥 HEALTH CHECK: Testing Backend Health');
  console.log('--------------------------------------');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Backend Health:', response.status, response.data.status);
    return true;
  } catch (error) {
    console.error('❌ Health Check Failed:', error.message);
    return false;
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE SYSTEM TEST');
  console.log('======================================\n');
  
  const results = {
    healthCheck: false,
    phase1: false,
    phase2: false,
    phase3: false,
    phase4: false,
    phase5: false,
    sequentialFlow: false,
    statusEndpoint: false
  };
  
  // Test 1: Health Check
  results.healthCheck = await testHealthCheck();
  
  // Test 2: Individual Phase Tests
  results.phase1 = await testPhase1Documentation();
  results.phase2 = await testPhase2Vectors();
  results.phase3 = await testPhase3Lineage();
  results.phase4 = await testPhase4Dependencies();
  results.phase5 = await testPhase5Analysis();
  
  // Test 3: Sequential Flow
  const jobId = await testSequentialFlow();
  results.sequentialFlow = jobId !== null;
  
  // Test 4: Status Endpoint
  results.statusEndpoint = await testStatusEndpoint();
  
  // Final Results
  console.log('\n🎯 COMPREHENSIVE TEST RESULTS');
  console.log('=============================');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! System is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the error messages above.');
  }
  
  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('🔥 Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests }; 