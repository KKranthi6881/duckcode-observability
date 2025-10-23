# Code Lineage Issue - Root Cause Analysis

## Problem Statement
When clicking on different files in the CodeBase UI, the code lineage view shows the **same lineage for all files** instead of file-specific lineage. The system is not properly leveraging metadata to search and display file-specific lineage.

## Root Cause Analysis

### Issue #1: Model Name Matching Logic is Flawed ❌

**Location:** `frontend/src/components/lineage/CodeLineageView.tsx` (Lines 118-166)

**Current Implementation:**
```typescript
// Extract model name from file path
const getModelName = () => {
  if (!fileName && !filePath) return null;
  const name = fileName || filePath?.split('/').pop() || '';
  return name.replace(/\.(sql|py|yml|yaml)$/i, '');
};

// Find the model ID for the current file
const currentModel = modelName 
  ? allNodes.find((n: LineageNode) => n.name.toLowerCase() === modelName.toLowerCase())
  : null;
```

**Problems:**
1. **Simple name matching is insufficient**: 
   - File: `models/staging/stg_customers.sql` → extracts `stg_customers`
   - But metadata object might be stored as:
     - `stg_customers` (simple name)
     - `staging.stg_customers` (schema.name)
     - `analytics.staging.stg_customers` (database.schema.name)
   
2. **No file path matching**: The code only matches by `name` field, but doesn't use the `file_id` or `file_path` relationship that exists in the metadata schema.

3. **Ignores metadata relationships**: The `metadata.objects` table has a `file_id` field that links directly to `metadata.files`, but this relationship is not being used.

### Issue #2: Missing File Path in API Response ❌

**Location:** `backend/src/api/controllers/metadata-lineage.controller.ts` (Lines 69-80)

**Current API Response:**
```typescript
const nodes = (objects || []).map(obj => ({
  id: obj.id,
  name: obj.name,
  type: obj.object_type,
  description: obj.description,
  metadata: obj.metadata,
  stats: { ... }
}));
```

**Problem:** The API doesn't return:
- `file_id` - to link back to the file
- `file_path` - to match against the clicked file
- `full_name` - the computed database.schema.name field
- `schema_name`, `database_name` - for better matching

### Issue #3: No Direct File-to-Object Query ❌

**Current Flow:**
1. User clicks file: `models/marts/customers.sql`
2. Frontend fetches **ALL** models for the connection
3. Frontend tries to find matching model by name only
4. If match fails → shows all lineage (fallback)

**Better Flow Should Be:**
1. User clicks file: `models/marts/customers.sql`
2. Backend queries: "Find all objects WHERE file_path = 'models/marts/customers.sql'"
3. Backend returns only objects from that specific file
4. Frontend shows lineage for those specific objects

## Database Schema (What We Have Available)

```sql
-- metadata.files table
CREATE TABLE metadata.files (
    id UUID PRIMARY KEY,
    repository_id UUID,
    file_path TEXT NOT NULL,  -- ✅ Full path like "models/marts/customers.sql"
    file_name TEXT,
    file_type TEXT,
    ...
);

-- metadata.objects table
CREATE TABLE metadata.objects (
    id UUID PRIMARY KEY,
    file_id UUID REFERENCES metadata.files(id),  -- ✅ Direct link to file!
    name TEXT NOT NULL,                          -- ✅ Simple name like "customers"
    schema_name TEXT,
    database_name TEXT,
    full_name TEXT GENERATED ALWAYS AS (...),    -- ✅ Computed full name
    object_type TEXT NOT NULL,
    ...
);

-- metadata.dependencies table
CREATE TABLE metadata.dependencies (
    id UUID PRIMARY KEY,
    source_object_id UUID REFERENCES metadata.objects(id),
    target_object_id UUID REFERENCES metadata.objects(id),
    dependency_type TEXT,
    ...
);
```

## Solution Architecture

### Solution 1: Add File-Based Lineage API Endpoint ✅ (RECOMMENDED)

**New Backend Endpoint:**
```typescript
// GET /api/metadata/lineage/by-file/:connectionId?filePath=models/marts/customers.sql

export async function getLineageByFilePath(req: AuthenticatedRequest, res: Response) {
  const { connectionId } = req.params;
  const { filePath } = req.query;
  const organizationId = req.user.organization_id;

  // Step 1: Find the file
  const { data: file } = await supabase
    .schema('metadata')
    .from('files')
    .select('id, file_path, file_name')
    .eq('repository_id', connectionId)
    .eq('file_path', filePath)
    .single();

  if (!file) {
    return res.status(404).json({ error: 'File not found in metadata' });
  }

  // Step 2: Get all objects from this file
  const { data: objects } = await supabase
    .schema('metadata')
    .from('objects')
    .select('id, name, full_name, object_type, description, metadata')
    .eq('file_id', file.id)
    .eq('organization_id', organizationId);

  if (!objects || objects.length === 0) {
    return res.status(404).json({ 
      error: 'No objects found in this file',
      file: file 
    });
  }

  // Step 3: Get focused lineage for these objects
  const objectIds = objects.map(o => o.id);
  
  // Get upstream dependencies (what this file depends on)
  const { data: upstreamDeps } = await supabase
    .schema('metadata')
    .from('dependencies')
    .select(`
      id,
      source_object_id,
      target_object_id,
      dependency_type,
      source:objects!source_object_id(id, name, full_name, object_type, file_id),
      target:objects!target_object_id(id, name, full_name, object_type, file_id)
    `)
    .in('target_object_id', objectIds)
    .eq('organization_id', organizationId)
    .limit(50);

  // Get downstream dependencies (what depends on this file)
  const { data: downstreamDeps } = await supabase
    .schema('metadata')
    .from('dependencies')
    .select(`
      id,
      source_object_id,
      target_object_id,
      dependency_type,
      source:objects!source_object_id(id, name, full_name, object_type, file_id),
      target:objects!target_object_id(id, name, full_name, object_type, file_id)
    `)
    .in('source_object_id', objectIds)
    .eq('organization_id', organizationId)
    .limit(50);

  // Combine and deduplicate nodes
  const allDeps = [...(upstreamDeps || []), ...(downstreamDeps || [])];
  const nodeMap = new Map();
  
  // Add focal objects (from the clicked file)
  objects.forEach(obj => {
    nodeMap.set(obj.id, { ...obj, isFocal: true, filePath: file.file_path });
  });
  
  // Add related objects
  allDeps.forEach(dep => {
    if (dep.source && !nodeMap.has(dep.source.id)) {
      nodeMap.set(dep.source.id, { ...dep.source, isFocal: false });
    }
    if (dep.target && !nodeMap.has(dep.target.id)) {
      nodeMap.set(dep.target.id, { ...dep.target, isFocal: false });
    }
  });

  return res.json({
    file: {
      id: file.id,
      path: file.file_path,
      name: file.file_name
    },
    focalObjects: objects,
    nodes: Array.from(nodeMap.values()),
    edges: allDeps.map(dep => ({
      id: dep.id,
      source: dep.source_object_id,
      target: dep.target_object_id,
      type: dep.dependency_type
    })),
    metadata: {
      totalNodes: nodeMap.size,
      totalEdges: allDeps.length,
      focalObjectCount: objects.length
    }
  });
}
```

**Frontend Update:**
```typescript
// In CodeLineageView.tsx
const fetchModelLineage = async () => {
  try {
    setLoading(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Please sign in to view lineage');
      return;
    }

    // NEW: Use file-based lineage API if we have a file path
    if (filePath) {
      const response = await fetch(
        `http://localhost:3001/api/metadata/lineage/by-file/${connectionId}?filePath=${encodeURIComponent(filePath)}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError('No lineage data found for this file. Make sure metadata has been extracted.');
        } else {
          throw new Error(`Failed to fetch file lineage: ${response.statusText}`);
        }
        return;
      }

      const data = await response.json();
      
      // Convert to ReactFlow format
      const flowNodes = await Promise.all(data.nodes.map(async (node: any) => {
        // Fetch columns...
        return {
          id: node.id,
          type: 'expandableModel',
          data: {
            id: node.id,
            name: node.full_name || node.name,
            label: node.name,
            type: node.object_type,
            description: node.description,
            filePath: node.filePath,
            isFocal: node.isFocal,  // Highlight the clicked file's objects
            // ... other fields
          },
          position: { x: 0, y: 0 }
        };
      }));

      const flowEdges = data.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...defaultEdgeOptions
      }));

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      
    } else {
      // Fallback: Show all lineage if no file selected
      // ... existing code
    }
  } catch (err) {
    console.error('Error fetching lineage:', err);
    setError('Failed to load lineage data');
  } finally {
    setLoading(false);
  }
};
```

### Solution 2: Improve Name Matching (Quick Fix, Less Reliable)

If we can't add a new endpoint immediately, improve the name matching:

```typescript
// Better matching logic
const findMatchingModel = (allNodes: LineageNode[], fileName: string, filePath: string) => {
  const cleanName = fileName.replace(/\.(sql|py|yml|yaml)$/i, '');
  
  // Try multiple matching strategies
  return allNodes.find(node => {
    // 1. Exact name match
    if (node.name.toLowerCase() === cleanName.toLowerCase()) return true;
    
    // 2. Full name match (schema.name or database.schema.name)
    if (node.full_name?.toLowerCase() === cleanName.toLowerCase()) return true;
    
    // 3. Name ends with the file name (for schema-qualified names)
    if (node.name.toLowerCase().endsWith(cleanName.toLowerCase())) return true;
    if (node.full_name?.toLowerCase().endsWith(cleanName.toLowerCase())) return true;
    
    // 4. File path contains the model name
    if (filePath && node.metadata?.file_path === filePath) return true;
    
    return false;
  });
};
```

## Recommended Implementation Plan

1. **Phase 1: Add File-Based Lineage API** (1-2 hours)
   - Create new endpoint: `GET /api/metadata/lineage/by-file/:connectionId`
   - Add route in `metadata-lineage.routes.ts`
   - Test with sample files

2. **Phase 2: Update Frontend** (30 mins)
   - Modify `CodeLineageView.tsx` to use new endpoint when `filePath` is provided
   - Add better error handling for "file not found" cases
   - Add visual indicator for focal objects (highlight the clicked file's models)

3. **Phase 3: Add File Path to Existing API** (15 mins)
   - Update `getModelLineage` to include `file_path` in response
   - Join with `metadata.files` table to get file information

4. **Phase 4: Testing** (30 mins)
   - Test with various file types (SQL, Python, YAML)
   - Test with files that have multiple objects
   - Test with files that have no lineage
   - Test with non-existent files

## Expected Behavior After Fix

### Before (Current - Broken):
1. Click on `models/staging/stg_customers.sql` → Shows all lineage
2. Click on `models/marts/customers.sql` → Shows same all lineage
3. Click on `models/marts/orders.sql` → Shows same all lineage

### After (Fixed):
1. Click on `models/staging/stg_customers.sql` → Shows lineage for `stg_customers` model only
2. Click on `models/marts/customers.sql` → Shows lineage for `customers` model only
3. Click on `models/marts/orders.sql` → Shows lineage for `orders` model only
4. Click on repository (no file selected) → Shows all lineage (overview)

## Benefits of File-Based Approach

1. ✅ **Accurate**: Uses database relationships instead of string matching
2. ✅ **Fast**: Single query with proper indexes
3. ✅ **Scalable**: Works with large repositories
4. ✅ **Flexible**: Handles files with multiple objects
5. ✅ **Debuggable**: Clear error messages when file not found
6. ✅ **Future-proof**: Can extend to show column-level lineage per file
