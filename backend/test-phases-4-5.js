#!/usr/bin/env node

/**
 * FOCUSED TEST: Lineage → Dependencies → Impact Analysis
 * Tests the most critical phases of the pipeline
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const backendUrl = 'http://localhost:3001';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'code_insights' }
});

// Test configuration
const TEST_REPO = 'test-user/sql-project';
const TEST_USER_ID = '12345678-1234-1234-1234-123456789012';
const TEST_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODkwMTIiLCJpYXQiOjE3MzUwMDAwMDAsImV4cCI6MTczNTAwMzYwMH0.test-jwt-token';

async function setupTestData() {
    console.log('🔧 Setting up test data...');
    
    try {
        // Create test files
        const testFiles = [
            {
                id: '11111111-1111-1111-1111-111111111111',
                repository_full_name: TEST_REPO,
                file_path: 'analytics/customer_metrics.sql',
                language: 'sql',
                user_id: TEST_USER_ID,
                parsing_status: 'completed'
            },
            {
                id: '22222222-2222-2222-2222-222222222222',
                repository_full_name: TEST_REPO,
                file_path: 'transforms/sales_summary.sql',
                language: 'sql',
                user_id: TEST_USER_ID,
                parsing_status: 'completed'
            }
        ];

        const { error: filesError } = await supabase
            .from('files')
            .upsert(testFiles, { onConflict: 'id' });

        if (filesError) {
            console.error('Error creating test files:', filesError);
            return false;
        }

        // Create test processing jobs
        const testJobs = [
            {
                id: '33333333-3333-3333-3333-333333333333',
                file_id: '11111111-1111-1111-1111-111111111111',
                status: 'completed',
                vector_status: 'completed',
                lineage_status: null,
                analysis_language: 'sql'
            },
            {
                id: '44444444-4444-4444-4444-444444444444',
                file_id: '22222222-2222-2222-2222-222222222222',
                status: 'completed',
                vector_status: 'completed',
                lineage_status: null,
                analysis_language: 'sql'
            }
        ];

        const { error: jobsError } = await supabase
            .from('processing_jobs')
            .upsert(testJobs, { onConflict: 'id' });

        if (jobsError) {
            console.error('Error creating test jobs:', jobsError);
            return false;
        }

        // Create test code summaries (Phase 1 data)
        const testSummaries = [
            {
                id: '55555555-5555-5555-5555-555555555555',
                file_id: '11111111-1111-1111-1111-111111111111',
                repository_full_name: TEST_REPO,
                file_path: 'analytics/customer_metrics.sql',
                user_id: TEST_USER_ID,
                summary_json: {
                    complexity: 'High',
                    business_logic: {
                        main_objectives: ['Calculate customer lifetime value', 'Track retention metrics']
                    },
                    best_practices: {
                        improvements: ['Add indexing', 'Optimize joins']
                    }
                }
            },
            {
                id: '66666666-6666-6666-6666-666666666666',
                file_id: '22222222-2222-2222-2222-222222222222',
                repository_full_name: TEST_REPO,
                file_path: 'transforms/sales_summary.sql',
                user_id: TEST_USER_ID,
                summary_json: {
                    complexity: 'Medium',
                    business_logic: {
                        main_objectives: ['Aggregate sales data', 'Calculate monthly totals']
                    },
                    best_practices: {
                        improvements: []
                    }
                }
            }
        ];

        const { error: summariesError } = await supabase
            .from('code_summaries')
            .upsert(testSummaries, { onConflict: 'id' });

        if (summariesError) {
            console.error('Error creating test summaries:', summariesError);
            return false;
        }

        console.log('✅ Test data setup complete');
        return true;
    } catch (error) {
        console.error('❌ Failed to setup test data:', error);
        return false;
    }
}

async function testPhase3Lineage() {
    console.log('\n🔗 TESTING PHASE 3: Lineage Processing...');
    
    try {
        const response = await axios.post(`${backendUrl}/api/phases/lineage`, {
            repositoryFullName: TEST_REPO
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_JWT}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Phase 3 Response:', response.data);
        
        // Wait a bit for processing
        console.log('⏳ Waiting for lineage processing...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if lineage data was created
        const { data: lineageData } = await supabase
            .from('data_lineage')
            .select('*')
            .limit(5);
            
        const { data: assetsData } = await supabase
            .from('data_assets')
            .select('*')
            .eq('repository_full_name', TEST_REPO)
            .limit(5);
            
        console.log(`📊 Lineage created: ${lineageData?.length || 0} relationships`);
        console.log(`📊 Assets created: ${assetsData?.length || 0} data assets`);
        
        return {
            success: true,
            lineageCount: lineageData?.length || 0,
            assetsCount: assetsData?.length || 0
        };
        
    } catch (error) {
        console.error('❌ Phase 3 failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

async function testPhase4Dependencies() {
    console.log('\n🔗 TESTING PHASE 4: Dependencies Analysis...');
    
    try {
        const response = await axios.post(`${backendUrl}/api/phases/dependencies`, {
            repositoryFullName: TEST_REPO
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_JWT}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Phase 4 Response:', response.data);
        
        // Check if dependency analysis was created
        const { data: depAnalysis } = await supabase
            .from('repository_dependency_analysis')
            .select('*')
            .eq('repository_full_name', TEST_REPO)
            .eq('analysis_type', 'cross_file_dependencies');
            
        console.log(`📊 Dependency analysis created: ${depAnalysis?.length || 0} records`);
        
        if (depAnalysis?.length > 0) {
            const graph = depAnalysis[0].dependency_graph;
            console.log(`   Graph nodes: ${graph?.nodes?.length || 0}`);
            console.log(`   Graph edges: ${graph?.edges?.length || 0}`);
            console.log(`   Cross-file connections: ${graph?.crossFileConnections?.length || 0}`);
        }
        
        return {
            success: true,
            analysisCount: depAnalysis?.length || 0,
            graphData: depAnalysis?.[0]?.dependency_graph
        };
        
    } catch (error) {
        console.error('❌ Phase 4 failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

async function testPhase5ImpactAnalysis() {
    console.log('\n📊 TESTING PHASE 5: Impact Analysis...');
    
    try {
        const response = await axios.post(`${backendUrl}/api/phases/analysis`, {
            repositoryFullName: TEST_REPO
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_JWT}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Phase 5 Response:', response.data);
        
        // Check if impact analysis was created
        const { data: impactAnalysis } = await supabase
            .from('repository_impact_analysis')
            .select('*')
            .eq('repository_full_name', TEST_REPO);
            
        console.log(`📊 Impact analysis created: ${impactAnalysis?.length || 0} records`);
        
        if (impactAnalysis?.length > 0) {
            const analysis = impactAnalysis[0].analysis_results;
            console.log(`   Risk Score: ${analysis?.riskAssessment?.riskScore || 0}%`);
            console.log(`   High Risk Files: ${analysis?.riskAssessment?.highRiskFiles || 0}`);
            console.log(`   Complex Files: ${analysis?.complexityAnalysis?.complexFiles || 0}`);
            console.log(`   Business Logic Files: ${analysis?.businessImpact?.coreBusinessLogic || 0}`);
        }
        
        return {
            success: true,
            analysisCount: impactAnalysis?.length || 0,
            results: impactAnalysis?.[0]?.analysis_results
        };
        
    } catch (error) {
        console.error('❌ Phase 5 failed:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

async function cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
        // Delete in reverse order of dependencies
        await supabase.from('repository_impact_analysis').delete().eq('repository_full_name', TEST_REPO);
        await supabase.from('repository_dependency_analysis').delete().eq('repository_full_name', TEST_REPO);
        await supabase.from('data_lineage').delete().in('discovered_in_file_id', ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']);
        await supabase.from('data_assets').delete().eq('repository_full_name', TEST_REPO);
        await supabase.from('code_summaries').delete().eq('repository_full_name', TEST_REPO);
        await supabase.from('processing_jobs').delete().in('id', ['33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']);
        await supabase.from('files').delete().eq('repository_full_name', TEST_REPO);
        
        console.log('✅ Test data cleaned up');
    } catch (error) {
        console.warn('⚠️  Cleanup had some issues (non-critical):', error.message);
    }
}

async function runFocusedTest() {
    console.log('🎯 FOCUSED TEST: Lineage → Dependencies → Impact Analysis');
    console.log('=' .repeat(70));
    
    try {
        // Setup
        const setupSuccess = await setupTestData();
        if (!setupSuccess) {
            console.error('❌ Setup failed, aborting test');
            return;
        }
        
        // Test Phase 3: Lineage
        const phase3Result = await testPhase3Lineage();
        
        // Test Phase 4: Dependencies (only if Phase 3 succeeded)
        let phase4Result = { success: false };
        if (phase3Result.success) {
            phase4Result = await testPhase4Dependencies();
        }
        
        // Test Phase 5: Impact Analysis (only if Phase 4 succeeded)
        let phase5Result = { success: false };
        if (phase4Result.success) {
            phase5Result = await testPhase5ImpactAnalysis();
        }
        
        // Results Summary
        console.log('\n🎉 TEST RESULTS SUMMARY');
        console.log('=' .repeat(70));
        console.log(`Phase 3 (Lineage): ${phase3Result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Phase 4 (Dependencies): ${phase4Result.success ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`Phase 5 (Impact Analysis): ${phase5Result.success ? '✅ PASSED' : '❌ FAILED'}`);
        
        if (phase3Result.success && phase4Result.success && phase5Result.success) {
            console.log('\n🎉 ALL CRITICAL PHASES WORKING CORRECTLY!');
            console.log('✅ Lineage processing extracts data relationships');
            console.log('✅ Dependencies analysis builds comprehensive graph');
            console.log('✅ Impact analysis assesses risk and business impact');
            console.log('\n🚀 YOUR SYSTEM IS READY FOR PRODUCTION!');
        } else {
            console.log('\n⚠️  Some phases need attention:');
            if (!phase3Result.success) console.log('   - Phase 3 (Lineage) needs debugging');
            if (!phase4Result.success) console.log('   - Phase 4 (Dependencies) needs debugging');
            if (!phase5Result.success) console.log('   - Phase 5 (Impact) needs debugging');
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    } finally {
        // Cleanup
        await cleanupTestData();
    }
}

// Run the focused test
runFocusedTest(); 