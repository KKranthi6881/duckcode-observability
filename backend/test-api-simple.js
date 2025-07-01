// Load environment variables
require('dotenv').config();

const { supabase } = require('./dist/config/supabase');

async function testLineageAPISimple() {
  console.log('🧪 Testing Lineage API Functions (Simplified)...\n');

  try {
    // 1. Test direct data asset creation (without file dependencies)
    console.log('1. Creating test data assets...');
    
    const assets = [
      {
        asset_name: 'users',
        asset_type: 'table',
        schema_name: 'public',
        database_name: 'production',
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

    // 2. Create test lineage relationships
    console.log('\n2. Creating lineage relationships...');
    
    const lineageRelationships = [
      {
        source_asset_id: createdAssets[0].id, // users
        target_asset_id: createdAssets[2].id, // user_analytics_view
        relationship_type: 'reads_from',
        operation_type: 'select',
        transformation_logic: 'SELECT u.*, COUNT(*) as login_count FROM users u',
        business_context: 'Aggregates user login statistics',
        confidence_score: 0.95
      },
      {
        source_asset_id: createdAssets[1].id, // user_profiles  
        target_asset_id: createdAssets[2].id, // user_analytics_view
        relationship_type: 'reads_from',
        operation_type: 'select',
        transformation_logic: 'JOIN user_profiles p ON u.id = p.user_id',
        business_context: 'Enriches user data with profile information',
        confidence_score: 0.90
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

    // 3. Test lineage queries
    console.log('\n3. Testing lineage queries...');
    
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

    // 4. Test asset statistics
    console.log('\n4. Testing asset statistics...');
    
    const { data: assetStats, error: statsError } = await supabase
      .from('data_assets')
      .select('asset_type')
      .in('id', createdAssets.map(a => a.id));
    
    if (statsError) {
      console.log('❌ Stats query error:', statsError.message);
    } else {
      const statsCounts = assetStats.reduce((acc, asset) => {
        acc[asset.asset_type] = (acc[asset.asset_type] || 0) + 1;
        return acc;
      }, {});
      
      console.log('✅ Asset type statistics:');
      Object.entries(statsCounts).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} assets`);
      });
    }

    // 5. Test lineage impact analysis
    console.log('\n5. Testing impact analysis...');
    
    // Find all assets that would be impacted if 'users' table changes
    const { data: impactedAssets, error: impactError } = await supabase
      .from('data_lineage')
      .select(`
        target_asset_id,
        target_asset:target_asset_id(asset_name, asset_type, full_qualified_name),
        relationship_type,
        business_context
      `)
      .eq('source_asset_id', sourceAssetId);
    
    if (impactError) {
      console.log('❌ Impact analysis error:', impactError.message);
    } else {
      console.log('✅ Impact analysis for users table:');
      console.log(`   ${impactedAssets.length} assets would be impacted by changes`);
      impactedAssets.forEach(impact => {
        console.log(`   Impact: ${impact.target_asset.asset_name} (${impact.target_asset.asset_type})`);
        console.log(`     Context: ${impact.business_context}`);
      });
    }

    console.log('\n🎉 Lineage API test completed successfully!');
    
    // 6. Clean up test data
    console.log('\n6. Cleaning up test data...');
    await supabase.from('data_lineage').delete().in('id', createdLineage.map(l => l.id));
    await supabase.from('data_assets').delete().in('id', createdAssets.map(a => a.id));
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the test
testLineageAPISimple().then(() => {
  console.log('\n✅ API test script finished');
  process.exit(0);
}).catch((error) => {
  console.error('💥 API test script failed:', error);
  process.exit(1);
}); 