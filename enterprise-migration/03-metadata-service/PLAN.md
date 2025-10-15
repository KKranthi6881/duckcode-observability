# Phase 3: Central Metadata Extraction Service

## 🎯 Objective
Build cloud-based metadata extraction service that replicates duck-code's local SQLite metadata extraction logic, storing results in Supabase for enterprise teams.

## 🏗️ Architecture

### High-Level Flow
```
GitHub Connector → Pull Repository Files → Metadata Extraction Service → Supabase Tables
                                                        ↓
                                              SQLglot Parser + AI Verification
                                                        ↓
                                        Store: Objects, Columns, Dependencies, Lineage
```

## 📊 Components

### 1. Metadata Extraction Worker
**Location**: `duckcode-observability/backend/src/services/metadata/`

**Responsibilities**:
- Process files from connected repositories
- Extract metadata using SQLglot (same logic as duck-code)
- Store extracted metadata in Supabase
- Handle incremental updates (only changed files)
- Queue-based processing for scalability

**Key Classes** (replicate from duck-code):
- `MetadataExtractionService.ts` - Main orchestrator
- `SQLGLOTParser.ts` - SQL parsing with SQLglot
- `PythonParser.ts` - Python/PySpark parsing
- `DependencyAnalyzer.ts` - Dependency resolution
- `LineageTracker.ts` - Column-level lineage
- `ColumnLineageParser.ts` - Advanced lineage parsing

### 2. Database Schema (Supabase)
**Schema**: `metadata` (new schema)

Replicate tables from duck-code SQLite schema:
```sql
-- metadata.repositories
-- metadata.files
-- metadata.objects
-- metadata.columns
-- metadata.dependencies
-- metadata.columns_lineage
-- metadata.lineage_paths
-- metadata.constraints
-- metadata.imports
```

**Add Enterprise Fields**:
- `organization_id` on all tables
- `team_id` for team-level access control
- `connector_id` to track data source
- `extraction_job_id` for audit trail

### 3. Extraction Job Queue
**Technology**: BullMQ or Supabase Edge Functions

**Job Types**:
1. `FULL_EXTRACTION` - Initial full repository scan
2. `INCREMENTAL_EXTRACTION` - Only changed files
3. `REVALIDATION` - Re-extract specific objects
4. `AI_VERIFICATION` - Verify metadata with AI

**Job Processing**:
```typescript
interface MetadataExtractionJob {
  id: string;
  organization_id: string;
  connector_id: string;
  repository_url: string;
  branch: string;
  job_type: 'FULL' | 'INCREMENTAL' | 'REVALIDATION';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  files_processed: number;
  files_total: number;
  started_at?: Date;
  completed_at?: Date;
  error?: string;
}
```

### 4. File Change Detection
**Strategy**: Git-based change detection

```typescript
// Compare current commit SHA with last processed SHA
// Only extract metadata from changed files
async detectChangedFiles(
  repoPath: string,
  lastCommitSHA: string,
  currentCommitSHA: string
): Promise<string[]>
```

### 5. SQLglot Integration (Server-Side)
**Challenge**: SQLglot is Python, backend is Node.js

**Solution Options**:
1. **Python Child Process** (Recommended)
   - Spawn Python process from Node.js
   - Use existing SQLglot logic
   - Communicate via JSON

2. **Python Microservice**
   - Separate Python service for parsing
   - REST API or gRPC
   - Scales independently

3. **Edge Functions**
   - Supabase Edge Functions with Deno
   - Call Python via subprocess
   - Serverless scaling

**Recommended**: Python microservice for clean separation

### 6. Metadata Storage Service
**Location**: `duckcode-observability/backend/src/services/metadata/storage.service.ts`

**Methods**:
```typescript
class MetadataStorageService {
  async storeRepository(orgId: string, repoData: Repository): Promise<string>
  async storeFile(fileData: ParsedFile): Promise<string>
  async storeObject(objectData: ParsedObject): Promise<string>
  async storeColumn(columnData: ParsedColumn): Promise<void>
  async storeDependency(depData: ParsedDependency): Promise<void>
  async storeLineage(lineageData: ColumnLineage): Promise<void>
  async getRepository(repoId: string): Promise<Repository>
  async getObjects(repoId: string, filters?: ObjectFilters): Promise<ParsedObject[]>
  async getDependencies(objectId: string): Promise<ParsedDependency[]>
  async getLineage(columnId: string): Promise<ColumnLineage[]>
}
```

## 🔄 Extraction Workflow

### Step 1: Trigger Extraction
```
Admin adds GitHub connector → Webhook triggered → Queue extraction job
OR
Scheduled cron job → Check for new commits → Queue incremental job
```

### Step 2: File Discovery
```typescript
// For GitHub connector
const files = await githubService.listAllRepoFiles(owner, repo);
const filteredFiles = files.filter(f => 
  f.path.endsWith('.sql') || 
  f.path.endsWith('.py') ||
  f.path.endsWith('.yaml')
);
```

### Step 3: File Processing
```typescript
for (const file of filteredFiles) {
  const content = await githubService.getFileContent(owner, repo, file.path);
  const metadata = await metadataExtractor.extractFromFile(content, file.path);
  await metadataStorage.storeFileMetadata(orgId, repoId, metadata);
}
```

### Step 4: Dependency Resolution
```typescript
// After all files processed, resolve dependencies
await dependencyAnalyzer.resolvePendingDependencies(repoId);
```

### Step 5: Lineage Calculation
```typescript
// Build lineage paths (upstream/downstream)
await lineageTracker.calculateLineagePaths(repoId);
```

### Step 6: AI Verification (Optional)
```typescript
// Use AI to verify and enrich metadata
await aiVerificationService.verifyMetadata(objectId, {
  checkDefinition: true,
  suggestDescriptions: true,
  detectAnomalies: true
});
```

## 🔐 Security Considerations

### Multi-Tenancy
- All queries filtered by `organization_id`
- RLS policies enforce data isolation
- Service role bypasses RLS for admin operations

### API Key Security
- Encrypt GitHub tokens and LLM keys
- Store in Supabase Vault or environment variables
- Never expose in logs or responses

### Rate Limiting
- Limit extraction jobs per organization
- Throttle GitHub API calls
- Queue jobs to prevent overload

## 📊 Monitoring & Observability

### Metrics to Track
- Extraction job duration
- Files processed per minute
- Parse errors per file type
- SQLglot parser success rate
- Storage write latency
- Queue depth

### Logging
- Structured JSON logs
- Log levels: DEBUG, INFO, WARN, ERROR
- Include: org_id, job_id, file_path, error_stack
- Send to logging service (e.g., Datadog, CloudWatch)

## ✅ Acceptance Criteria

- [ ] Metadata extraction service deployed
- [ ] SQLglot parser integrated (Python subprocess or microservice)
- [ ] All metadata tables created in Supabase
- [ ] GitHub connector triggers extraction jobs
- [ ] Incremental extraction working (only changed files)
- [ ] Dependency resolution accurate
- [ ] Column lineage calculated correctly
- [ ] Multi-tenant data isolation enforced
- [ ] Extraction jobs visible in admin portal
- [ ] Error handling and retry logic implemented

## 🚀 Migration from Local to Cloud

### Replicate Logic from duck-code
Files to replicate:
- `duck-code/src/core/metadata/MetadataExtractionService.ts`
- `duck-code/src/core/metadata/parsers/SQLGLOTParser.ts`
- `duck-code/src/core/metadata/parsers/PythonParser.ts`
- `duck-code/src/core/metadata/parsers/ColumnLineageParser.ts`
- `duck-code/src/core/metadata/analyzers/DependencyAnalyzer.ts`
- `duck-code/src/core/metadata/analyzers/LineageTracker.ts`

### Adapt for Cloud Environment
1. Replace SQLite with Supabase PostgreSQL
2. Add organization_id filtering
3. Use queue instead of synchronous processing
4. Add horizontal scaling support
5. Implement proper error handling and retries
