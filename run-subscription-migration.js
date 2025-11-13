/**
 * Run Subscription Migration on Cloud Supabase
 * 
 * This script applies the subscription schema migration to your cloud Supabase database
 * Run with: node run-subscription-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: './backend/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  console.error('Please add these environment variables and try again.');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting subscription schema migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase/migrations/20251113000001_create_subscription_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Loaded migration file:', migrationPath);
    console.log('📊 SQL size:', (migrationSQL.length / 1024).toFixed(2), 'KB\n');

    // Execute the migration
    console.log('⚙️  Executing migration...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      // If exec_sql doesn't exist, try direct execution (some Supabase instances support this)
      console.log('⚠️  exec_sql not available, trying alternative method...');
      
      // Try to create the schema and tables directly
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';';
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error: stmtError } = await supabase.rpc('exec', {
            sql: statement
          });
          
          if (stmtError) {
            console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
          }
        } catch (e) {
          console.warn(`⚠️  Skipping statement ${i + 1}:`, e.message);
        }
      }
      
      console.log('\n✅ Migration execution complete (with warnings)');
      console.log('\n⚠️  Note: Some statements may have failed. You might need to run the migration manually.');
      console.log('See instructions in SUBSCRIPTION_QUICK_START.md');
      return;
    }

    console.log('✅ Migration executed successfully!\n');
    
    // Verify the tables were created
    console.log('🔍 Verifying tables...');
    const { data: tables, error: verifyError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'enterprise')
      .in('table_name', ['organization_subscriptions', 'subscription_events', 'payment_methods', 'invoices']);

    if (verifyError) {
      console.warn('⚠️  Could not verify tables:', verifyError.message);
    } else if (tables && tables.length > 0) {
      console.log('✅ Verified tables:', tables.map(t => t.table_name).join(', '));
    }

    console.log('\n🎉 Subscription system is ready!');
    console.log('\n📝 Next steps:');
    console.log('   1. Configure Stripe credentials in backend/.env');
    console.log('   2. Restart your backend server');
    console.log('   3. Visit http://localhost:5175/admin/subscription');
    console.log('\nSee SUBSCRIPTION_QUICK_START.md for detailed setup instructions.\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n📖 Manual Migration Instructions:');
    console.error('   1. Go to your Supabase dashboard: https://supabase.com/dashboard');
    console.error('   2. Navigate to SQL Editor');
    console.error('   3. Copy the contents of: supabase/migrations/20251113000001_create_subscription_schema.sql');
    console.error('   4. Paste and execute in the SQL Editor\n');
    process.exit(1);
  }
}

// Run the migration
runMigration();
