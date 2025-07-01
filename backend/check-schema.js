// Load environment variables
require('dotenv').config();

const { supabase } = require('./dist/config/supabase');

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');

  try {
    // Check what schemas exist
    const { data: schemas, error: schemaError } = await supabase
      .rpc('check_schemas');
    
    if (schemaError) {
      console.log('Schema check failed, trying direct query...');
      
      // Check tables in public schema
      const { data: publicTables, error: publicError } = await supabase
        .from('information_schema.tables')
        .select('table_schema, table_name')
        .eq('table_type', 'BASE TABLE')
        .in('table_schema', ['public', 'code_insights']);
      
      if (publicError) {
        console.log('❌ Public tables error:', publicError.message);
      } else {
        console.log('✅ Available tables:');
        publicTables.forEach(table => {
          console.log(`  - ${table.table_schema}.${table.table_name}`);
        });
      }
    }

    // Check if files table exists
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('id')
      .limit(1);
    
    if (filesError) {
      console.log('❌ Files table error:', filesError.message);
    } else {
      console.log('✅ Files table accessible');
    }

    // Check if processing_jobs table exists
    const { data: jobs, error: jobsError } = await supabase
      .from('processing_jobs')
      .select('id')
      .limit(1);
    
    if (jobsError) {
      console.log('❌ Processing jobs table error:', jobsError.message);
    } else {
      console.log('✅ Processing jobs table accessible');
    }

    // Check if data_assets table exists
    const { data: assets, error: assetsError } = await supabase
      .from('data_assets')
      .select('id')
      .limit(1);
    
    if (assetsError) {
      console.log('❌ Data assets table error:', assetsError.message);
    } else {
      console.log('✅ Data assets table accessible');
    }

    // Check if lineage functions exist
    const { data: lineageStats, error: lineageError } = await supabase
      .rpc('get_lineage_stats');
    
    if (lineageError) {
      console.log('❌ Lineage stats function error:', lineageError.message);
    } else {
      console.log('✅ Lineage stats function accessible');
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }

  console.log('\n🎉 Schema check completed!');
}

checkSchema(); 