#!/usr/bin/env node

/**
 * Debug Sequential Processing State
 * Shows the current state of all sequential processing phases
 */

const axios = require('axios');

async function debugSequentialState() {
  console.log('🔍 DEBUGGING SEQUENTIAL PROCESSING STATE');
  console.log('=======================================');
  
  const repositoryFullName = 'KKranthi6881/jaffle-shop-classic';
  const baseUrl = 'http://localhost:3001/api';
  
  // You'll need to get a real JWT token for this to work
  const jwtToken = 'your-jwt-token-here';
  
  try {
    console.log(`📊 Checking sequential status for ${repositoryFullName}...`);
    
    const response = await axios.get(
      `${baseUrl}/sequential/status/${encodeURIComponent(repositoryFullName)}`,
      {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const status = response.data;
    
    console.log('\n📋 SEQUENTIAL PROCESSING STATUS:');
    console.log('=================================');
    console.log(`Job ID: ${status.jobId}`);
    console.log(`Status: ${status.status}`);
    console.log(`Current Phase: ${status.currentPhase}`);
    console.log(`Overall Progress: ${status.progress}%`);
    console.log(`Total Files: ${status.totalFiles}`);
    
    console.log('\n📊 PHASE BREAKDOWN:');
    console.log('===================');
    
    Object.entries(status.phases).forEach(([phaseName, phaseData]) => {
      console.log(`\n${phaseName.toUpperCase()}:`);
      console.log(`  Status: ${phaseData.status}`);
      console.log(`  Progress: ${phaseData.progress}%`);
      if (phaseData.details) {
        console.log(`  Details: ${phaseData.details}`);
      }
      if (phaseData.error) {
        console.log(`  Error: ${phaseData.error}`);
      }
      if (phaseData.total !== undefined) {
        console.log(`  Files: ${phaseData.completed || 0}/${phaseData.total}`);
      }
    });
    
    console.log('\n🔍 NEXT STEPS:');
    console.log('==============');
    
    if (status.phases.documentation.status === 'processing') {
      console.log('📄 Documentation is still processing...');
    } else if (status.phases.vectors.status === 'processing') {
      console.log('🔍 Vector generation is in progress...');
    } else if (status.phases.lineage.status === 'processing') {
      console.log('🔗 Lineage extraction is running...');
    } else if (status.phases.dependencies.status === 'processing') {
      console.log('🌐 Dependency analysis is in progress...');
    } else if (status.phases.analysis.status === 'processing') {
      console.log('📊 Impact analysis is running...');
    } else if (status.status === 'completed') {
      console.log('🎉 All phases completed successfully!');
    } else {
      console.log('⚠️ Processing may be stuck or have errors');
    }
    
  } catch (error) {
    console.error('❌ Error fetching sequential status:', error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 TIP: You need to provide a valid JWT token');
      console.log('   Update the jwtToken variable in this script');
    } else if (error.response?.status === 404) {
      console.log('\n💡 TIP: No sequential processing job found');
      console.log('   Start a new sequential processing job first');
    }
  }
}

// Run the debug
debugSequentialState(); 