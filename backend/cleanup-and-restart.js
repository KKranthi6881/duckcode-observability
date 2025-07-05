const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabaseCodeInsights = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
  {
    db: { schema: 'code_insights' },
    auth: { persistSession: false }
  }
);

async function cleanupAndRestart() {
  console.log('🧹 Cleaning up corrupted sequential processing state...\n');
  
  const repositoryFullName = 'KKranthi6881/jaffle-shop-classic';
  const userId = '81f674e5-e587-464e-8ca7-b7b1373bf52e';
  
  try {
    // Step 1: Clean up sequential processing jobs
    console.log('📋 Step 1: Cleaning up sequential processing jobs...');
    const { data: deletedSeqJobs, error: seqError } = await supabaseCodeInsights
      .from('sequential_processing_jobs')
      .delete()
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .select();
    
    if (seqError) {
      console.error('❌ Error deleting sequential jobs:', seqError);
    } else {
      console.log(`✅ Deleted ${deletedSeqJobs?.length || 0} sequential processing jobs`);
    }
    
    // Step 2: Clean up processing jobs
    console.log('\n🔧 Step 2: Cleaning up processing jobs...');
    const { data: deletedJobs, error: jobsError } = await supabaseCodeInsights
      .from('processing_jobs')
      .delete()
      .eq('files.repository_full_name', repositoryFullName)
      .eq('files.user_id', userId)
      .select();
    
    if (jobsError) {
      console.error('❌ Error deleting processing jobs:', jobsError);
    } else {
      console.log(`✅ Deleted ${deletedJobs?.length || 0} processing jobs`);
    }
    
    // Step 3: Clean up files (optional - keep files but reset status)
    console.log('\n📁 Step 3: Resetting file status...');
    const { data: resetFiles, error: filesError } = await supabaseCodeInsights
      .from('files')
      .update({
        parsing_status: 'pending',
        documentation_summary: null,
        vector_metadata: null,
        lineage_data: null
      })
      .eq('repository_full_name', repositoryFullName)
      .eq('user_id', userId)
      .select();
    
    if (filesError) {
      console.error('❌ Error resetting files:', filesError);
    } else {
      console.log(`✅ Reset ${resetFiles?.length || 0} files to pending status`);
    }
    
    console.log('\n🎯 Cleanup completed! The sequential processing system is now ready for a fresh start.');
    console.log('💡 Next steps:');
    console.log('   1. Go to the UI');
    console.log('   2. Click "Analyze" button');
    console.log('   3. The system will scan the repository and create new jobs');
    console.log('   4. Sequential processing will work properly');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

// Run the cleanup
cleanupAndRestart().then(() => {
  console.log('\n🏁 Cleanup completed!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Cleanup error:', error);
  process.exit(1);
}); 