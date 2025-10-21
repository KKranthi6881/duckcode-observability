# Visualization Data Flow Architecture 📊

**Question:** Where do we get data for visualization - metadata tables or manifest.json?

**Answer:** ✅ **METADATA TABLES** (not manifest.json)

---

## 🔄 Complete Data Flow

### Phase 1: EXTRACTION (One-time / On-demand)

```
manifest.json (GitHub repo)
         │
         │ 1. Extract & Parse
         ▼
┌────────────────────────┐
│  ExtractionOrchestrator│
│  + ManifestParser      │
│  + EnhancedSQLParser   │
└────────┬───────────────┘
         │
         │ 2. Store
         ▼
┌─────────────────────────────────────────┐
│        PostgreSQL Database              │
├─────────────────────────────────────────┤
│ metadata.objects                        │
│ metadata.columns                        │
│ metadata.dependencies (model-level)     │
│ metadata.columns_lineage (column-level) │
└─────────────────────────────────────────┘
```

**Happens:**
- When user clicks "Extract" button
- When GitHub webhook fires (future)
- Periodically via scheduler (future)

---

### Phase 2: VISUALIZATION (Real-time / Interactive)

```
┌──────────────────┐
│  Frontend User   │
│  Click "Lineage" │
└────────┬─────────┘
         │
         │ 3. API Request
         ▼
┌────────────────────────┐
│  Backend API           │
│  /api/metadata/lineage │
└────────┬───────────────┘
         │
         │ 4. SQL Query
         ▼
┌─────────────────────────────────────────┐
│        PostgreSQL Database              │
│  SELECT from metadata.dependencies      │
│  JOIN metadata.objects                  │
│  JOIN metadata.columns_lineage          │
└────────┬────────────────────────────────┘
         │
         │ 5. Return JSON
         ▼
┌────────────────────────┐
│  Frontend Component    │
│  - ModelLineageGraph   │
│  - ColumnLineageTable  │
└────────────────────────┘
```

**Happens:**
- Every time user views lineage
- Real-time queries
- Fast (< 500ms)

---

## ✅ Why Query Metadata Tables (Not Manifest)?

### 1. **Performance**
```typescript
// ❌ BAD: Parse manifest every time
User clicks lineage → Fetch manifest.json from GitHub → Parse → Render
// 10-30 seconds! 😱

// ✅ GOOD: Query database
User clicks lineage → SQL query → Render
// 100-500ms! ⚡
```

### 2. **Consistency**
```typescript
// ❌ BAD: Manifest might change
User A sees version 1 → manifest updated → User B sees version 2
// Inconsistent!

// ✅ GOOD: Database is source of truth
All users see same data until next extraction
// Consistent snapshot!
```

### 3. **Rich Queries**
```sql
-- ❌ Can't do this with manifest.json:
SELECT * FROM metadata.columns_lineage
WHERE confidence > 0.90
  AND transformation_type = 'aggregation'
  AND target_column LIKE '%total%'
ORDER BY confidence DESC
LIMIT 10;

-- ✅ Easy with database!
```

### 4. **Multi-Project Support**
```typescript
// ✅ Query across multiple dbt projects
SELECT 
  o1.name as source_model,
  o2.name as target_model,
  gc.repository_url
FROM metadata.dependencies d
JOIN metadata.objects o1 ON d.source_object_id = o1.id
JOIN metadata.objects o2 ON d.target_object_id = o2.id
JOIN enterprise.github_connections gc ON o1.connection_id = gc.id
WHERE gc.organization_id = 'user-org';

// All projects in one query!
```

### 5. **Filtering & Pagination**
```typescript
// ✅ Easy with SQL
GET /api/metadata/lineage?
  model=customers&
  depth=3&
  direction=upstream&
  page=1&
  limit=50

// ❌ Hard with manifest parsing
```

---

## 📊 API Endpoints for Visualization

### Endpoint 1: Model-Level Lineage
```typescript
GET /api/metadata/lineage/model/:modelId

Response:
{
  model: {
    id: "uuid",
    name: "customers",
    type: "model"
  },
  upstream: [
    {
      id: "uuid",
      name: "stg_customers",
      type: "model",
      confidence: 1.00,
      dependency_type: "dbt_ref"
    },
    {
      id: "uuid",
      name: "stg_orders",
      type: "model",
      confidence: 1.00,
      dependency_type: "dbt_ref"
    }
  ],
  downstream: [
    {
      id: "uuid",
      name: "fact_orders",
      type: "model",
      confidence: 1.00,
      dependency_type: "dbt_ref"
    }
  ]
}

// SQL Query:
SELECT 
  o.id, o.name, o.object_type,
  d.confidence, d.dependency_type
FROM metadata.objects o
JOIN metadata.dependencies d ON o.id = d.source_object_id
WHERE d.target_object_id = :modelId;
```

### Endpoint 2: Column-Level Lineage
```typescript
GET /api/metadata/lineage/column/:objectId/:columnName

Response:
{
  target: {
    model: "customers",
    column: "total_orders",
    type: "BIGINT"
  },
  sources: [
    {
      model: "stg_orders",
      column: "order_id",
      type: "INTEGER",
      transformation_type: "aggregation",
      confidence: 0.85,
      expression: "COUNT(o.order_id)"
    }
  ]
}

// SQL Query:
SELECT 
  so.name as source_model,
  cl.source_column,
  cl.transformation_type,
  cl.confidence,
  cl.metadata->>'expression' as expression
FROM metadata.columns_lineage cl
JOIN metadata.objects so ON cl.source_object_id = so.id
JOIN metadata.objects tgt ON cl.target_object_id = tgt.id
WHERE tgt.id = :objectId 
  AND cl.target_column = :columnName;
```

### Endpoint 3: Full Lineage Graph
```typescript
GET /api/metadata/lineage/graph/:connectionId?depth=5

Response:
{
  nodes: [
    { id: "1", name: "raw_customers", type: "seed", level: 0 },
    { id: "2", name: "stg_customers", type: "model", level: 1 },
    { id: "3", name: "customers", type: "model", level: 2 }
  ],
  edges: [
    { source: "1", target: "2", confidence: 1.00 },
    { source: "2", target: "3", confidence: 1.00 }
  ]
}

// SQL Query:
WITH RECURSIVE lineage_tree AS (
  -- Base: all objects
  SELECT id, name, object_type, 0 as level
  FROM metadata.objects
  WHERE connection_id = :connectionId
  
  UNION
  
  -- Recursive: follow dependencies
  SELECT o.id, o.name, o.object_type, lt.level + 1
  FROM metadata.objects o
  JOIN metadata.dependencies d ON o.id = d.target_object_id
  JOIN lineage_tree lt ON d.source_object_id = lt.id
  WHERE lt.level < :depth
)
SELECT * FROM lineage_tree;
```

---

## 🎨 Frontend Data Flow

### Component: ModelLineageGraph.tsx

```typescript
const ModelLineageGraph: React.FC<{ modelId: string }> = ({ modelId }) => {
  const [lineageData, setLineageData] = useState(null);

  useEffect(() => {
    // ✅ Fetch from API (which queries metadata tables)
    fetch(`/api/metadata/lineage/model/${modelId}`)
      .then(res => res.json())
      .then(data => setLineageData(data));
  }, [modelId]);

  // Render using D3.js or Mermaid
  return (
    <div>
      {/* Model DAG visualization */}
      <LineageDAG nodes={lineageData.nodes} edges={lineageData.edges} />
    </div>
  );
};
```

### Component: ColumnLineageTable.tsx

```typescript
const ColumnLineageTable: React.FC<{ modelId: string }> = ({ modelId }) => {
  const [columns, setColumns] = useState([]);

  useEffect(() => {
    // ✅ Query metadata tables for column lineage
    fetch(`/api/metadata/objects/${modelId}/columns/lineage`)
      .then(res => res.json())
      .then(data => setColumns(data));
  }, [modelId]);

  return (
    <table>
      {columns.map(col => (
        <tr key={col.name}>
          <td>{col.name}</td>
          <td>
            {col.sources.map(src => (
              <div>
                {src.model}.{src.column}
                <span className="badge">{src.confidence * 100}%</span>
              </div>
            ))}
          </td>
        </tr>
      ))}
    </table>
  );
};
```

---

## 🔄 When Do We Use Manifest.json?

### ✅ Use Manifest (Extraction Phase):
1. **Initial extraction** - Parse and store data
2. **Re-extraction** - User clicks "Refresh" or "Extract"
3. **Validation** - Compare database vs current manifest
4. **Debugging** - Check what manifest says vs what we stored

### ❌ Don't Use Manifest (Visualization Phase):
1. **Displaying lineage** - Query database instead
2. **Searching models** - Database is indexed
3. **Filtering data** - SQL is powerful
4. **Real-time updates** - Database is faster

---

## 📊 Database Schema (What We Query)

### metadata.objects
```sql
SELECT id, name, object_type, schema_name
FROM metadata.objects
WHERE connection_id = :connectionId;

-- Powers: Model list, search, filters
```

### metadata.dependencies
```sql
SELECT 
  source_object_id,
  target_object_id,
  dependency_type,
  confidence
FROM metadata.dependencies
WHERE source_object_id = :modelId;

-- Powers: Model lineage graph (DAG)
```

### metadata.columns_lineage
```sql
SELECT 
  source_object_id,
  source_column,
  target_object_id,
  target_column,
  transformation_type,
  confidence
FROM metadata.columns_lineage
WHERE target_object_id = :modelId;

-- Powers: Column lineage table/diagram
```

---

## ⚡ Performance Optimization

### Indexes for Fast Queries
```sql
-- Already exist!
CREATE INDEX idx_dependencies_source ON metadata.dependencies(source_object_id);
CREATE INDEX idx_dependencies_target ON metadata.dependencies(target_object_id);
CREATE INDEX idx_lineage_source ON metadata.columns_lineage(source_object_id);
CREATE INDEX idx_lineage_target ON metadata.columns_lineage(target_object_id);

-- Result: Queries in 50-200ms ⚡
```

### Caching (Future Enhancement)
```typescript
// Cache frequently accessed lineage
const cache = new Redis();

async function getModelLineage(modelId: string) {
  const cached = await cache.get(`lineage:${modelId}`);
  if (cached) return JSON.parse(cached);
  
  const lineage = await queryDatabase(modelId);
  await cache.set(`lineage:${modelId}`, JSON.stringify(lineage), 'EX', 3600);
  
  return lineage;
}
```

---

## 🎯 Summary

### Data Flow:
```
Extraction:  manifest.json → Parse → Store in metadata.* tables
Visualization: Query metadata.* tables → Render UI
```

### Why This Way:
✅ **Fast** - SQL queries are sub-second  
✅ **Consistent** - Single source of truth  
✅ **Powerful** - Rich SQL queries  
✅ **Scalable** - Handle multiple projects  
✅ **Indexed** - Optimized for reads  

### When We Touch Manifest:
- Only during extraction/refresh
- Not during visualization
- Stored once, queried many times

---

**The manifest.json is the INPUT, metadata tables are the SOURCE OF TRUTH for visualization!** 🎯
