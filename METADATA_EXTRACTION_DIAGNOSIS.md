# Metadata Extraction Diagnosis & Fix Plan

## Current State Analysis

### Extracted Data
- **Objects:** 4,810
- **Files:** 4,806  
- **Dependencies:** 540
- **Columns:** 27,190
- **Dependency Coverage:** Only 8.65% of objects have dependencies ❌

### Critical Issue
Only **540 dependencies** for **4,810 objects** means 91.35% of models have NO lineage data. This is unacceptable for enterprise use.

## Root Cause Investigation

### Hypothesis 1: Dependencies Not in Manifest ❌
**Status:** UNLIKELY
- The ManifestParser.extractDependencies() logic is correct
- It properly reads `node.depends_on.nodes` from manifest
- dbt manifest ALWAYS includes dependencies

### Hypothesis 2: Manifest Parsing Failed ⚠️
**Status:** POSSIBLE
- Check if manifest was fully parsed
- Check for errors during extraction
- Verify manifest structure

### Hypothesis 3: Database Storage Failed ✅ LIKELY
**Status:** HIGHLY LIKELY  
- Dependencies extracted but not stored
- Foreign key constraint failures
- Object ID mapping issues

## Diagnostic Steps

### Step 1: Check Extraction Logs
Look for:
```
📦 Parsing manifest.json - dbt v1.8.7
✅ Extracted from manifest:
   📊 X models
   📁 Y sources
   🔗 Z dependencies (100% accurate)  ← What was this number?
```

### Step 2: Verify Manifest Structure
Check if manifest has `depends_on` field:
```sql
-- Get a sample model from files
SELECT relative_path FROM metadata.files 
WHERE file_type = 'sql' 
LIMIT 1;

-- Check if it has dependencies in the original manifest
```

### Step 3: Check Object ID Mapping
The issue might be in ExtractionOrchestrator.storeInDatabase():
```typescript
// Line 551-565
for (const dep of parsed.dependencies) {
  const sourceId = objectMapByUniqueId.get(dep.source_unique_id);
  const targetId = objectMapByUniqueId.get(dep.target_unique_id);

  if (sourceId && targetId) {  // ← Are these failing?
    await supabase
      .schema('metadata')
      .from('dependencies')
      .upsert({...});
  }
}
```

**Problem:** If `sourceId` or `targetId` is null, the dependency is silently skipped!

### Step 4: Check for Unique ID Mismatches
dbt unique IDs look like:
- `model.project_name.model_name`
- `source.project_name.source_name.table_name`

The mapping might fail if:
1. Project name doesn't match
2. Source dependencies aren't in the objects table
3. Unique ID format is different

## Fix Plan

### Fix 1: Add Logging to Dependency Storage ✅
Add debug logs to see why dependencies are skipped:

```typescript
// In ExtractionOrchestrator.storeInDatabase()
console.log(`\n🔗 Storing ${parsed.dependencies.length} dependencies...`);
let stored = 0;
let skipped = 0;

for (const dep of parsed.dependencies) {
  const sourceId = objectMapByUniqueId.get(dep.source_unique_id);
  const targetId = objectMapByUniqueId.get(dep.target_unique_id);

  if (!sourceId) {
    console.log(`   ⚠️  Skipped: Source not found - ${dep.source_unique_id}`);
    skipped++;
    continue;
  }
  
  if (!targetId) {
    console.log(`   ⚠️  Skipped: Target not found - ${dep.target_unique_id}`);
    skipped++;
    continue;
  }

  await supabase.schema('metadata').from('dependencies').upsert({...});
  stored++;
}

console.log(`✅ Stored ${stored} dependencies, skipped ${skipped}`);
```

### Fix 2: Store Sources as Objects ✅
Sources (tables from data warehouse) should also be stored as objects so dependencies can reference them:

```typescript
// After storing models, also store sources
for (const source of parsed.sources) {
  const { data: sourceObj } = await supabase
    .schema('metadata')
    .from('objects')
    .upsert({
      organization_id: organizationId,
      repository_id: repositoryId,
      connection_id: connectionId,
      file_id: null,  // Sources don't have files
      name: source.name,
      schema_name: source.schema,
      database_name: source.database,
      object_type: 'source',
      description: source.description || '',
      metadata: { unique_id: source.unique_id }
    })
    .select('id')
    .single();

  if (sourceObj) {
    objectMapByUniqueId.set(source.unique_id, sourceObj.id);
  }
}
```

### Fix 3: Batch Insert Dependencies ✅
Current code does individual upserts. Use batch insert for better performance:

```typescript
const dependencyRecords = [];

for (const dep of parsed.dependencies) {
  const sourceId = objectMapByUniqueId.get(dep.source_unique_id);
  const targetId = objectMapByUniqueId.get(dep.target_unique_id);

  if (sourceId && targetId) {
    dependencyRecords.push({
      organization_id: organizationId,
      source_object_id: sourceId,
      target_object_id: targetId,
      dependency_type: 'table_dependency',
      confidence: dep.confidence,
      metadata: {
        source_unique_id: dep.source_unique_id,
        target_unique_id: dep.target_unique_id
      }
    });
  }
}

if (dependencyRecords.length > 0) {
  const { error } = await supabase
    .schema('metadata')
    .from('dependencies')
    .upsert(dependencyRecords);
    
  if (error) {
    console.error('Failed to store dependencies:', error);
  }
}
```

### Fix 4: Add Retry Logic for Failed Dependencies ✅
Store failed dependencies for later resolution:

```typescript
const failedDeps = [];

for (const dep of parsed.dependencies) {
  const sourceId = objectMapByUniqueId.get(dep.source_unique_id);
  const targetId = objectMapByUniqueId.get(dep.target_unique_id);

  if (!sourceId || !targetId) {
    failedDeps.push(dep);
  }
}

// Store failed deps in metadata for debugging
if (failedDeps.length > 0) {
  console.warn(`⚠️  ${failedDeps.length} dependencies could not be resolved`);
  console.warn(`   This usually means source tables aren't in the manifest`);
}
```

## Testing Plan

### Test 1: Check Specific Model
```sql
-- Check if fct_charge has dependencies in manifest
SELECT 
  o.name,
  o.metadata->>'unique_id' as unique_id
FROM metadata.objects o
JOIN metadata.files f ON o.file_id = f.id
WHERE f.relative_path LIKE '%fct_charge%';

-- Then manually check manifest.json for this unique_id
```

### Test 2: Re-run Extraction with Logging
1. Add logging fixes above
2. Re-run extraction for gitlab-data/analytics
3. Check logs for skipped dependencies
4. Identify missing source objects

### Test 3: Verify Dependency Storage
```sql
-- After re-extraction, check coverage
SELECT 
  COUNT(DISTINCT o.id) as total_objects,
  COUNT(DISTINCT CASE WHEN d.source_object_id IS NOT NULL OR d.target_object_id IS NOT NULL THEN o.id END) as objects_with_deps,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN d.source_object_id IS NOT NULL OR d.target_object_id IS NOT NULL THEN o.id END) / COUNT(DISTINCT o.id), 2) as coverage_percent
FROM metadata.objects o
LEFT JOIN metadata.dependencies d ON (o.id = d.source_object_id OR o.id = d.target_object_id)
WHERE o.organization_id = '1f38797e-c04b-471c-aaa5-78dae31a45d6';
```

**Expected:** Coverage should be 60-80% (not all models have deps, but most should)

## Enterprise Requirements

For enterprise deployment, we need:

1. **✅ High Dependency Coverage** (60-80%)
   - Most models should have lineage
   - Sources should be included as objects
   - Cross-project dependencies supported

2. **✅ Detailed Error Reporting**
   - Log which dependencies failed to store
   - Report missing source objects
   - Track extraction quality metrics

3. **✅ Incremental Updates**
   - Don't re-extract everything on every run
   - Update only changed models
   - Preserve manual edits/annotations

4. **✅ Performance**
   - Batch inserts for dependencies
   - Parallel processing where possible
   - Progress tracking for large repos

5. **✅ Data Quality**
   - Validate manifest structure
   - Check for circular dependencies
   - Verify column lineage accuracy

## Next Steps

1. **Immediate:** Add logging to see why dependencies are skipped
2. **Short-term:** Store sources as objects
3. **Medium-term:** Implement batch inserts
4. **Long-term:** Add incremental updates and quality metrics

## Success Criteria

- ✅ Dependency coverage > 60%
- ✅ File-specific lineage works for all files
- ✅ Column lineage extracted where available
- ✅ Clear error messages for missing dependencies
- ✅ Performance: < 5 minutes for 5000 models
