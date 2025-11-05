# Unified Multi-Source Lineage System

## ✅ Implementation Complete

A robust, scalable system for handling lineage across multiple data sources (GitHub/dbt, Snowflake, BigQuery, etc.) while preventing duplicates and enabling cross-source linking.

---

## 🎯 Features

### 1. **Duplicate Prevention**
- **FQN-based uniqueness**: Objects identified by Fully Qualified Name (FQN) + Organization ID
- **Unique constraint**: `objects_fqn_org_unique` prevents same object from being stored twice
- **Format**: `database.schema.object_name` (e.g., `SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMERS`)

### 2. **Multi-Source Support**
- **GitHub/dbt**: Model dependencies
- **Snowflake**: Foreign keys + view lineage
- **BigQuery**: (Ready for future implementation)
- **Databricks**: (Ready for future implementation)

### 3. **Cross-Source Linking**
- **Object Mappings Table**: Links logical objects (dbt models) to physical objects (Snowflake tables)
- **Confidence Scores**: Track mapping certainty (0.0 to 1.0)
- **Metadata**: Store additional context about mappings

### 4. **Unified Lineage View**
- **Single Query Interface**: Combines all lineage sources
- **Three Lineage Types**:
  - `dbt_dependency`: Model → Model
  - `foreign_key`: Table → Table (via FK constraints)
  - `view_lineage`: Table → View (via column lineage)

### 5. **Recursive Lineage Traversal**
- **Database Function**: `get_lineage_graph()`
- **Configurable Depth**: Traverse up to N levels
- **Direction Control**: Upstream, downstream, or both
- **Performance Optimized**: Uses recursive CTEs

---

## 📁 Files Created

### Database
- `supabase/migrations/20251104000002_unified_lineage_system.sql`
  - Unique constraint on FQN
  - `object_mappings` table for cross-source linking
  - `unified_lineage` view combining all sources
  - `get_lineage_graph()` function for recursive traversal

### Backend API
- `backend/src/api/controllers/unified-lineage.controller.ts`
  - `getUnifiedLineage()`: Get lineage graph for an object
  - `getLineageStats()`: Get organization-wide lineage statistics

- `backend/src/api/routes/unified-lineage.routes.ts`
  - `GET /api/lineage/unified/:objectId`: Fetch lineage
  - `GET /api/lineage/stats`: Get stats

- `backend/src/app.ts` (updated)
  - Registered unified lineage routes

### Frontend
- `frontend/src/pages/dashboard/DataLineage.tsx` (updated)
  - Support for Snowflake objects (no connection_id required)
  - `connectionId` state now allows `null`

---

## 🔧 Database Schema

### Objects Table (Enhanced)
```sql
ALTER TABLE metadata.objects 
ADD CONSTRAINT objects_fqn_org_unique 
UNIQUE (fqn, organization_id);
```

### Object Mappings Table (New)
```sql
CREATE TABLE metadata.object_mappings (
  id UUID PRIMARY KEY,
  logical_object_id UUID,   -- dbt model
  physical_object_id UUID,  -- Snowflake table
  mapping_type TEXT,        -- 'dbt_to_snowflake', etc.
  confidence NUMERIC(3,2),  -- 0.0 to 1.0
  metadata JSONB,
  organization_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Unified Lineage View
```sql
CREATE VIEW metadata.unified_lineage AS
  -- dbt dependencies
  SELECT ... FROM metadata.dependencies
  UNION ALL
  -- Foreign keys
  SELECT ... FROM metadata.constraints
  UNION ALL
  -- View lineage
  SELECT ... FROM metadata.columns_lineage;
```

---

## 🚀 API Endpoints

### Get Unified Lineage
```
GET /api/lineage/unified/:objectId?depth=3&direction=both&includeTypes=github,snowflake
```

**Query Parameters:**
- `depth` (number, default: 3): How many levels to traverse
- `direction` (string, default: 'both'): 'upstream' | 'downstream' | 'both'
- `includeTypes` (string, optional): Comma-separated source types (e.g., 'github,snowflake')

**Response:**
```json
{
  "focal_object": {
    "id": "uuid",
    "name": "customers",
    "fqn": "analytics.marts.customers",
    "type": "model",
    "source": "github"
  },
  "nodes": [
    {
      "id": "uuid",
      "name": "customers",
      "fqn": "SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.CUSTOMERS",
      "type": "table",
      "source": "snowflake"
    }
  ],
  "edges": [
    {
      "source": "uuid1",
      "target": "uuid2",
      "type": "foreign_key",
      "confidence": 1.0
    }
  ],
  "stats": {
    "total_nodes": 15,
    "total_edges": 12,
    "sources": ["github", "snowflake"],
    "max_depth": 3
  }
}
```

### Get Lineage Statistics
```
GET /api/lineage/stats
```

**Response:**
```json
{
  "objects_by_source": {
    "github": 50,
    "snowflake": 30,
    "bigquery": 0
  },
  "lineage_by_type": {
    "dbt_dependency": 45,
    "foreign_key": 12,
    "view_lineage": 8
  },
  "total_objects": 80,
  "total_relationships": 65
}
```

---

## 🔄 How It Works

### 1. **Extraction Phase**
```typescript
// Snowflake Connector extracts tables
const fqn = `${database}.${schema}.${table}`;

// Check if object already exists
const existing = await supabase
  .from('objects')
  .select('id')
  .eq('fqn', fqn)
  .eq('organization_id', orgId)
  .maybeSingle();

if (existing) {
  // Update or skip based on strategy
} else {
  // Insert new object
}
```

### 2. **Lineage Extraction**
- **dbt**: Parsed from manifest.json → `metadata.dependencies`
- **Snowflake FK**: `SHOW IMPORTED KEYS` → `metadata.constraints`
- **Snowflake Views**: SQLGlot parsing → `metadata.columns_lineage`

### 3. **Query Phase**
```sql
-- Get lineage graph (recursive)
SELECT * FROM metadata.get_lineage_graph(
  p_object_id := 'uuid',
  p_organization_id := 'uuid',
  p_depth := 3,
  p_direction := 'both'
);
```

### 4. **Visualization**
- Frontend calls `/api/lineage/unified/:objectId`
- Receives nodes + edges
- Renders using React Flow or D3.js
- Color-codes by source type (GitHub = blue, Snowflake = cyan)

---

## 📊 Example Lineage Flow

```
GitHub (dbt)                    Snowflake
┌──────────────┐               ┌──────────────┐
│ stg_customers│──depends_on──→│  CUSTOMERS   │
│  (model)     │               │   (table)    │
└──────────────┘               └──────┬───────┘
                                      │ FK
                                      ↓
                               ┌──────────────┐
                               │    ORDERS    │
                               │   (table)    │
                               └──────┬───────┘
                                      │ view_lineage
                                      ↓
                               ┌──────────────┐
                               │customer_orders│
                               │    (view)    │
                               └──────────────┘
```

---

## 🧪 Testing

### 1. Run Migration
```bash
# Apply the migration
cd supabase
supabase db push
```

### 2. Test API
```bash
# Get lineage for a Snowflake object
curl http://localhost:3001/api/lineage/unified/OBJECT_UUID?depth=2

# Get lineage stats
curl http://localhost:3001/api/lineage/stats
```

### 3. Test Frontend
1. Navigate to Data Lineage page
2. Search for "customer"
3. Click on a Snowflake object (CUSTOMERS, CUSTOMER_ORDERS)
4. Lineage should render without errors
5. Should show both GitHub and Snowflake objects if both exist

---

## 🎯 Next Steps

### Phase 3: Deduplication Logic (Future)
- Implement smart merge when same object exists in multiple sources
- Priority: dbt > Snowflake > BigQuery
- Keep both but link via `object_mappings`

### Phase 4: Frontend Visualization (Future)
- Update lineage graph to show source badges
- Color-code nodes by source type
- Add filters to show/hide specific sources
- Show lineage type on edges (FK, dependency, view)

### Phase 5: Additional Connectors (Future)
- BigQuery connector with lineage extraction
- Databricks connector with lineage extraction
- Redshift connector with lineage extraction

---

## ✅ Status

- ✅ Database schema complete
- ✅ Backend API complete
- ✅ Frontend support for Snowflake objects
- ✅ Unified lineage view
- ✅ Recursive lineage traversal
- ⏳ Frontend visualization (uses existing lineage view)
- ⏳ Deduplication logic (manual for now)
- ⏳ Cross-source mapping (table ready, logic pending)

---

## 🐛 Known Limitations

1. **No Automatic Deduplication**: If same table exists in GitHub and Snowflake, both will be stored separately (for now)
2. **Manual Cross-Source Linking**: `object_mappings` table exists but not auto-populated yet
3. **Frontend Visualization**: Uses existing lineage view, not yet optimized for multi-source display

---

## 📚 References

- **FQN Format**: `database.schema.object_name`
- **Source Types**: `github`, `snowflake`, `bigquery`, `databricks`, `redshift`
- **Lineage Types**: `dbt_dependency`, `foreign_key`, `view_lineage`
- **Mapping Types**: `dbt_to_snowflake`, `view_to_table`, `logical_to_physical`
