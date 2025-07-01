// Load environment variables
require('dotenv').config();

const { supabase } = require('./dist/config/supabase');

async function checkColumns() {
  console.log('🔍 Checking table columns...\n');

  try {
    // Check files table structure
    console.log('1. Files table columns:');
    const { data: filesColumns, error: filesError } = await supabase
      .from('files')
      .select('*')
      .limit(1);
    
    if (filesError) {
      console.log('❌ Files table error:', filesError.message);
    } else {
      console.log('✅ Files table exists');
      console.log('   Available columns:', Object.keys(filesColumns[0] || {}));
    }

    // Check processing_jobs table structure
    console.log('\n2. Processing jobs table columns:');
    const { data: jobsColumns, error: jobsError } = await supabase
      .from('processing_jobs')
      .select('*')
      .limit(1);
    
    if (jobsError) {
      console.log('❌ Processing jobs table error:', jobsError.message);
    } else {
      console.log('✅ Processing jobs table exists');
      console.log('   Available columns:', Object.keys(jobsColumns[0] || {}));
    }

    // Check if data_assets table exists at all
    console.log('\n3. Data assets table:');
    const { data: assetsData, error: assetsError } = await supabase
      .from('data_assets')
      .select('*')
      .limit(1);
    
    if (assetsError) {
      console.log('❌ Data assets table error:', assetsError.message);
    } else {
      console.log('✅ Data assets table exists');
      console.log('   Available columns:', Object.keys(assetsData[0] || {}));
    }

    // Check if data_lineage table exists
    console.log('\n4. Data lineage table:');
    const { data: lineageData, error: lineageError } = await supabase
      .from('data_lineage')
      .select('*')
      .limit(1);
    
    if (lineageError) {
      console.log('❌ Data lineage table error:', lineageError.message);
    } else {
      console.log('✅ Data lineage table exists');
      console.log('   Available columns:', Object.keys(lineageData[0] || {}));
    }

  } catch (error) {
    console.error('❌ Column check failed:', error.message);
  }

  console.log('\n🎉 Column check completed!');
}

checkColumns(); 