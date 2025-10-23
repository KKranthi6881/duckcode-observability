# Connection ID Mismatch - Root Cause Found! 🎯

## The Problem

File-specific lineage showing "No lineage data" for all files because the frontend is using the **wrong connection ID**.

## Evidence

### Frontend is using:
- Connection ID: `795a9625-3322-4b26-b921-83ac9c229781`
- Organization ID: `1f38797e-c04b-471c-aaa5-78dae31a45d6`
- Result: **0 objects, 0 dependencies** ❌

### Database actually has:
- Connection ID: `eefc32e2-b10a-4bd1-80c1-0225ad0a1e0b`
- Organization ID: `18c21d70-2f41-4603-9507-a84c4d437bc3`
- Result: **4,810 objects, 540 dependencies** ✅

## Database State

```sql
-- Actual connection in database
SELECT * FROM enterprise.github_connections;
```
| id | organization_id | repository | status |
|----|-----------------|------------|--------|
| eefc32e2-b10a-4bd1-80c1-0225ad0a1e0b | 18c21d70-2f41-4603-9507-a84c4d437bc3 | gitlab-data/analytics | completed |

```sql
-- Metadata repository
SELECT * FROM metadata.repositories;
```
| id | connection_id | organization_id |
|----|---------------|-----------------|
| 085dd350-9579-4638-9709-928ce45301f1 | eefc32e2-b10a-4bd1-80c1-0225ad0a1e0b | 18c21d70-2f41-4603-9507-a84c4d437bc3 |

```sql
-- Objects count by organization
SELECT organization_id, COUNT(*) FROM metadata.objects GROUP BY organization_id;
```
| organization_id | count |
|-----------------|-------|
| 18c21d70-2f41-4603-9507-a84c4d437bc3 | 4,810 |

## Why This Happened

The frontend is likely:
1. Fetching the wrong connection from the API
2. Using a hardcoded/cached connection ID
3. The user switched organizations
4. There was a duplicate connection created

## How to Fix

### Option 1: Frontend Fix (Immediate)
Update the frontend to use the correct connection ID.

**Check where the connection ID comes from:**
- CodeBase.tsx - Repository selection
- API call to fetch repositories
- Local storage/cache

### Option 2: Backend Fix (If API is wrong)
Ensure the API returns the correct connection ID for the user's organization.

### Option 3: Database Cleanup
If there are duplicate connections, clean them up.

## Testing Steps

### Step 1: Verify Connection ID in Frontend
Add logging in CodeBase.tsx:
```typescript
console.log('[CodeBase] Selected connection ID:', connectionId);
console.log('[CodeBase] User organization ID:', user.organization_id);
```

### Step 2: Test with Correct Connection ID
Manually test the API with the correct ID:
```bash
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3001/api/metadata/lineage/by-file/eefc32e2-b10a-4bd1-80c1-0225ad0a1e0b?filePath=models/mart_crm_touchpoint.sql"
```

Expected: Should return lineage data!

### Step 3: Fix Frontend
Update the connection ID source to use `eefc32e2-b10a-4bd1-80c1-0225ad0a1e0b`.

## Expected Results After Fix

### Before (Wrong Connection ID)
```
GET /api/metadata/lineage/by-file/795a9625-3322-4b26-b921-83ac9c229781?filePath=...
→ 404 Not Found (Repository not found in metadata)
```

### After (Correct Connection ID)
```
GET /api/metadata/lineage/by-file/eefc32e2-b10a-4bd1-80c1-0225ad0a1e0b?filePath=models/mart_crm_touchpoint.sql
→ 200 OK
{
  "file": { "path": "models/mart_crm_touchpoint.sql" },
  "focalObjects": [{ "name": "mart_crm_touchpoint" }],
  "nodes": [...],  // Should have multiple nodes
  "edges": [...]   // Should have edges!
}
```

## Files to Check

1. `frontend/src/pages/dashboard/CodeBase.tsx`
   - Where connection ID is selected
   - Repository list fetching

2. `frontend/src/components/lineage/CodeLineageView.tsx`
   - Where connection ID is passed to API

3. `backend/src/api/controllers/universal-repository.controller.ts`
   - Repository listing endpoint

## Quick Validation

Run this query to see if lineage works with correct ID:
```sql
-- Get file
SELECT id, relative_path 
FROM metadata.files 
WHERE repository_id = '085dd350-9579-4638-9709-928ce45301f1'
  AND relative_path LIKE '%mart_crm_touchpoint%'
LIMIT 1;

-- Get objects from that file
SELECT o.id, o.name 
FROM metadata.objects o
JOIN metadata.files f ON o.file_id = f.id
WHERE f.relative_path LIKE '%mart_crm_touchpoint%'
  AND o.organization_id = '18c21d70-2f41-4603-9507-a84c4d437bc3';

-- Get dependencies for that object
SELECT COUNT(*) 
FROM metadata.dependencies
WHERE organization_id = '18c21d70-2f41-4603-9507-a84c4d437bc3';
```

If these queries return data, the metadata is fine - it's just a connection ID issue!

## Success Criteria

✅ Frontend uses correct connection ID: `eefc32e2-b10a-4bd1-80c1-0225ad0a1e0b`
✅ API returns lineage data for files
✅ Each file shows different lineage
✅ Dependencies are displayed correctly

## Next Steps

1. **Find where frontend gets connection ID** - Check CodeBase.tsx
2. **Update to use correct ID** - Either fix API or frontend
3. **Test lineage** - Should work immediately!
4. **Clean up duplicate connections** - If any exist

---

**The good news:** All the metadata is there! We just need to point the frontend to the right connection. 🎉
