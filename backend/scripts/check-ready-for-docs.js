/**
 * Quick check: Are you ready to generate documentation?
 * Run: node scripts/check-ready-for-docs.js
 */

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReady() {
  console.log('🔍 Checking if you\'re ready to generate documentation...\n');

  let allGood = true;

  // 1. Check for metadata objects
  console.log('1️⃣  Checking for metadata objects...');
  const { data: objects, error: objError } = await supabase
    .schema('metadata')
    .from('objects')
    .select('id, name, object_type, organization_id')
    .limit(5);

  if (objError || !objects || objects.length === 0) {
    console.log('   ❌ No metadata objects found');
    console.log('   → Go to /admin/metadata and extract metadata first\n');
    allGood = false;
  } else {
    console.log(`   ✅ Found ${objects.length} objects (showing first 5):`);
    objects.forEach(obj => {
      console.log(`      - ${obj.name} (${obj.object_type})`);
    });
    console.log(`   → Organization: ${objects[0].organization_id}\n`);
  }

  // 2. Check for API key
  if (objects && objects.length > 0) {
    const orgId = objects[0].organization_id;
    
    console.log('2️⃣  Checking for OpenAI API key...');
    const { data: apiKey, error: keyError } = await supabase
      .schema('enterprise')
      .from('organization_api_keys')
      .select('id, provider, is_default, status')
      .eq('organization_id', orgId)
      .eq('provider', 'openai')
      .eq('status', 'active')
      .eq('is_default', true)
      .single();

    if (keyError || !apiKey) {
      console.log('   ❌ No OpenAI API key configured');
      console.log('   → Go to /admin/api-keys and add your OpenAI key\n');
      allGood = false;
    } else {
      console.log('   ✅ OpenAI API key configured and active\n');
    }
  }

  // 3. Check backend is running
  console.log('3️⃣  Checking if backend is running...');
  try {
    const response = await fetch('http://localhost:3000/api/health');
    if (response.ok) {
      console.log('   ✅ Backend is running on port 3000\n');
    } else {
      console.log('   ❌ Backend responded but not healthy');
      allGood = false;
    }
  } catch (error) {
    console.log('   ❌ Backend is not running');
    console.log('   → Run: npm run dev (in backend folder)\n');
    allGood = false;
  }

  // 4. Check frontend is running
  console.log('4️⃣  Checking if frontend is running...');
  try {
    const response = await fetch('http://localhost:5175');
    if (response.ok) {
      console.log('   ✅ Frontend is running on port 5175\n');
    } else {
      console.log('   ❌ Frontend responded but not healthy');
      allGood = false;
    }
  } catch (error) {
    console.log('   ❌ Frontend is not running');
    console.log('   → Run: npm run dev (in frontend folder)\n');
    allGood = false;
  }

  // Summary
  console.log('═'.repeat(60));
  if (allGood) {
    console.log('🎉 YOU\'RE READY!');
    console.log('\nNext steps:');
    console.log('1. Open: http://localhost:5175/admin/ai-documentation');
    console.log('2. Select some objects (checkboxes)');
    console.log('3. Click "Generate Documentation" button');
    console.log('4. Watch the magic happen! ✨');
  } else {
    console.log('⚠️  NOT READY YET');
    console.log('\nFix the issues above, then try again.');
  }
  console.log('═'.repeat(60));
}

checkReady().catch(console.error);
