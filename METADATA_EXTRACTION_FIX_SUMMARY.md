# Metadata Extraction Fix - Implementation Summary

## What We Fixed

### ✅ Fix #1: Added Comprehensive Logging
**File:** `backend/src/services/metadata/extraction/ExtractionOrchestrator.ts`

**Changes:**
- Added detailed logging to track dependency storage
- Counts stored vs skipped dependencies
- Shows which source/target objects are missing
- Displays first 10 missing unique_ids for debugging

**Expected Output:**
```
🔗 Storing 2847 dependencies from manifest...
✅ Dependency storage complete:
   ✓ Stored: 540
   ⚠️  Skipped (source not found): 1200
   ⚠️  Skipped (target not found): 1107

   Missing source objects (first 10):
      - source.gitlab_data_analytics.gitlab_dotcom.issues
      - source.gitlab_data_analytics.gitlab_dotcom.merge_requests
      ...
```

### ✅ Fix #2: Sources Already Stored
**Status:** Already implemented correctly!

Sources are stored as objects with:
- `object_type = 'source'`
- `unique_id` in metadata field
- Proper schema/database names
- All columns

### ✅ Fix #3: File-Based Lineage API
**Files:** 
- `backend/src/api/controllers/metadata-lineage.controller.ts`
- `backend/src/api/routes/metadata-lineage.routes.ts`
- `frontend/src/components/lineage/CodeLineageView.tsx`

**Features:**
- New endpoint: `GET /api/metadata/lineage/by-file/:connectionId?filePath=...`
- Looks up metadata repository by connection_id
- Matches files by name (handles dbt flat paths)
- Returns file-specific lineage with focal objects highlighted

## Current Status

### What's Working ✅
1. **File-specific lineage API** - Returns correct data for files that have dependencies
2. **Source storage** - Sources are stored as objects
3. **Object mapping** - unique_id → object_id mapping works
4. **Column extraction** - 27,190 columns extracted successfully

### What's Not Working ❌
1. **Low dependency coverage** - Only 8.65% of objects have dependencies
2. **Missing dependencies** - Most models show 0 edges in lineage
3. **Root cause** - Dependencies are being skipped because source/target objects aren't found in the map

## Root Cause Analysis

### The Problem
When storing dependencies, the code does:
```typescript
const sourceId = objectMapByUniqueId.get(dep.source_unique_id);
const targetId = objectMapByUniqueId.get(dep.target_unique_id);

if (sourceId && targetId) {
  // Store dependency
} else {
  // SILENTLY SKIP - This is the problem!
}
```

### Why Objects Aren't Found

**Hypothesis 1: Unique ID Format Mismatch**
- Manifest has: `source.gitlab_data_analytics.gitlab_dotcom.issues`
- Database has: Different format or missing prefix

**Hypothesis 2: Sources Not in Object Map**
- Sources are stored but query doesn't include them
- Object map query filters by something that excludes sources

**Hypothesis 3: Timing Issue**
- Dependencies are processed before all objects are stored
- Object map is built too early

## Next Steps to Debug

### Step 1: Check What's in the Object Map
Add logging after building the map:
```typescript
console.log(`\n📋 Object map built:`);
console.log(`   Total entries: ${objectMapByUniqueId.size}`);
console.log(`   Sample entries (first 5):`);
Array.from(objectMapByUniqueId.entries()).slice(0, 5).forEach(([key, value]) => {
  console.log(`      ${key} → ${value}`);
});
```

### Step 2: Check Unique ID Format
Compare what's in manifest vs database:
```sql
-- Check unique_id format in database
SELECT 
  name,
  object_type,
  metadata->>'unique_id' as unique_id
FROM metadata.objects
WHERE connection_id = '795a9625-3322-4b26-b921-83ac9c229781'
LIMIT 10;
```

### Step 3: Re-run Extraction
With the new logging, re-run extraction and check:
1. How many dependencies are in the manifest?
2. How many get stored?
3. What are the missing unique_ids?

## Testing Plan

### Test 1: Verify Logging Works
```bash
# Re-run extraction for gitlab-data/analytics
# Check backend logs for:
# - "🔗 Storing X dependencies from manifest..."
# - "Missing source objects (first 10):"
```

### Test 2: Check Specific Model
```sql
-- Find fct_charge in database
SELECT 
  o.id,
  o.name,
  o.metadata->>'unique_id' as unique_id
FROM metadata.objects o
JOIN metadata.files f ON o.file_id = f.id
WHERE f.relative_path LIKE '%fct_charge%';

-- Check if it has dependencies
SELECT COUNT(*) 
FROM metadata.dependencies 
WHERE target_object_id = '<id_from_above>';
```

### Test 3: Manual Dependency Check
```sql
-- Get a model with dependencies in manifest
-- Check if those dependencies exist as objects
SELECT 
  o.name,
  o.object_type,
  o.metadata->>'unique_id' as unique_id
FROM metadata.objects o
WHERE o.metadata->>'unique_id' LIKE '%prep_charge%'
   OR o.metadata->>'unique_id' LIKE '%prep_amendment%';
```

## Recommended Actions

### Immediate (Today)
1. ✅ Add logging (DONE)
2. ⏳ Re-run extraction with logging
3. ⏳ Analyze which unique_ids are missing
4. ⏳ Fix unique_id mapping issue

### Short-term (This Week)
1. Implement batch insert for dependencies (performance)
2. Add retry logic for failed dependencies
3. Create extraction quality metrics dashboard
4. Document expected dependency coverage by project type

### Medium-term (Next Sprint)
1. Implement incremental extraction (only changed files)
2. Add validation for circular dependencies
3. Create admin UI for re-running extraction
4. Add alerts for low dependency coverage

## Success Metrics

### Current
- Objects: 4,810
- Dependencies: 540 (8.65% coverage)
- Columns: 27,190

### Target
- Objects: 4,810
- Dependencies: 2,500+ (60%+ coverage)
- Columns: 27,190
- Column lineage: 10,000+ relationships

### Enterprise Requirements
- ✅ Dependency coverage > 60%
- ✅ Extraction time < 5 minutes for 5K models
- ✅ Clear error messages
- ✅ Incremental updates
- ✅ Quality metrics dashboard

## Files Modified

1. `backend/src/services/metadata/extraction/ExtractionOrchestrator.ts`
   - Added dependency storage logging
   - Tracks skipped dependencies
   - Shows missing unique_ids

2. `backend/src/api/controllers/metadata-lineage.controller.ts`
   - Added file-based lineage endpoint
   - Filename matching for dbt flat paths
   - Connection_id → repository_id lookup

3. `backend/src/api/routes/metadata-lineage.routes.ts`
   - Added `/by-file/:connectionId` route

4. `frontend/src/components/lineage/CodeLineageView.tsx`
   - Added file-specific lineage fetching
   - DBT path normalization
   - Detailed console logging

## Documentation Created

1. `METADATA_EXTRACTION_DIAGNOSIS.md` - Root cause analysis
2. `METADATA_EXTRACTION_FIX_SUMMARY.md` - This file
3. `FILE_LINEAGE_IMPLEMENTATION_COMPLETE.md` - API documentation
4. `CODE_LINEAGE_ISSUE_ANALYSIS.md` - Original issue analysis

## Next Session TODO

1. **Re-run extraction** with new logging
2. **Analyze logs** to find missing unique_ids
3. **Fix unique_id mapping** issue
4. **Verify coverage** improves to 60%+
5. **Test file-specific lineage** works for all files
6. **Create quality dashboard** for monitoring

## Questions to Answer

1. What format are unique_ids stored in the database?
2. Are sources included in the object map query?
3. Why are 91% of dependencies being skipped?
4. Is there a project name mismatch?
5. Are external sources (from other projects) being excluded?
