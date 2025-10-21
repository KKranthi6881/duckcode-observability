# Where Does the Manifest.json Go? 📊

## Quick Answer

**The manifest.json is:**
1. ✅ Generated in `/tmp/repo-*/target/manifest.json`
2. ✅ Parsed immediately by `ManifestParser` (same parser as old system!)
3. ✅ Stored in PostgreSQL database
4. ✅ Then **deleted** (cleaned up automatically)

**We use the SAME metadata extraction process - just with Docker generating the manifest!**

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  1. User clicks "Extract" button                           │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  2. DbtRunner: Clone GitHub repo                           │
│     → Location: /tmp/repo-dbt-analytics-1729450123         │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  3. DbtRunner: Run Docker container                        │
│     docker run --rm \                                       │
│       -v /tmp/repo-*/:/project \                           │
│       dbt-runner:latest \                                   │
│       sh -c "dbt deps && dbt parse"                        │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Docker: Generate manifest.json                         │
│     → Location: /tmp/repo-*/target/manifest.json           │
│     → Contains: models, sources, dependencies              │
│     → Format: dbt manifest v4-v12                          │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  5. DbtRunner: Read manifest.json from disk                │
│     const manifest = JSON.parse(                           │
│       await fs.readFile(manifestPath)                      │
│     );                                                      │
│     → Returns manifest object to orchestrator              │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  6. ExtractionOrchestrator: Parse with ManifestParser     │
│     const parsed = await this.manifestParser.parseManifest(│
│       JSON.stringify(manifest)                             │
│     );                                                      │
│     → Extracts: models, sources, dependencies, lineage     │
│     → SAME PARSER AS OLD SYSTEM! ✅                        │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  7. Store in PostgreSQL                                    │
│     await storeManifestData(connectionId, parsed)          │
│                                                            │
│     Tables populated:                                      │
│     ├── github_connections (manifest_uploaded = true)     │
│     ├── repositories                                       │
│     ├── files                                              │
│     ├── metadata.objects (models, sources)                │
│     ├── metadata.dependencies (lineage)                   │
│     └── metadata.columns_lineage (column-level)           │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  8. DbtRunner: Cleanup                                     │
│     await fs.rm(projectPath, { recursive: true })         │
│     → Deletes /tmp/repo-*/ (including manifest.json)      │
│     → Frees disk space                                     │
└─────────────────────────┬───────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  9. Done!                                                  │
│     ✅ Manifest data in PostgreSQL                        │
│     ✅ Temp files deleted                                  │
│     ✅ Lineage ready to query                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Are We Using Old or New Process?

### **BOTH! (But in a smart way)**

**New Part (Docker):**
- ✅ Cloning GitHub repo
- ✅ Running `dbt parse` in Docker
- ✅ Generating manifest.json automatically

**Old Part (Same as Before):**
- ✅ `ManifestParser` (same parser!)
- ✅ Database storage logic
- ✅ Lineage extraction
- ✅ Column-level lineage

**Why This Is Perfect:**
- Docker gives us the manifest automatically
- ManifestParser is already proven and working
- No need to rewrite parsing logic
- Best of both worlds!

---

## Code Evidence

### 1. ExtractionOrchestrator Uses ManifestParser

```typescript
// ExtractionOrchestrator.ts line 2
import { ManifestParser } from '../parsers/ManifestParser';

// Line 98-101
const parsed = await this.manifestParser.parseManifest(
  JSON.stringify(dbtResult.manifest)
);
```

**This is the SAME parser used in the old manual upload system!**

### 2. Manifest File Location (Temporary)

```typescript
// DbtRunner.ts
const manifestPath = path.join(projectPath, 'target', 'manifest.json');
// Example: /tmp/repo-dbt-analytics-1729450123/target/manifest.json
```

### 3. Cleanup After Processing

```typescript
// DbtRunner.ts line 222-227
finally {
  // Always cleanup
  if (projectPath) {
    await this.cleanup(projectPath);
  }
}

// cleanup() deletes the entire /tmp/repo-* directory
```

### 4. Data Stored in Same Tables

```typescript
// ExtractionOrchestrator.ts line 265-350
private async storeManifestData(...) {
  // Stores in:
  await supabase.from('repositories').insert(...)
  await supabase.from('files').insert(...)
  await supabase.from('objects').insert(...)  // metadata.objects
  await supabase.from('dependencies').insert(...)
  await supabase.from('columns_lineage').insert(...)
}
```

**These are the SAME tables as the old system!**

---

## Where to Find the Data

### Temporary Files (During Extraction)
```bash
# While extraction is running:
ls /tmp/dbt-extractions/

# You'll see:
repo-dbt-analytics-1729450123/
├── dbt_project.yml
├── profiles.yml (generated)
├── models/
│   ├── model1.sql
│   └── model2.sql
└── target/
    └── manifest.json  ← HERE! (temporarily)
```

### Permanent Storage (After Extraction)
```sql
-- Connection info
SELECT * FROM github_connections 
WHERE id = 'your-connection-id';

-- Extracted models
SELECT * FROM metadata.objects 
WHERE connection_id = 'your-connection-id';

-- Lineage
SELECT * FROM metadata.dependencies 
WHERE connection_id = 'your-connection-id';

-- Column lineage
SELECT * FROM metadata.columns_lineage 
WHERE source_object_id IN (
  SELECT id FROM metadata.objects 
  WHERE connection_id = 'your-connection-id'
);
```

---

## What's Different from Old System?

### Old Manual System
```
1. User downloads manifest.json from dbt project
2. User uploads via UI
3. Backend receives file
4. ManifestParser parses it
5. Store in PostgreSQL
```

### New Docker System
```
1. User clicks "Extract"
2. Backend clones repo
3. Docker runs dbt parse → generates manifest.json
4. ManifestParser parses it (SAME AS OLD!)
5. Store in PostgreSQL (SAME AS OLD!)
6. Delete temp files
```

**Only difference:** Steps 1-3 are automated!

---

## Summary

### Where Manifest Goes:
1. **During extraction:** `/tmp/repo-*/target/manifest.json` (temporary)
2. **After extraction:** PostgreSQL database (permanent)
3. **Temp files:** Deleted automatically

### Old vs New:
- **New:** Docker generates manifest (automated)
- **Same:** ManifestParser parses it
- **Same:** Database storage logic
- **Same:** Lineage extraction
- **Same:** Query endpoints

### Why This Works:
✅ Docker automates manifest generation  
✅ Reuse proven ManifestParser  
✅ No duplicate parsing logic  
✅ Same database schema  
✅ Same query APIs  

**Best of both worlds!** 🚀
