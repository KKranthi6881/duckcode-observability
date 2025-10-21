# DuckCode Lineage: Master Architecture & Implementation Plan

**Version:** 1.0  
**Last Updated:** October 20, 2025  
**Status:** In Progress - Phase 1 (Cloud Implementation)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Implementation Phases](#implementation-phases)
5. [API Specifications](#api-specifications)
6. [Data Flow](#data-flow)
7. [Testing Strategy](#testing-strategy)
8. [Success Metrics](#success-metrics)

---

## Executive Summary

### Vision
Build enterprise-grade data lineage system that works both in **cloud (team collaboration)** and **local IDE (developer productivity)** with unified schema and seamless sync.

### Unique Value Proposition
- ✅ **GitHub-first:** No dbt Cloud subscription required
- ✅ **Manifest-powered:** 100% model lineage, 90%+ column lineage
- ✅ **IDE-native:** Real-time lineage as you code (KILLER FEATURE)
- ✅ **Unified schema:** Same tables in SQLite (local) and PostgreSQL (cloud)

### Technology Stack
- **Cloud Backend:** Node.js + TypeScript + Supabase PostgreSQL
- **Local IDE:** VS Code Extension + SQLite
- **Parsing:** SQLGlot (Python) for SQL analysis
- **Manifest:** dbt manifest.json (v12+)
- **Frontend:** React + TailwindCSS + D3.js (lineage graphs)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: CLOUD (Weeks 1-4)                   │
│                                                                 │
│  ┌────────────────┐      ┌──────────────────┐                 │
│  │   GitHub       │─────▶│  Backend API     │                 │
│  │   Repository   │      │  (Node.js)       │                 │
│  └────────────────┘      └──────────────────┘                 │
│         │                         │                            │
│         │ Clone repo              │ Parse & Store              │
│         ↓                         ↓                            │
│  ┌────────────────┐      ┌──────────────────┐                 │
│  │  SQL Files +   │─────▶│  PostgreSQL      │                 │
│  │  manifest.json │      │  (Supabase)      │                 │
│  └────────────────┘      └──────────────────┘                 │
│                                   │                            │
│                                   │ Query                      │
│                                   ↓                            │
│                          ┌──────────────────┐                 │
│                          │  Frontend        │                 │
│                          │  Dashboard       │                 │
│                          └──────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   PHASE 2: IDE (Weeks 5-8)                      │
│                                                                 │
│  ┌────────────────┐      ┌──────────────────┐                 │
│  │   VS Code      │      │  Local SQLite    │                 │
│  │   Extension    │─────▶│  Database        │                 │
│  └────────────────┘      └──────────────────┘                 │
│         │                         │                            │
│         │ Read local files        │ Store locally              │
│         ↓                         ↓                            │
│  ┌────────────────┐      ┌──────────────────┐                 │
│  │  dbt Project   │      │  Lineage Graph   │                 │
│  │  (Local)       │      │  (Webview)       │                 │
│  └────────────────┘      └──────────────────┘                 │
│                                   │                            │
│                                   │ Optional Sync              │
│                                   ↓                            │
│                          ┌──────────────────┐                 │
│                          │  Cloud Backend   │                 │
│                          │  (Same Schema!)  │                 │
│                          └──────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components Overview

| Component | Technology | Purpose | Phase |
|-----------|-----------|---------|-------|
| **Backend API** | Node.js + Express | Orchestrate extraction & serve data | Phase 1 |
| **Manifest Parser** | TypeScript | Parse manifest.json (100% lineage) | Phase 1 |
| **SQL Parser** | SQLGlot (Python) | Parse raw SQL (fallback) | Phase 1 |
| **Column Lineage** | SQLGlot + Custom | Extract column-level lineage | Phase 1 |
| **PostgreSQL** | Supabase | Cloud storage | Phase 1 |
| **Frontend** | React + D3.js | Lineage visualization | Phase 1 |
| **VS Code Extension** | TypeScript | Local analysis | Phase 2 |
| **SQLite** | Local DB | IDE storage | Phase 2 |
| **Sync Service** | TypeScript | Bi-directional sync | Phase 2 |

---

## Database Schema

### Unified Schema (SQLite + PostgreSQL)

Both local SQLite and cloud PostgreSQL use **identical core tables**:

```sql
-- ============================================
-- CORE TABLE 1: objects
-- Stores models, sources, CTEs, views
-- ============================================
CREATE TABLE objects (
  -- Identity
  id TEXT PRIMARY KEY,              -- UUID (cloud) or hash (local)
  
  -- Ownership (NULL in local, filled in cloud)
  organization_id TEXT,
  connection_id TEXT,
  workspace_id TEXT,                -- Links local ↔ cloud
  
  -- Object metadata
  name TEXT NOT NULL,
  object_type TEXT NOT NULL,        -- 'model', 'source', 'view', 'cte'
  schema_name TEXT,
  database_name TEXT,
  
  -- Code
  definition TEXT,                  -- Raw SQL with Jinja
  compiled_definition TEXT,         -- Compiled SQL from manifest
  
  -- Extraction metadata
  extracted_from TEXT NOT NULL,     -- 'manifest', 'sql_parsing', 'local_analysis'
  extraction_tier TEXT,             -- 'GOLD', 'SILVER', 'BRONZE'
  confidence REAL DEFAULT 1.0,      -- 0.0 - 1.0
  
  -- File info
  file_path TEXT,
  line_start INTEGER,
  line_end INTEGER,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  analyzed_at TEXT,
  
  -- Sync
  is_synced BOOLEAN DEFAULT 0,
  sync_hash TEXT,                   -- For change detection
  
  -- Indexes
  INDEX idx_objects_name (name),
  INDEX idx_objects_type (object_type),
  INDEX idx_objects_workspace (workspace_id)
);

-- ============================================
-- CORE TABLE 2: columns
-- Stores column definitions
-- ============================================
CREATE TABLE columns (
  -- Identity
  id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  
  -- Column metadata
  name TEXT NOT NULL,
  data_type TEXT,
  position INTEGER,
  is_nullable BOOLEAN DEFAULT 1,
  description TEXT,
  
  -- Extraction metadata
  extracted_from TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  -- Constraints
  FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,
  UNIQUE(object_id, name),
  
  -- Indexes
  INDEX idx_columns_object (object_id),
  INDEX idx_columns_name (name)
);

-- ============================================
-- CORE TABLE 3: dependencies
-- Model-level lineage
-- ============================================
CREATE TABLE dependencies (
  -- Identity
  id TEXT PRIMARY KEY,
  
  -- Lineage (source depends on target)
  source_object_id TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  
  -- Metadata
  dependency_type TEXT DEFAULT 'direct',  -- 'direct', 'ref', 'source'
  extracted_from TEXT NOT NULL,           -- 'manifest', 'sql_parsing'
  confidence REAL DEFAULT 1.0,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  
  -- Constraints
  FOREIGN KEY (source_object_id) REFERENCES objects(id) ON DELETE CASCADE,
  FOREIGN KEY (target_object_id) REFERENCES objects(id) ON DELETE CASCADE,
  UNIQUE(source_object_id, target_object_id),
  
  -- Indexes
  INDEX idx_deps_source (source_object_id),
  INDEX idx_deps_target (target_object_id)
);

-- ============================================
-- CORE TABLE 4: column_lineage
-- Column-level lineage
-- ============================================
CREATE TABLE column_lineage (
  -- Identity
  id TEXT PRIMARY KEY,
  
  -- Lineage (target column derived from source column)
  target_column_id TEXT NOT NULL,
  source_column_id TEXT NOT NULL,
  
  -- Transformation
  transformation TEXT,              -- SQL expression (e.g., "SUM(amount)")
  
  -- Metadata
  extracted_from TEXT NOT NULL,     -- 'manifest_parsing', 'compiled_code_parsing'
  confidence REAL DEFAULT 0.9,
  
  -- Timestamps
  created_at TEXT NOT NULL,
  
  -- Constraints
  FOREIGN KEY (target_column_id) REFERENCES columns(id) ON DELETE CASCADE,
  FOREIGN KEY (source_column_id) REFERENCES columns(id) ON DELETE CASCADE,
  UNIQUE(target_column_id, source_column_id),
  
  -- Indexes
  INDEX idx_col_lineage_target (target_column_id),
  INDEX idx_col_lineage_source (source_column_id)
);
```

### Cloud-Only Tables (PostgreSQL)

```sql
-- ============================================
-- CLOUD TABLE 1: connections
-- GitHub/GitLab repository connections
-- ============================================
CREATE TABLE metadata.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id),
  
  -- Connection info
  type TEXT NOT NULL,               -- 'github', 'gitlab'
  repo_url TEXT NOT NULL,
  branch TEXT DEFAULT 'main',
  
  -- Credentials (encrypted)
  access_token_encrypted TEXT,
  
  -- Status
  status TEXT DEFAULT 'active',     -- 'active', 'failed', 'disconnected'
  last_extraction_at TIMESTAMP,
  
  -- Manifest
  manifest_uploaded BOOLEAN DEFAULT FALSE,
  manifest_version TEXT,
  manifest_dbt_version TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CLOUD TABLE 2: workspaces
-- Link local IDE projects to cloud
-- ============================================
CREATE TABLE metadata.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id),
  connection_id UUID REFERENCES metadata.connections(id),
  
  -- Project info
  project_name TEXT NOT NULL,
  project_path_hash TEXT,           -- Hash of local path
  
  -- Sync metadata
  last_local_sync TIMESTAMP,
  ide_version TEXT,
  sync_enabled BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CLOUD TABLE 3: extraction_jobs
-- Track extraction progress
-- ============================================
CREATE TABLE metadata.extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES metadata.connections(id),
  
  -- Job info
  status TEXT DEFAULT 'pending',    -- 'pending', 'running', 'success', 'failed'
  extraction_type TEXT,             -- 'full', 'incremental'
  
  -- Results
  objects_extracted INTEGER DEFAULT 0,
  columns_extracted INTEGER DEFAULT 0,
  dependencies_extracted INTEGER DEFAULT 0,
  column_lineage_extracted INTEGER DEFAULT 0,
  
  -- Metadata
  extraction_tier TEXT,             -- 'GOLD', 'SILVER', 'BRONZE'
  error_message TEXT,
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### Local-Only Tables (SQLite)

```sql
-- ============================================
-- LOCAL TABLE 1: local_cache
-- Fast query cache
-- ============================================
CREATE TABLE local_cache (
  cache_key TEXT PRIMARY KEY,
  cache_type TEXT NOT NULL,         -- 'lineage_graph', 'impact_analysis'
  cache_data TEXT NOT NULL,         -- JSON
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- ============================================
-- LOCAL TABLE 2: analysis_history
-- Track analysis runs
-- ============================================
CREATE TABLE analysis_history (
  id TEXT PRIMARY KEY,
  analysis_type TEXT NOT NULL,      -- 'full', 'incremental', 'single_file'
  files_analyzed INTEGER DEFAULT 0,
  objects_found INTEGER DEFAULT 0,
  duration_ms INTEGER,
  extraction_tier TEXT,             -- 'GOLD', 'SILVER', 'BRONZE'
  has_manifest BOOLEAN DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ============================================
-- LOCAL TABLE 3: user_annotations
-- Developer notes on lineage
-- ============================================
CREATE TABLE user_annotations (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,        -- 'object', 'column', 'lineage'
  target_id TEXT NOT NULL,
  annotation TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- ============================================
-- LOCAL TABLE 4: sync_status
-- Track cloud sync
-- ============================================
CREATE TABLE sync_status (
  id TEXT PRIMARY KEY,
  workspace_id TEXT,
  last_sync_at TEXT,
  objects_synced INTEGER DEFAULT 0,
  sync_direction TEXT,              -- 'to_cloud', 'from_cloud'
  status TEXT,                      -- 'success', 'failed', 'pending'
  error_message TEXT,
  created_at TEXT NOT NULL
);
```

---

## Implementation Phases

### Phase 1: Cloud Foundation (Weeks 1-4) 🎯 CURRENT

**Goal:** Build cloud-based lineage system with GitHub + manifest support

#### Week 1: Manifest Parser & Model Lineage

**Tasks:**
1. ✅ Create `ManifestParser.ts` service
2. ✅ Parse manifest.json → extract models, sources
3. ✅ Extract model-level dependencies (100% accurate)
4. ✅ Store in `metadata.objects` and `metadata.dependencies`
5. ✅ Add manifest upload endpoint

**Deliverables:**
- `backend/src/services/metadata/parsers/ManifestParser.ts`
- `POST /api/metadata/connections/:id/manifest` endpoint
- Database migration for unified schema
- Unit tests for manifest parsing

**Success Criteria:**
- Parse jaffle_shop manifest.json
- Extract 45 models with 100% accuracy
- Store 156 dependencies correctly

#### Week 2: Column Lineage Extraction

**Tasks:**
1. Create `ColumnLineageExtractor.ts` service
2. Parse `compiled_code` from manifest with SQLGlot
3. Extract column-to-column mappings
4. Handle transformations (SUM, CASE, COALESCE)
5. Store in `metadata.column_lineage`

**Deliverables:**
- `backend/src/services/metadata/parsers/ColumnLineageExtractor.ts`
- SQLGlot integration (Python subprocess or API)
- Column lineage storage logic

**Success Criteria:**
- Extract 400+ column lineages from jaffle_shop
- 90%+ accuracy on simple transformations
- Handle 80%+ of CASE/COALESCE expressions

#### Week 3: SQL Parser Fallback

**Tasks:**
1. Enhance existing SQL parser to filter CTEs
2. Detect dbt `{{ ref() }}` and `{{ source() }}`
3. Extract basic column lineage from raw SQL
4. Implement confidence scoring

**Deliverables:**
- Enhanced `SQLParser.ts`
- CTE filtering logic
- dbt macro detection

**Success Criteria:**
- Parse non-manifest dbt projects
- 70% model lineage accuracy (SILVER tier)
- 60% column lineage accuracy

#### Week 4: Frontend Lineage Graph

**Tasks:**
1. Create lineage visualization component (D3.js)
2. Build DAG view for model lineage
3. Add column lineage drill-down
4. Implement impact analysis queries

**Deliverables:**
- `frontend/src/components/LineageGraph.tsx`
- API endpoints for lineage queries
- Interactive graph with zoom/pan

**Success Criteria:**
- Visualize 100+ node DAG smoothly
- Show column lineage on hover
- Impact analysis in < 500ms

---

### Phase 2: IDE Integration (Weeks 5-8)

**Goal:** Enable local dbt project analysis in VS Code

#### Week 5: VS Code Extension Setup

**Tasks:**
1. Create VS Code extension project
2. Detect dbt projects in workspace
3. Read local files (models/*.sql)
4. Initialize SQLite database

**Deliverables:**
- `duck-code-lineage-extension/` project
- Extension manifest (package.json)
- dbt project detection

**Success Criteria:**
- Detect dbt_project.yml
- Show notification in VS Code
- Read model files correctly

#### Week 6: Local Analysis Engine

**Tasks:**
1. Implement local manifest parsing
2. Call backend API for parsing (or local SQLGlot)
3. Store results in SQLite
4. Cache for fast queries

**Deliverables:**
- SQLite database creation
- Local analysis logic
- Caching layer

**Success Criteria:**
- Analyze 50 models in < 5 seconds
- Store in SQLite successfully
- Cache hits on repeat queries

#### Week 7: IDE UI Components

**Tasks:**
1. Create webview for lineage graph
2. Add hover providers for column lineage
3. Implement CodeLens for dependencies
4. Add context menu actions

**Deliverables:**
- Webview with D3.js graph
- Hover provider for columns
- "Show Lineage" command

**Success Criteria:**
- Lineage graph opens in < 1 second
- Hover shows sources correctly
- Right-click menu works

#### Week 8: Cloud Sync

**Tasks:**
1. Implement sync API endpoints
2. Export SQLite → JSON → PostgreSQL
3. Bidirectional sync
4. Conflict resolution

**Deliverables:**
- `POST /api/metadata/sync-from-ide` endpoint
- `GET /api/metadata/workspaces/:id/lineage` endpoint
- Sync UI in extension

**Success Criteria:**
- Sync 100 objects in < 2 seconds
- Pull team changes correctly
- Handle conflicts gracefully

---

## API Specifications

### Phase 1 APIs (Cloud)

#### 1. Upload Manifest

```typescript
POST /api/metadata/connections/:id/manifest
Authorization: Bearer <jwt_token>
Content-Type: application/json

Request Body:
{
  "manifest": {
    "metadata": { ... },
    "nodes": { ... },
    "sources": { ... },
    "parent_map": { ... }
  }
}

Response:
{
  "success": true,
  "extraction": {
    "models": 45,
    "sources": 12,
    "dependencies": 156,
    "column_lineage": 432,
    "extraction_tier": "GOLD",
    "accuracy": {
      "model_lineage": 1.0,
      "column_lineage": 0.95
    }
  },
  "job_id": "uuid"
}
```

#### 2. Get Lineage

```typescript
GET /api/metadata/connections/:id/lineage
Authorization: Bearer <jwt_token>

Query Parameters:
  - object_name: string (optional)
  - include_column_lineage: boolean (default: false)
  - depth: number (default: 1, max: 5)

Response:
{
  "objects": [
    {
      "id": "uuid",
      "name": "customers",
      "object_type": "model",
      "columns": [
        {
          "id": "uuid",
          "name": "customer_id",
          "data_type": "integer"
        }
      ]
    }
  ],
  "dependencies": [
    {
      "source": "customers",
      "target": "stg_customers",
      "confidence": 1.0
    }
  ],
  "column_lineage": [
    {
      "target": "customers.customer_id",
      "source": "stg_customers.customer_id",
      "transformation": "customer_id",
      "confidence": 0.95
    }
  ]
}
```

#### 3. Impact Analysis

```typescript
GET /api/metadata/connections/:id/impact
Authorization: Bearer <jwt_token>

Query Parameters:
  - object_name: string (required)
  - direction: 'upstream' | 'downstream' | 'both' (default: 'downstream')

Response:
{
  "impacted_objects": [
    {
      "name": "customers",
      "object_type": "model",
      "distance": 1,
      "path": ["stg_customers", "customers"]
    }
  ],
  "impacted_columns": [
    {
      "column": "customers.customer_id",
      "affected_by": ["stg_customers.customer_id"],
      "confidence": 0.95
    }
  ]
}
```

### Phase 2 APIs (IDE Sync)

#### 4. Sync from IDE

```typescript
POST /api/metadata/sync-from-ide
Authorization: Bearer <jwt_token>
Content-Type: application/json

Request Body:
{
  "workspace_id": "uuid",
  "objects": [ ... ],
  "columns": [ ... ],
  "dependencies": [ ... ],
  "column_lineage": [ ... ]
}

Response:
{
  "success": true,
  "synced": {
    "objects": 45,
    "columns": 312,
    "dependencies": 89,
    "column_lineage": 234
  }
}
```

#### 5. Pull from Cloud

```typescript
GET /api/metadata/workspaces/:id/lineage
Authorization: Bearer <jwt_token>

Response:
{
  "objects": [ ... ],      // Same structure as SQLite
  "columns": [ ... ],
  "dependencies": [ ... ],
  "column_lineage": [ ... ],
  "last_updated": "2025-10-20T13:49:00Z"
}
```

---

## Data Flow

### Flow 1: GitHub + Manifest Upload (Phase 1)

```
1. User connects GitHub repo
   ↓
2. Backend clones repo → /tmp/repos/{connection_id}
   ↓
3. Detect dbt_project.yml
   ↓
4. User uploads manifest.json (optional)
   ↓
5. Backend:
   a. Parse manifest → models + sources
   b. Extract model dependencies (100% accurate)
   c. Parse compiled_code → column lineage (90% accurate)
   d. Store in PostgreSQL
   ↓
6. Frontend:
   Query lineage → Display graph
```

### Flow 2: Local IDE Analysis (Phase 2)

```
1. User opens dbt project in VS Code
   ↓
2. DuckCode extension detects dbt_project.yml
   ↓
3. Extension:
   a. Read models/*.sql files
   b. Check for target/manifest.json
   c. Parse locally (with/without manifest)
   d. Store in SQLite (~/.duckcode/projects/{hash}/metadata.db)
   ↓
4. User hovers over column → Extension queries SQLite
   ↓
5. Show column lineage in tooltip
```

### Flow 3: IDE → Cloud Sync (Phase 2)

```
1. User clicks "Sync to Cloud" in extension
   ↓
2. Extension:
   a. Export SQLite → JSON
   b. POST to /api/metadata/sync-from-ide
   ↓
3. Backend:
   a. Validate data
   b. Insert into PostgreSQL (same schema!)
   c. Link to workspace_id
   ↓
4. Team members:
   GET /api/metadata/workspaces/{id}/lineage
   → See latest lineage
```

---

## Testing Strategy

### Unit Tests

**Manifest Parser:**
- Parse valid manifest.json
- Extract all models correctly
- Handle missing fields gracefully
- Extract dependencies with 100% accuracy

**Column Lineage Extractor:**
- Parse simple SELECT statements
- Handle JOIN expressions
- Extract from CASE WHEN statements
- Handle aggregations (SUM, COUNT, AVG)

**SQL Parser:**
- Filter CTEs from models
- Detect dbt refs and sources
- Parse column definitions
- Handle syntax errors

### Integration Tests

**End-to-End Extraction:**
1. Upload jaffle_shop manifest
2. Verify 45 models extracted
3. Verify 156 dependencies stored
4. Verify 400+ column lineages created
5. Query lineage API successfully

**IDE Sync:**
1. Analyze local project → SQLite
2. Sync to cloud → PostgreSQL
3. Pull from cloud → SQLite
4. Verify data consistency

### Performance Tests

**Benchmarks:**
- Parse 100-model manifest: < 5 seconds
- Extract column lineage: < 10 seconds
- Query lineage (50 nodes): < 500ms
- Sync 100 objects: < 2 seconds

---

## Success Metrics

### Phase 1 Targets (Cloud)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Model lineage accuracy | 100% | With manifest |
| Column lineage accuracy | 90%+ | With manifest compiled_code |
| Parse time (100 models) | < 10s | Backend processing |
| Query time (lineage graph) | < 500ms | API response time |
| Frontend render (100 nodes) | < 2s | D3.js visualization |

### Phase 2 Targets (IDE)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Local analysis time | < 5s | 50 models |
| Hover response time | < 100ms | SQLite query |
| Sync time | < 2s | 100 objects |
| Extension load time | < 1s | VS Code startup |

---

## Current Status

### ✅ Completed

1. Architecture design
2. Database schema (unified)
3. ManifestParser.ts created
4. Documentation

### 🚧 In Progress

1. Manifest upload endpoint
2. Database migration
3. Column lineage extraction

### 📋 TODO (Phase 1)

1. ColumnLineageExtractor.ts
2. SQLGlot integration
3. Enhanced SQL parser
4. Frontend lineage graph
5. API endpoints
6. Testing suite

---

## Notes & Decisions

### Key Architectural Decisions

1. **Unified Schema:** Same tables in SQLite and PostgreSQL for easy sync
2. **Manifest-First:** Parse manifest.json when available (GOLD tier)
3. **Confidence Scoring:** Track extraction quality (0.0 - 1.0)
4. **Tiered Accuracy:** GOLD (manifest), SILVER (SQL + dbt), BRONZE (raw SQL)
5. **Local-First IDE:** Work offline, sync optionally

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| SQLGlot parsing errors | Fallback to regex-based extraction |
| Large manifest files | Stream parsing + pagination |
| Sync conflicts | Timestamp-based resolution |
| Performance issues | Caching + indexes + EXPLAIN ANALYZE |

---

## References

- [dbt-core GitHub](https://github.com/dbt-labs/dbt-core)
- [manifest.json v12 Schema](https://schemas.getdbt.com/dbt/manifest/v12.json)
- [SQLGlot Documentation](https://sqlglot.com/)
- [VS Code Extension API](https://code.visualstudio.com/api)

---

**End of Master Architecture Document**

*This is a living document. Update as implementation progresses.*
