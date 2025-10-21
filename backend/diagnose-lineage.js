#!/usr/bin/env node

/**
 * Diagnose Column Lineage Data
 * Checks what's in the database after extraction
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
  console.log('\n🔍 COLUMN LINEAGE DIAGNOSTICS\n');
  console.log('='.repeat(60));

  // 1. Get connection ID
  const { data: connection, error: connError } = await supabase
    .schema('enterprise')
    .from('github_connections')
    .select('id, repository_url')
    .like('repository_url', '%jaffle-shop%')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (connError || !connection) {
    console.error('❌ No jaffle-shop connection found');
    return;
  }

  console.log(`✅ Connection: ${connection.repository_url}`);
  console.log(`   ID: ${connection.id}\n`);

  const connectionId = connection.id;

  // 2. Check objects
  const { data: objects, error: objError } = await supabase
    .schema('metadata')
    .from('objects')
    .select('id, name, object_type')
    .eq('connection_id', connectionId);

  console.log(`📦 Objects: ${objects?.length || 0}`);
  if (objects) {
    objects.slice(0, 5).forEach(obj => {
      console.log(`   - ${obj.name} (${obj.object_type})`);
    });
    if (objects.length > 5) {
      console.log(`   ... and ${objects.length - 5} more`);
    }
  }
  console.log();

  // 3. Check columns
  const { data: columns, error: colError } = await supabase
    .schema('metadata')
    .from('columns')
    .select('id, name, data_type, object_id')
    .in('object_id', objects?.map(o => o.id) || []);

  console.log(`📋 Columns: ${columns?.length || 0}`);
  if (columns) {
    columns.slice(0, 5).forEach(col => {
      const obj = objects?.find(o => o.id === col.object_id);
      console.log(`   - ${obj?.name}.${col.name} (${col.data_type || 'UNKNOWN'})`);
    });
    if (columns.length > 5) {
      console.log(`   ... and ${columns.length - 5} more`);
    }
  }
  console.log();

  // 4. Check column lineages
  const { data: lineages, error: lineageError } = await supabase
    .schema('metadata')
    .from('columns_lineage')
    .select(`
      id,
      source_column,
      target_column,
      confidence,
      transformation_type,
      source_object:source_object_id(name),
      target_object:target_object_id(name)
    `)
    .in('target_object_id', objects?.map(o => o.id) || []);

  console.log(`🔗 Column Lineages: ${lineages?.length || 0}`);
  if (lineages && lineages.length > 0) {
    lineages.slice(0, 5).forEach(lineage => {
      console.log(`   - ${lineage.source_object?.name}.${lineage.source_column} → ${lineage.target_object?.name}.${lineage.target_column} (${Math.round(lineage.confidence * 100)}%)`);
    });
    if (lineages.length > 5) {
      console.log(`   ... and ${lineages.length - 5} more`);
    }
  } else {
    console.log(`   ⚠️  NO COLUMN LINEAGES FOUND!`);
    console.log(`   This is why you're not seeing confidence badges.`);
  }
  console.log();

  // 5. Check model dependencies
  const { data: deps, error: depsError } = await supabase
    .schema('metadata')
    .from('dependencies')
    .select(`
      id,
      source_object:source_object_id(name),
      target_object:target_object_id(name)
    `)
    .in('target_object_id', objects?.map(o => o.id) || []);

  console.log(`🔀 Model Dependencies: ${deps?.length || 0}`);
  if (deps) {
    deps.slice(0, 5).forEach(dep => {
      console.log(`   - ${dep.source_object?.name} → ${dep.target_object?.name}`);
    });
    if (deps.length > 5) {
      console.log(`   ... and ${deps.length - 5} more`);
    }
  }
  console.log();

  // 6. Summary
  console.log('='.repeat(60));
  console.log('📊 SUMMARY\n');
  console.log(`   Objects:      ${objects?.length || 0}`);
  console.log(`   Columns:      ${columns?.length || 0}`);
  console.log(`   Lineages:     ${lineages?.length || 0} ⚠️`);
  console.log(`   Dependencies: ${deps?.length || 0}`);
  console.log();

  if (!lineages || lineages.length === 0) {
    console.log('❌ PROBLEM FOUND:');
    console.log('   Column lineages are not being extracted!');
    console.log();
    console.log('💡 NEXT STEPS:');
    console.log('   1. Check backend logs during extraction');
    console.log('   2. Look for "COLUMN LINEAGE EXTRACTION" section');
    console.log('   3. Check if dbt version < 1.6 (needs SQL parsing)');
    console.log('   4. Verify compiled SQL is available in manifest');
  } else {
    console.log('✅ Column lineages exist in database!');
    console.log('   Problem might be in the API or frontend.');
  }
  console.log();
}

diagnose().catch(console.error).finally(() => process.exit(0));
