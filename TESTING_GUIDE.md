# End-to-End Testing Guide - Snowflake + dbt Unified Lineage

## Prerequisites

1. **Database Migration Applied**
   ```bash
   psql $DATABASE_URL -f supabase/migrations/20251104000001_add_fqn_source_type.sql
   ```

2. **Backend Running**
   ```bash
   cd backend
   npm run dev
   ```

3. **Frontend Running**
   ```bash
   cd frontend
   npm run dev
   ```

## Test Scenario 1: Snowflake Extraction

### Step 1: Create Snowflake Connector
1. Navigate to `/dashboard/connectors`
2. Click "New Snowflake"
3. Fill in connection details:
   - Name: `Production Snowflake`
   - Account: `your-account`
   - Username: `your-username`
   - Password: `your-password`
   - Warehouse: `COMPUTE_WH`
   - Database: `ANALYTICS`
   - Schema: `PUBLIC`
4. Click "Create"

### Step 2: Test Connection
1. Click "Test" button
2. Verify success message: "Connection test succeeded"

### Step 3: Extract Metadata
1. Click "Extract" button
2. Wait for extraction to complete (check History tab)
3. Verify extraction stats:
   - Objects extracted: > 0
   - Columns extracted: > 0
   - Status: completed

### Step 4: Verify Database
```sql
-- Check objects were created with FQN and source_type
SELECT 
  name,
  source_type,
  fqn,
  database_name,
  schema_name,
  object_type
FROM metadata.objects
WHERE connector_id IS NOT NULL
ORDER BY name
LIMIT 10;

-- Expected: source_type = 'snowflake', fqn populated
```

## Test Scenario 2: Unified Lineage Display

### Step 1: Access Unified Lineage
1. Navigate to `/dashboard/lineage` or create a new page
2. Use the `UnifiedLineageView` component
3. Should see loading spinner, then lineage graph

### Step 2: Verify Source Filtering
1. Check filter dropdown shows:
   - All Sources
   - dbt Models Only
   - Snowflake Tables Only
2. Select "Snowflake Tables Only"
3. Verify only Snowflake nodes are displayed (blue badges)
4. Select "dbt Models Only"
5. Verify only dbt nodes are displayed (no badges or orange)

### Step 3: Verify Stats Panel
Check stats panel shows:
- Total Objects: X
- dbt Models: Y
- Snowflake Tables: Z
- Dependencies: N
- Cross-Source Links: M (if any)

### Step 4: Verify Node Badges
1. Snowflake nodes should have blue "SNOWFLAKE" badge
2. dbt nodes should have no badge (or orange "DBT" if you want)
3. Hover over nodes to see tooltips with FQN

## Test Scenario 3: Cross-Source Lineage

### Step 1: Create dbt Model that References Snowflake Table
```sql
-- models/staging/stg_customers.sql
SELECT * FROM {{ source('raw', 'customers') }}
```

Where `raw.customers` exists in Snowflake.

### Step 2: Extract dbt Metadata
1. Connect GitHub repo with dbt project
2. Extract metadata
3. Verify dbt models created with source_type = 'dbt'

### Step 3: Verify Cross-Source Link
```sql
-- Check if dbt model and Snowflake table have matching FQN
SELECT 
  o1.name as dbt_model,
  o1.fqn as dbt_fqn,
  o2.name as snowflake_table,
  o2.fqn as snowflake_fqn
FROM metadata.objects o1
JOIN metadata.objects o2 ON o1.fqn = o2.fqn
WHERE o1.source_type = 'dbt'
  AND o2.source_type = 'snowflake';

-- If FQNs match, they should link automatically
```

### Step 4: View in Unified Lineage
1. Open unified lineage view
2. Should see both dbt and Snowflake nodes
3. If FQNs match, should see dependency edge between them
4. Stats should show "Cross-Source Links: 1+"

## Test Scenario 4: Column Lineage

### Step 1: Extract Column Lineage for Views
Snowflake views should have column lineage automatically extracted via SQLGlot.

### Step 2: Verify Column Lineage Data
```sql
-- Check column lineage was extracted
SELECT 
  so.name as source_table,
  cl.source_column,
  to.name as target_table,
  cl.target_column,
  cl.transformation_type,
  cl.confidence
FROM metadata.columns_lineage cl
JOIN metadata.objects so ON cl.source_object_id = so.id
JOIN metadata.objects to ON cl.target_object_id = to.id
WHERE so.source_type = 'snowflake'
LIMIT 10;
```

### Step 3: View in UI
1. Click on a Snowflake view node
2. Should expand to show columns
3. Columns with lineage should have indicators
4. Click column to trace lineage path

## API Testing

### Test Unified Lineage API
```bash
# Get auth token from browser DevTools (Application > Local Storage > supabase.auth.token)
TOKEN="your-jwt-token"

# Test unified lineage endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/metadata/lineage/unified

# Expected response:
{
  "nodes": [...],
  "edges": [...],
  "stats": {
    "total": 50,
    "bySource": {
      "dbt": 30,
      "snowflake": 20
    },
    "dependencies": 45,
    "crossSourceDeps": 5
  }
}

# Test with source filter
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/metadata/lineage/unified?sourceFilter=snowflake"
```

## Performance Testing

### Test Large Warehouse Extraction
1. Connect to warehouse with 1000+ tables
2. Trigger extraction
3. Monitor:
   - Extraction time (should be < 5 minutes)
   - Memory usage (should not spike)
   - Database connections (should not leak)
4. Check extraction history for stats

### Test Lineage Graph Performance
1. Load unified lineage with 100+ nodes
2. Verify:
   - Graph renders in < 3 seconds
   - Smooth pan/zoom
   - No lag when filtering
   - MiniMap updates correctly

## Error Scenarios

### Test Connection Failure
1. Enter invalid Snowflake credentials
2. Click "Test"
3. Should show error message (not crash)

### Test Extraction Failure
1. Revoke Snowflake permissions mid-extraction
2. Should mark extraction as "failed" in history
3. Error message should be logged

### Test Missing FQN
1. Manually insert object without FQN
2. Unified lineage should still display it
3. Should not crash

## Regression Testing

### Verify GitHub Extraction Still Works
1. Connect GitHub repo
2. Extract dbt metadata
3. Verify:
   - Objects created with source_type = 'dbt'
   - FQN populated correctly
   - Existing lineage views still work
   - No breaking changes

### Verify Existing Features
- [ ] File-specific lineage still works
- [ ] Column lineage display still works
- [ ] Model tooltips still work
- [ ] Focused lineage still works
- [ ] Search functionality still works

## Success Criteria

✅ **Extraction**
- Snowflake connector creates objects with source_type='snowflake'
- FQN populated in format: DATABASE.SCHEMA.TABLE
- Column lineage extracted for views
- Extraction completes without errors

✅ **API**
- Unified lineage endpoint returns both dbt and Snowflake objects
- Source filtering works correctly
- Stats calculated accurately
- Cross-source dependencies detected

✅ **Frontend**
- Unified lineage graph displays both sources
- Source badges visible on Snowflake nodes
- Filtering works smoothly
- Stats panel shows correct counts
- Performance acceptable (< 3s load time)

✅ **Integration**
- GitHub extraction still works
- No breaking changes to existing features
- Cross-source lineage links automatically when FQNs match

## Troubleshooting

### Issue: No Snowflake nodes in lineage
**Fix:**
```sql
-- Check if objects have source_type
SELECT source_type, COUNT(*) 
FROM metadata.objects 
GROUP BY source_type;

-- If NULL, run backfill
UPDATE metadata.objects 
SET source_type = 'snowflake' 
WHERE connector_id IS NOT NULL AND source_type IS NULL;
```

### Issue: FQN not populated
**Fix:**
```sql
-- Manually build FQN
UPDATE metadata.objects 
SET fqn = UPPER(
  TRIM(
    COALESCE(database_name || '.', '') || 
    COALESCE(schema_name || '.', '') || 
    COALESCE(name, '')
  )
)
WHERE fqn IS NULL AND name IS NOT NULL;
```

### Issue: Column lineage not extracted
**Fix:**
1. Check Python SQLGlot service is running
2. Verify view definitions are valid SQL
3. Check logs for parsing errors

### Issue: Frontend shows "Failed to load lineage"
**Fix:**
1. Check browser console for errors
2. Verify API endpoint is accessible
3. Check authentication token is valid
4. Verify CORS settings

## Next Steps After Testing

1. **Performance Optimization**
   - Add caching for large lineage graphs
   - Implement pagination for 1000+ nodes
   - Optimize database queries

2. **UX Improvements**
   - Add search within lineage graph
   - Implement node grouping by schema
   - Add export functionality

3. **Advanced Features**
   - Automatic FQN matching for cross-source links
   - Impact analysis (what breaks if I change this?)
   - Data quality metrics integration

4. **Documentation**
   - User guide for Snowflake connector setup
   - API documentation
   - Architecture diagrams
