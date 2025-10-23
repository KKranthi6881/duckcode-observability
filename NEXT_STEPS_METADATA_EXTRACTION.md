# Next Steps: Metadata Extraction & Lineage Fix

## Summary of Work Completed ✅

### 1. File-Based Lineage API (COMPLETE)
- ✅ New endpoint: `GET /api/metadata/lineage/by-file/:connectionId?filePath=...`
- ✅ Connection_id → repository_id lookup
- ✅ Filename matching (handles dbt flat paths)
- ✅ Returns file-specific lineage with focal objects
- ✅ Frontend integration with path normalization

### 2. Comprehensive Logging (COMPLETE)
- ✅ Tracks dependency storage success/failures
- ✅ Shows missing source/target unique_ids
- ✅ Displays object map statistics
- ✅ Sample unique_ids for debugging

### 3. Root Cause Identified
**Problem:** Only 8.65% of objects have dependencies (540 out of 4,810)

**Cause:** Dependencies are being skipped because source/target objects aren't found in the unique_id map

**Next:** Need to run extraction with new logging to see WHY objects aren't found

## What to Do Next

### Step 1: Re-run Metadata Extraction (REQUIRED)

The extraction needs to be re-run with the new logging to diagnose the issue.

**How to trigger extraction:**
1. Go to CodeBase UI
2. Click on the GitLab repository
3. Look for "Re-extract Metadata" or "Refresh Lineage" button
4. OR: Use the API endpoint directly

**Watch for these logs:**
```
📋 Object map built:
   Total objects in DB: 4810
   Objects with unique_id: XXXX  ← Should be close to 4810
   Sample unique_ids (first 5):
      - model.gitlab_data_analytics.fct_charge
      - source.gitlab_data_analytics.gitlab_dotcom.issues
      ...

🔗 Storing 2847 dependencies from manifest...
✅ Dependency storage complete:
   ✓ Stored: XXX
   ⚠️  Skipped (source not found): XXX
   ⚠️  Skipped (target not found): XXX

   Missing source objects (first 10):
      - source.gitlab_data_analytics.gitlab_dotcom.issues
      ...
```

### Step 2: Analyze the Logs

**Key Questions:**
1. How many objects have unique_ids? (Should be ~4810)
2. How many dependencies are in the manifest? (Should be 2000-3000)
3. What are the missing unique_ids? (Pattern analysis)
4. Are sources included in the object map?

**Common Patterns:**
- If missing sources → Sources not being stored correctly
- If missing models → unique_id format mismatch
- If project name mismatch → Need to normalize project names

### Step 3: Fix Based on Findings

**Scenario A: Sources Not in Map**
```typescript
// Add sources explicitly to the map after storing them
for (const source of parsed.sources) {
  if (sourceObject) {
    objectMapByUniqueId.set(source.unique_id, sourceObject.id);
  }
}
```

**Scenario B: Unique ID Format Mismatch**
```typescript
// Normalize unique_ids before comparison
const normalizeUniqueId = (id: string) => {
  // Remove project name prefix if needed
  return id.replace(/^model\..*?\./, 'model.');
};
```

**Scenario C: External Dependencies**
```typescript
// Store external sources/models as placeholder objects
if (!sourceId) {
  // Create placeholder object for external dependency
  const placeholder = await createPlaceholderObject(dep.source_unique_id);
  sourceId = placeholder.id;
}
```

### Step 4: Verify Fix

After fixing, check coverage:
```sql
SELECT 
  COUNT(DISTINCT o.id) as total_objects,
  COUNT(DISTINCT CASE WHEN d.source_object_id IS NOT NULL OR d.target_object_id IS NOT NULL THEN o.id END) as objects_with_deps,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN d.source_object_id IS NOT NULL OR d.target_object_id IS NOT NULL THEN o.id END) / COUNT(DISTINCT o.id), 2) as coverage_percent
FROM metadata.objects o
LEFT JOIN metadata.dependencies d ON (o.id = d.source_object_id OR o.id = d.target_object_id)
WHERE o.organization_id = '1f38797e-c04b-471c-aaa5-78dae31a45d6';
```

**Target:** Coverage should be 60-80%

### Step 5: Test File-Specific Lineage

Once dependencies are fixed:
1. Click on `fct_charge.sql` in CodeBase UI
2. Should see:
   - `prep_charge` (upstream)
   - `prep_amendment` (upstream)
   - Any downstream models that use `fct_charge`
3. Check browser console for:
   ```
   [CodeLineageView] ✅ File lineage data received:
     - Total nodes: 5-10 (not 1!)
     - Total edges: 4-8 (not 0!)
   ```

## Files Ready for Testing

### Backend
- ✅ `backend/src/services/metadata/extraction/ExtractionOrchestrator.ts` - Enhanced logging
- ✅ `backend/src/api/controllers/metadata-lineage.controller.ts` - File-based API
- ✅ `backend/src/api/routes/metadata-lineage.routes.ts` - New route

### Frontend  
- ✅ `frontend/src/components/lineage/CodeLineageView.tsx` - File-specific fetching

## Expected Outcomes

### Before Fix
- ❌ 8.65% dependency coverage
- ❌ Most files show 1 node, 0 edges
- ❌ Same "dummy" lineage for all files
- ❌ No way to debug why dependencies are missing

### After Fix
- ✅ 60-80% dependency coverage
- ✅ Each file shows its specific dependencies
- ✅ Focal objects highlighted
- ✅ Clear logs showing what was stored/skipped
- ✅ Enterprise-ready lineage

## Troubleshooting

### If Extraction Fails
1. Check backend logs for errors
2. Verify dbt manifest is valid JSON
3. Check database connection
4. Ensure organization_id is correct

### If Dependencies Still Low
1. Check the "Missing source objects" list
2. Verify unique_id format matches
3. Check if sources are being stored
4. Look for project name mismatches

### If Lineage Still Shows Same Data
1. Clear browser cache
2. Check if API is returning different data per file
3. Verify frontend is using file path correctly
4. Check backend logs for file lookup

## Documentation

All analysis and fixes are documented in:
1. `METADATA_EXTRACTION_DIAGNOSIS.md` - Root cause analysis
2. `METADATA_EXTRACTION_FIX_SUMMARY.md` - Implementation details
3. `FILE_LINEAGE_IMPLEMENTATION_COMPLETE.md` - API documentation
4. `CODE_LINEAGE_ISSUE_ANALYSIS.md` - Original issue
5. `NEXT_STEPS_METADATA_EXTRACTION.md` - This file

## Contact Points

If you need help:
1. Check the logs first (backend console)
2. Review the documentation files above
3. Check browser console for frontend errors
4. Verify database state with SQL queries

## Success Criteria

✅ **Extraction completes successfully**
✅ **Dependency coverage > 60%**
✅ **File-specific lineage works for all files**
✅ **Clear error messages for debugging**
✅ **Performance < 5 minutes for 5K models**
✅ **Enterprise-ready for production use**

---

**Ready to proceed!** Re-run the extraction and share the logs to continue debugging. 🚀
