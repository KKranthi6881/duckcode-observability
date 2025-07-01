// Load environment variables
require('dotenv').config();

const { supabase } = require('./dist/config/supabase');

async function testLineageDatabase() {
  console.log('🧪 Testing Lineage Database Functions...\n');

  try {
    // Test 1: Check if lineage schema exists - skip this test since function doesn't exist yet
    console.log('1. Testing schema access...');
    console.log('⏭️  Skipping get_lineage_stats function test (not implemented yet)');

    // Test 2: Check if we can query files table
    console.log('\n2. Testing files table access...');
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id, file_path, repository_full_name')
      .limit(5);
    
    if (filesError) {
      console.error('❌ Files table error:', filesError.message);
    } else {
      console.log('✅ Files table accessible');
      console.log(`   Found ${files?.length || 0} files`);
      if (files && files.length > 0) {
        console.log('   Sample file:', files[0]);
      }
    }

    // Test 3: Check if we can query data_assets table (using correct column names)
    console.log('\n3. Testing data_assets table access...');
    const { data: assets, error: assetsError } = await supabase
      .from('data_assets')
      .select('id, asset_name, asset_type, full_qualified_name')
      .limit(5);
    
    if (assetsError) {
      console.error('❌ Data assets table error:', assetsError.message);
    } else {
      console.log('✅ Data assets table accessible');
      console.log(`   Found ${assets?.length || 0} assets`);
      if (assets && assets.length > 0) {
        console.log('   Sample asset:', assets[0]);
      }
    }

    // Test 4: Check if we can query data_lineage table (using correct column names)
    console.log('\n4. Testing data_lineage table access...');
    const { data: lineage, error: lineageError } = await supabase
      .from('data_lineage')
      .select('id, relationship_type, confidence_score')
      .limit(5);
    
    if (lineageError) {
      console.error('❌ Data lineage table error:', lineageError.message);
    } else {
      console.log('✅ Data lineage table accessible');
      console.log(`   Found ${lineage?.length || 0} lineage relationships`);
      if (lineage && lineage.length > 0) {
        console.log('   Sample relationship:', lineage[0]);
      }
    }

    // Test 5: Check if we can query processing_jobs table
    console.log('\n5. Testing processing_jobs table access...');
    const { data: jobs, error: jobsError } = await supabase
      .from('processing_jobs')
      .select('id, status, lineage_status')
      .limit(5);
    
    if (jobsError) {
      console.error('❌ Processing jobs table error:', jobsError.message);
    } else {
      console.log('✅ Processing jobs table accessible');
      console.log(`   Found ${jobs?.length || 0} processing jobs`);
      if (jobs && jobs.length > 0) {
        console.log('   Sample job:', jobs[0]);
      }
    }

    // Test 6: Test the lease_processing_job function
    console.log('\n6. Testing lease_processing_job function...');
    const { data: leasedJob, error: leaseError } = await supabase
      .rpc('lease_processing_job', { worker_id: 'test-worker' });
    
    if (leaseError) {
      console.error('❌ Lease processing job error:', leaseError.message);
    } else {
      console.log('✅ Lease processing job function works');
      if (leasedJob) {
        console.log('   Leased job:', leasedJob);
      } else {
        console.log('   No jobs available to lease (expected if no pending jobs)');
      }
    }

    // Test 7: Create test lineage data (using correct schema)
    console.log('\n7. Testing lineage data creation...');
    
    try {
      // Create a test data asset (using correct column names)
      const { data: testAsset, error: assetError } = await supabase
        .from('data_assets')
        .insert({
          asset_name: 'example_table',
          asset_type: 'table',
          schema_name: 'test',
          database_name: 'test_db',
          asset_metadata: {
            description: 'Test table for lineage testing',
            columns: [
              { name: 'id', type: 'integer', description: 'Primary key' },
              { name: 'name', type: 'varchar', description: 'Name field' }
            ]
          }
        })
        .select()
        .single();
      
      if (assetError) {
        console.log('❌ Asset creation error:', assetError.message);
      } else {
        console.log('✅ Test asset created:', testAsset.asset_name);
        
        // Create a test lineage relationship (using correct column names)
        const { data: testLineage, error: lineageCreateError } = await supabase
          .from('data_lineage')
          .insert({
            source_asset_id: testAsset.id,
            target_asset_id: testAsset.id, // Self-reference for testing
            relationship_type: 'transforms',
            operation_type: 'select',
            transformation_logic: 'SELECT * FROM test.example_table',
            business_context: 'Test lineage relationship for validation'
          })
          .select()
          .single();
        
        if (lineageCreateError) {
          console.log('❌ Lineage creation error:', lineageCreateError.message);
        } else {
          console.log('✅ Test lineage created:', testLineage.relationship_type);
        }
      }
    } catch (createError) {
      console.log('❌ Data creation test error:', createError.message);
    }

    // Test 8: Test column lineage
    console.log('\n8. Testing column lineage...');
    const { data: columnLineage, error: columnError } = await supabase
      .from('column_lineage')
      .select('id, transformation_type, transformation_logic')
      .limit(5);
    
    if (columnError) {
      console.error('❌ Column lineage table error:', columnError.message);
    } else {
      console.log('✅ Column lineage table accessible');
      console.log(`   Found ${columnLineage?.length || 0} column lineage records`);
    }

    // Test 9: Test data columns
    console.log('\n9. Testing data columns...');
    const { data: dataColumns, error: columnsError } = await supabase
      .from('data_columns')
      .select('id, column_name, column_type')
      .limit(5);
    
    if (columnsError) {
      console.error('❌ Data columns table error:', columnsError.message);
    } else {
      console.log('✅ Data columns table accessible');
      console.log(`   Found ${dataColumns?.length || 0} column records`);
    }

    console.log('\n🎉 Lineage database test completed!');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the test
testLineageDatabase().then(() => {
  console.log('\n✅ Test script finished');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
}); 