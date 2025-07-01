// Load environment variables
require('dotenv').config();

const { supabase } = require('./dist/config/supabase');

async function testLineageAPI() {
  console.log('🧪 Testing Lineage API Functions...\n');

  try {
    // 1. Create some test data first
    console.log('1. Creating test repository data...');
    
    // Create test files
    const { data: testFile, error: fileError } = await supabase
      .from('files')
      .insert({
        user_id: '117fe710-277f-4dd5-872a-635c5f98201e', // Use the user ID from .env
        repository_full_name: 'test-owner/test-repo',
        file_path: 'src/models/user_model.sql',
        language: 'sql',
        parsing_status: 'completed'
      })
      .select()
      .single();
    
    if (fileError) {
      console.log('❌ File creation error:', fileError.message);
      return;
    }
    
    console.log('✅ Test file created:', testFile.file_path);

    // Create test data assets
    const assets = [
      {
        asset_name: 'users',
        asset_type: 'table',
        schema_name: 'public',
        database_name: 'production',
        file_id: testFile.id,
        asset_metadata: {
          description: 'Main users table',
          business_purpose: 'Stores customer information'
        }
      },
      {
        asset_name: 'user_profiles',
        asset_type: 'table', 
        schema_name: 'public',
        database_name: 'production',
        file_id: testFile.id,
        asset_metadata: {
          description: 'Extended user profile information',
          business_purpose: 'Additional user data and preferences'
        }
      },
      {
        asset_name: 'user_analytics_view',
        asset_type: 'view',
        schema_name: 'analytics',
        database_name: 'production',
        file_id: testFile.id,
        asset_metadata: {
          description: 'Analytics view combining user data',
          business_purpose: 'Provides comprehensive user metrics'
        }
      }
    ];

    const { data: createdAssets, error: assetsError } = await supabase
      .from('data_assets')
      .insert(assets)
      .select();
    
    if (assetsError) {
      console.log('❌ Assets creation error:', assetsError.message);
      return;
    }
    
    console.log('✅ Test assets created:', createdAssets.map(a => a.asset_name).join(', '));

    // Create test lineage relationships
    const lineageRelationships = [
      {
        source_asset_id: createdAssets[0].id, // users
        target_asset_id: createdAssets[2].id, // user_analytics_view
        relationship_type: 'reads_from',
        operation_type: 'select',
        transformation_logic: 'SELECT u.*, COUNT(*) as login_count FROM users u',
        business_context: 'Aggregates user login statistics',
        confidence_score: 0.95,
        discovered_in_file_id: testFile.id
      },
      {
        source_asset_id: createdAssets[1].id, // user_profiles  
        target_asset_id: createdAssets[2].id, // user_analytics_view
        relationship_type: 'reads_from',
        operation_type: 'select',
        transformation_logic: 'JOIN user_profiles p ON u.id = p.user_id',
        business_context: 'Enriches user data with profile information',
        confidence_score: 0.90,
        discovered_in_file_id: testFile.id
      }
    ];

    const { data: createdLineage, error: lineageError } = await supabase
      .from('data_lineage')
      .insert(lineageRelationships)
      .select();
    
    if (lineageError) {
      console.log('❌ Lineage creation error:', lineageError.message);
      return;
    }
    
    console.log('✅ Test lineage relationships created:', createdLineage.length);

    // 2. Test lineage queries
    console.log('\n2. Testing lineage queries...');
    
    // Test upstream dependencies (what feeds into user_analytics_view)
    const targetAssetId = createdAssets[2].id; // user_analytics_view
    const { data: upstream, error: upstreamError } = await supabase
      .from('data_lineage')
      .select(`
        *,
        source_asset:source_asset_id(asset_name, asset_type, full_qualified_name),
        target_asset:target_asset_id(asset_name, asset_type, full_qualified_name)
      `)
      .eq('target_asset_id', targetAssetId);
    
    if (upstreamError) {
      console.log('❌ Upstream query error:', upstreamError.message);
    } else {
      console.log('✅ Upstream dependencies found:', upstream.length);
      upstream.forEach(rel => {
        console.log(`   ${rel.source_asset.asset_name} -> ${rel.target_asset.asset_name} (${rel.relationship_type})`);
      });
    }

    // Test downstream dependencies (what uses users table)
    const sourceAssetId = createdAssets[0].id; // users
    const { data: downstream, error: downstreamError } = await supabase
      .from('data_lineage')
      .select(`
        *,
        source_asset:source_asset_id(asset_name, asset_type, full_qualified_name),
        target_asset:target_asset_id(asset_name, asset_type, full_qualified_name)
      `)
      .eq('source_asset_id', sourceAssetId);
    
    if (downstreamError) {
      console.log('❌ Downstream query error:', downstreamError.message);
    } else {
      console.log('✅ Downstream dependencies found:', downstream.length);
      downstream.forEach(rel => {
        console.log(`   ${rel.source_asset.asset_name} -> ${rel.target_asset.asset_name} (${rel.relationship_type})`);
      });
    }

    // 3. Test repository-level lineage statistics
    console.log('\n3. Testing repository lineage statistics...');
    
    const { data: repoStats, error: statsError } = await supabase
      .from('data_assets')
      .select('asset_type, count(*)')
      .eq('file_id', testFile.id);
    
    if (statsError) {
      console.log('❌ Stats query error:', statsError.message);
    } else {
      console.log('✅ Repository asset statistics:');
      repoStats.forEach(stat => {
        console.log(`   ${stat.asset_type}: ${stat.count} assets`);
      });
    }

    // 4. Test complex lineage path finding
    console.log('\n4. Testing lineage path queries...');
    
    // Find all paths from users table to any target
    const { data: allPaths, error: pathsError } = await supabase
      .rpc('find_lineage_paths', {
        source_asset_name: 'users',
        max_depth: 3
      });
    
    if (pathsError) {
      console.log('❌ Path finding error (expected - function may not exist):', pathsError.message);
    } else {
      console.log('✅ Lineage paths found:', allPaths?.length || 0);
    }

    console.log('\n🎉 Lineage API test completed successfully!');
    
    // Clean up test data
    console.log('\n5. Cleaning up test data...');
    await supabase.from('data_lineage').delete().in('id', createdLineage.map(l => l.id));
    await supabase.from('data_assets').delete().in('id', createdAssets.map(a => a.id));
    await supabase.from('files').delete().eq('id', testFile.id);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the test
testLineageAPI().then(() => {
  console.log('\n✅ API test script finished');
  process.exit(0);
}).catch((error) => {
  console.error('💥 API test script failed:', error);
  process.exit(1);
}); 