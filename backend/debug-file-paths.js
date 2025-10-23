// Quick script to check what file paths are stored in metadata
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'metadata' }
});

async function checkFilePaths() {
  const connectionId = '795a9625-3322-4b26-b921-83ac9c229781';
  const repoFullName = 'gitlab-data/analytics';
  
  console.log('\n=== Checking NEW metadata schema ===\n');
  
  // Get all files for this connection
  const { data: files, error } = await supabase
    .schema('metadata')
    .from('files')
    .select('id, relative_path, file_type')
    .eq('repository_id', connectionId)
    .order('relative_path')
    .limit(50);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${files?.length || 0} files in metadata:\n`);
  
  files?.forEach((file, i) => {
    console.log(`${i + 1}. ${file.relative_path}`);
    console.log(`   Type: ${file.file_type}`);
    console.log(`   ID: ${file.id}\n`);
  });
  
  // Check for specific file - EXACT match
  const searchPath = 'transform/snowflake-dbt/models/common_mart_marketing/mart_crm_touchpoint.sql';
  console.log(`\n=== Searching for EXACT: ${searchPath} ===\n`);
  
  const { data: exactFile, error: exactError } = await supabase
    .schema('metadata')
    .from('files')
    .select('id, relative_path')
    .eq('repository_id', connectionId)
    .eq('relative_path', searchPath);
  
  if (exactError) {
    console.error('Exact search error:', exactError);
  } else if (exactFile && exactFile.length > 0) {
    console.log('✅ Found EXACT match:');
    exactFile.forEach(f => {
      console.log(`  - ${f.relative_path}`);
    });
  } else {
    console.log('❌ No EXACT match found');
  }
  
  // Check for partial match
  console.log(`\n=== Searching for PARTIAL: %mart_crm% ===\n`);
  
  const { data: specificFile, error: searchError } = await supabase
    .schema('metadata')
    .from('files')
    .select('id, relative_path')
    .eq('repository_id', connectionId)
    .ilike('relative_path', `%mart_crm%`);
  
  if (searchError) {
    console.error('Search error:', searchError);
  } else if (specificFile && specificFile.length > 0) {
    console.log('Found similar files:');
    specificFile.forEach(f => {
      console.log(`  - ${f.relative_path}`);
    });
  } else {
    console.log('No files found matching "mart_crm_touchpoint"');
  }
  
  // Check OLD code_insights schema
  console.log('\n\n=== Checking OLD code_insights schema ===\n');
  
  const supabaseOld = createClient(supabaseUrl, supabaseKey);
  
  const { data: oldFiles, error: oldError } = await supabaseOld
    .from('files')
    .select('id, file_path, language')
    .ilike('file_path', `%${repoFullName}%`)
    .limit(10);
  
  if (oldError) {
    console.error('Old schema error:', oldError);
  } else {
    console.log(`Found ${oldFiles?.length || 0} files in OLD schema:\n`);
    oldFiles?.forEach((file, i) => {
      console.log(`${i + 1}. ${file.file_path}`);
      console.log(`   Language: ${file.language}`);
      console.log(`   ID: ${file.id}\n`);
    });
  }
  
  process.exit(0);
}

checkFilePaths().catch(console.error);
