# File Index Design - Tantivy Cloud Search

## Overview
Add file-based indexing to complement metadata indexing for complete code + data search.

---

## Schema Design

### **Tantivy File Index Fields:**

```rust
// File metadata
file_id: String (UUID, stored + indexed)
organization_id: String (UUID, indexed - for isolation)
repository_id: String (UUID, indexed)
repository_name: String (indexed + stored)
file_path: String (indexed + stored) // "models/customer.sql"
file_name: String (indexed + stored) // "customer.sql"
file_type: String (indexed + stored) // "sql", "py", "js", "ts"
relative_path: String (stored)

// Content fields
content: String (indexed + stored) // Full file content for search
functions: String (indexed) // Space-separated function names
classes: String (indexed) // Space-separated class names
imports: String (indexed) // Space-separated import statements
symbols: String (indexed) // Variable names, constants
comments: String (indexed) // Extracted comments and docstrings
documentation: String (indexed) // README sections, doc blocks

// Metadata
language: String (indexed) // "sql", "python", "javascript", "typescript"
size_bytes: u64 (stored)
line_count: u32 (stored)
last_modified: DateTime (indexed + stored)
created_at: DateTime (stored)

// Scoring boosts
is_main_file: bool (stored) // main.py, index.ts, etc.
is_config: bool (stored) // config files
is_test: bool (stored) // test files
```

---

## File Types to Index

### **Priority 1 (Data/Analytics):**
- `.sql` - SQL queries, DDL, DML
- `.py` - Python scripts, dbt models
- `.yml` / `.yaml` - dbt configs, CI/CD
- `.md` - Documentation

### **Priority 2 (Application Code):**
- `.js` / `.ts` - JavaScript/TypeScript
- `.jsx` / `.tsx` - React components
- `.json` - Config files

### **Priority 3 (Other):**
- `.go` - Go code
- `.java` - Java code
- `.rb` - Ruby code
- `.sh` - Shell scripts

---

## Extraction Strategy

### **For SQL Files:**
```sql
-- Extract:
1. Table references (FROM, JOIN)
2. Column references (SELECT)
3. CTEs (WITH clauses)
4. Functions called
5. Comments (-- and /* */)
```

### **For Python Files:**
```python
# Extract:
1. Function definitions (def function_name)
2. Class definitions (class ClassName)
3. Imports (import, from...import)
4. Docstrings ("""...""")
5. Comments (#)
6. Variables (assignments)
```

### **For JavaScript/TypeScript:**
```javascript
// Extract:
1. Function definitions (function, arrow functions)
2. Class definitions (class)
3. Imports (import, require)
4. Exports (export, module.exports)
5. JSDoc comments (/** ... */)
6. Type definitions (TypeScript)
```

---

## Storage Architecture

```
Supabase Storage: tantivy-indexes/
├── {org-id}/
│   ├── metadata/          ← Existing metadata index
│   │   ├── .managed.json
│   │   ├── meta.json
│   │   └── [segment files]
│   │
│   └── files/             ← NEW file index
│       ├── .managed.json
│       ├── meta.json
│       └── [segment files]
```

---

## Database Schema

### **New Table: `metadata.file_indexes`**

```sql
CREATE TABLE metadata.file_indexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL,
    repository_name TEXT NOT NULL,
    
    -- Index metadata
    version INTEGER NOT NULL DEFAULT 1,
    document_count INTEGER NOT NULL DEFAULT 0,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    index_path TEXT NOT NULL, -- "tantivy-indexes/{org-id}/files"
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active', -- active, rebuilding, error
    last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT unique_org_repo_file_index UNIQUE(organization_id, repository_id)
);

CREATE INDEX idx_file_indexes_org ON metadata.file_indexes(organization_id);
CREATE INDEX idx_file_indexes_repo ON metadata.file_indexes(repository_id);
CREATE INDEX idx_file_indexes_status ON metadata.file_indexes(status);
```

---

## API Endpoints

### **New Endpoints:**

```
POST /api/v2/search/files/index
- Trigger file indexing for a repository
- Input: { organization_id, repository_id }
- Output: { success, files_indexed, time_ms }

GET /api/v2/search/files/query
- Search code files
- Params: q, file_type, repository_name, limit
- Output: { results: [{ file_path, content_snippet, score }], total }

GET /api/v2/search/files/autocomplete
- Autocomplete file names
- Params: prefix, limit
- Output: { suggestions: ["customer.sql", ...] }

GET /api/v2/search/hybrid
- Search BOTH metadata and files
- Params: q, limit
- Output: { metadata: [...], files: [...], combined: [...] }
```

---

## Search Flow

### **User searches: "customer email"**

```
1. Query both indexes in parallel:
   ┌─────────────────────────────────┐
   │ Metadata Index                  │
   │ - customers table               │
   │ - customer_email column         │
   │ - email_contacts view           │
   └─────────────────────────────────┘
   
   ┌─────────────────────────────────┐
   │ File Index                      │
   │ - models/customer.sql           │
   │ - transforms/email_clean.py     │
   │ - queries/customer_report.sql   │
   └─────────────────────────────────┘

2. Merge results by relevance
3. Show unified results to user
```

---

## Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| File indexing | < 30s per 100 files | Background process |
| File search | < 20ms | Same as metadata |
| Hybrid search | < 30ms | Parallel queries |
| Index size | ~1MB per 100 files | Compressed |

---

## Implementation Phases

### **Phase 1: Core Infrastructure** (Tonight)
- ✅ Design schema
- 🔨 Add file index support to Tantivy service
- 🔨 Create file_indexes database table
- 🔨 Add storage paths for file indexes

### **Phase 2: File Parser** (Next)
- 🔨 Build SQL parser (extract tables, columns, functions)
- 🔨 Build Python parser (extract functions, classes, imports)
- 🔨 Build JS/TS parser (extract functions, classes, imports)
- 🔨 Extract comments and docstrings

### **Phase 3: Integration** (Next)
- 🔨 Integrate with metadata extraction flow
- 🔨 Trigger file indexing after repo connection
- 🔨 Update TantivySearchService for dual indexes

### **Phase 4: Hybrid Search** (Next)
- 🔨 Create hybrid search endpoint
- 🔨 Merge and rank results
- 🔨 Update frontend UI

### **Phase 5: Testing** (Final)
- 🔨 Test with real repositories
- 🔨 Verify search quality
- 🔨 Performance benchmarks

---

## Benefits

✅ **Complete Context** - See both code AND metadata  
✅ **Better Lineage** - Connect transformations to data  
✅ **Documentation Search** - Find README/comment info  
✅ **Architecture Viz** - Show complete system diagram  
✅ **Code Discovery** - Find where logic is implemented  

---

**Status:** 🚧 In Progress  
**ETA:** Phase 1-3 Tonight, Phase 4-5 Tomorrow
