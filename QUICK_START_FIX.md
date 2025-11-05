# Quick Start: Fix Snowflake Extraction & Lineage

## Immediate Actions (30 minutes)

### Step 1: Run Database Migration
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability

# Apply FQN and source_type migration
psql $DATABASE_URL -f supabase/migrations/20251104000001_add_fqn_source_type.sql
```

### Step 2: Update MetadataStorageService

**File:** `backend/src/services/metadata/storage/MetadataStorageService.ts`

Add this helper method:
```typescript
private buildFQN(database?: string | null, schema?: string | null, name?: string): string {
  return [database, schema, name]
    .filter(Boolean)
    .map(s => String(s).toUpperCase())
    .join('.');
}
```

Update `storeObject` method (around line 43):
```typescript
async storeObject(objectData: any): Promise<any> {
  console.log(`[STORAGE] Attempting to insert object: ${objectData.name}`);
  
  // Build FQN for cross-source matching
  const fqn = this.buildFQN(
    objectData.database_name,
    objectData.schema_name,
    objectData.name
  );
  
  // Determine source type
  const source_type = objectData.connector_id ? 'snowflake' : 'dbt';
  
  const { data, error } = await supabase
    .schema('metadata')
    .from('objects')
    .insert({
      ...objectData,
      fqn,
      source_type
    })
    .select()
    .single();

  // ... rest of existing code
}
```

### Step 3: Update Lineage API

**File:** `backend/src/api/controllers/metadata-lineage.controller.ts`

Add new endpoint (after existing functions):
```typescript
export async function getUnifiedLineage(req: Request, res: Response) {
  try {
    const { organizationId } = req.query;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId required' });
    }

    // Fetch ALL objects (both dbt and Snowflake)
    const { data: objects, error } = await supabase
      .schema('metadata')
      .from('objects')
      .select(`
        id,
        name,
        schema_name,
        database_name,
        object_type,
        source_type,
        fqn,
        upstream:dependencies!dependencies_target_object_id_fkey(
          source_object_id,
          dependency_type
        ),
        downstream:dependencies!dependencies_source_object_id_fkey(
          target_object_id,
          dependency_type
        )
      `)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[LINEAGE] Query error:', error);
      return res.status(500).json({ error: 'Failed to fetch lineage' });
    }

    // Build lineage graph
    const nodes = objects.map(obj => ({
      id: obj.id,
      name: obj.name,
      schema: obj.schema_name,
      database: obj.database_name,
      type: obj.object_type,
      source: obj.source_type,
      fqn: obj.fqn
    }));

    const edges = objects.flatMap(obj => [
      ...obj.upstream.map((u: any) => ({
        source: u.source_object_id,
        target: obj.id,
        type: u.dependency_type
      })),
      ...obj.downstream.map((d: any) => ({
        source: obj.id,
        target: d.target_object_id,
        type: d.dependency_type
      }))
    ]);

    return res.json({ nodes, edges });
  } catch (e: any) {
    console.error('[LINEAGE] Error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

**File:** `backend/src/api/routes/metadata-lineage.routes.ts`

Add route:
```typescript
import { getUnifiedLineage } from '../controllers/metadata-lineage.controller';

// Add this line with other routes
router.get('/unified', getUnifiedLineage);
```

### Step 4: Test Extraction

```bash
# Start backend
cd backend
npm run dev

# In another terminal, test Snowflake extraction
curl -X POST http://localhost:3001/api/connectors/{CONNECTOR_ID}/extract \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check extraction results
curl http://localhost:3001/api/connectors/{CONNECTOR_ID}/history \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 5: Verify Lineage Data

```sql
-- Check if objects have FQN and source_type
SELECT 
  name,
  source_type,
  fqn,
  database_name,
  schema_name
FROM metadata.objects
WHERE organization_id = 'YOUR_ORG_ID'
ORDER BY source_type, name
LIMIT 20;

-- Check cross-source dependencies
SELECT 
  s.name as source_name,
  s.source_type as source_type,
  t.name as target_name,
  t.source_type as target_type,
  d.dependency_type
FROM metadata.dependencies d
JOIN metadata.objects s ON d.source_object_id = s.id
JOIN metadata.objects t ON d.target_object_id = t.id
WHERE s.organization_id = 'YOUR_ORG_ID'
  AND s.source_type != t.source_type
LIMIT 10;
```

---

## Common Issues & Fixes

### Issue 1: Extraction Fails with "Connection timeout"
**Fix:** Increase timeout in SnowflakeConnector.ts:
```typescript
// Line 62
const timeoutMs = parseInt(process.env.SNOWFLAKE_QUERY_TIMEOUT_MS || '120000', 10);
```

### Issue 2: No column lineage extracted
**Fix:** Check Python SQLGlot service is running:
```bash
# In backend directory
python3 -m metadata.parsers.python_sqlglot_service
```

### Issue 3: Lineage graph shows no Snowflake nodes
**Fix:** Verify source_type is set:
```sql
UPDATE metadata.objects 
SET source_type = 'snowflake' 
WHERE connector_id IS NOT NULL AND source_type IS NULL;
```

### Issue 4: Duplicate objects error
**Fix:** Clean up duplicates before re-extraction:
```sql
DELETE FROM metadata.objects 
WHERE connector_id = 'YOUR_CONNECTOR_ID';
```

---

## Verification Checklist

- [ ] Database migration applied successfully
- [ ] MetadataStorageService updated with FQN logic
- [ ] Unified lineage API endpoint added
- [ ] Snowflake extraction completes without errors
- [ ] Objects have `source_type` and `fqn` populated
- [ ] Lineage API returns both dbt and Snowflake nodes
- [ ] Column lineage extracted for views
- [ ] Frontend displays unified lineage graph

---

## Next Steps (After Quick Fix)

1. **Frontend Integration** - Update LineageGraph component to show source badges
2. **Cross-Source Linking** - Implement automatic dbt ↔ Snowflake matching
3. **Column Lineage UI** - Display column-level transformations
4. **Performance Optimization** - Add caching and batch processing
5. **Error Handling** - Improve retry logic and user feedback

---

## Support

If you encounter issues:
1. Check backend logs: `backend/logs/`
2. Check extraction history: `GET /api/connectors/{id}/history`
3. Verify database state with SQL queries above
4. Review full analysis: `SNOWFLAKE_EXTRACTION_ANALYSIS.md`
