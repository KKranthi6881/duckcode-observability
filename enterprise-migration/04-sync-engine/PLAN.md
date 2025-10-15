# Phase 4: Metadata Sync Engine (Cloud ↔ Local)

## 🎯 Objective
Build bidirectional sync system that keeps cloud Supabase metadata in sync with local IDE SQLite databases, enabling offline access and fast local queries.

## 🏗️ Architecture

### Sync Flow
```
Cloud (Supabase PostgreSQL) ←→ Sync Protocol ←→ Local (SQLite in IDE)
         ↓                                              ↓
   Central metadata                            Fast local queries
   Team collaboration                          Offline access
```

## 📊 Sync Strategies

### 1. Initial Sync (Full Download)
**Trigger**: User first signs into organization in IDE

**Process**:
```typescript
1. IDE requests initial sync from cloud
2. Backend queries all metadata for user's organization
3. Stream data to IDE in chunks (paginated)
4. IDE writes to local SQLite database
5. Store sync checkpoint (last_sync_timestamp, last_object_id)
```

**Optimization**:
- Compress data before transfer (gzip)
- Batch insert into SQLite (transactions)
- Progress indicator in IDE

### 2. Incremental Sync (Delta Updates)
**Trigger**: 
- Periodic background sync (every 15 minutes)
- Manual sync button in IDE
- Real-time via WebSocket for critical updates

**Process**:
```typescript
1. IDE sends last_sync_timestamp to backend
2. Backend queries metadata changed after timestamp
3. Send only delta (new/updated/deleted objects)
4. IDE applies changes to local SQLite
5. Update sync checkpoint
```

**Delta Detection**:
```sql
-- In Supabase, track changes
SELECT * FROM metadata.objects 
WHERE organization_id = $1 
  AND updated_at > $2
ORDER BY updated_at ASC
LIMIT 1000;
```

### 3. Conflict Resolution
**Scenario**: Local changes vs cloud changes

**Strategy**: Cloud wins (source of truth)
- Cloud metadata is authoritative
- IDE is read-only consumer
- Local modifications not supported (for now)
- Future: Allow local annotations that sync up

### 4. Real-time Updates (Optional)
**Technology**: Supabase Realtime (WebSocket)

**Use Cases**:
- New connector added → Notify all team IDEs
- Metadata extraction completed → Trigger sync
- Team member added → Update team list

## 🔄 Sync Protocol

### API Endpoints

#### 1. Initial Sync
```
GET /api/sync/initial
Headers: Authorization: Bearer <token>
Query: ?organization_id=<uuid>

Response:
{
  "repositories": [...],
  "files": [...],
  "objects": [...],
  "columns": [...],
  "dependencies": [...],
  "lineage": [...],
  "total_records": 15000,
  "sync_checkpoint": {
    "timestamp": "2025-01-15T12:00:00Z",
    "last_object_id": "uuid"
  }
}
```

#### 2. Incremental Sync
```
GET /api/sync/incremental
Headers: Authorization: Bearer <token>
Query: 
  ?organization_id=<uuid>
  &last_sync_timestamp=<iso-datetime>
  &last_object_id=<uuid>

Response:
{
  "changes": {
    "new": { objects: [...], columns: [...] },
    "updated": { objects: [...], columns: [...] },
    "deleted": { object_ids: [...], column_ids: [...] }
  },
  "sync_checkpoint": {
    "timestamp": "2025-01-15T12:15:00Z",
    "last_object_id": "uuid"
  }
}
```

#### 3. Sync Status
```
GET /api/sync/status
Headers: Authorization: Bearer <token>
Query: ?organization_id=<uuid>

Response:
{
  "last_extraction_at": "2025-01-15T11:00:00Z",
  "total_objects": 5000,
  "total_files": 250,
  "pending_jobs": 2,
  "sync_recommended": true
}
```

## 💾 Local Storage (IDE)

### SQLite Enhancements
**Add sync tracking table**:
```sql
CREATE TABLE sync_metadata (
  id INTEGER PRIMARY KEY,
  organization_id TEXT NOT NULL,
  last_sync_timestamp TEXT,
  last_object_id TEXT,
  sync_status TEXT, -- 'synced', 'syncing', 'error'
  total_objects INTEGER,
  last_error TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Sync Service in IDE
**Location**: `duck-code/src/services/sync/MetadataSyncService.ts`

```typescript
class MetadataSyncService {
  private syncInterval: NodeJS.Timeout | null = null;

  async performInitialSync(organizationId: string): Promise<void>
  async performIncrementalSync(organizationId: string): Promise<void>
  async startBackgroundSync(interval: number = 15 * 60 * 1000): void
  async stopBackgroundSync(): void
  async getSyncStatus(): Promise<SyncStatus>
  async forceSyncNow(): Promise<void>
  
  private async applyDelta(delta: SyncDelta): Promise<void>
  private async updateSyncCheckpoint(checkpoint: SyncCheckpoint): Promise<void>
}
```

### Progress Tracking
```typescript
interface SyncProgress {
  phase: 'repositories' | 'files' | 'objects' | 'columns' | 'dependencies';
  current: number;
  total: number;
  percentage: number;
}

// Show in IDE status bar
vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: "Syncing metadata...",
  cancellable: false
}, async (progress) => {
  // Update progress as sync proceeds
});
```

## 🔐 Security

### Authentication
- Use JWT tokens from OAuth flow
- Tokens include organization_id claim
- Backend validates user has access to organization

### Data Filtering
- Backend only returns metadata for user's organization
- RLS policies enforce isolation
- Never expose other organizations' data

### Encryption
- HTTPS for all API calls
- Optional: Encrypt SQLite database at rest

## 📊 Performance Optimization

### Pagination
```typescript
// For large datasets, paginate results
async function* streamMetadata(
  organizationId: string,
  pageSize: number = 1000
): AsyncGenerator<MetadataChunk> {
  let page = 0;
  while (true) {
    const chunk = await fetchMetadataPage(organizationId, page, pageSize);
    if (chunk.length === 0) break;
    yield chunk;
    page++;
  }
}
```

### Compression
```typescript
// Compress response before sending
import { gzip, ungzip } from 'node:zlib';

// Backend
const compressed = await gzip(JSON.stringify(data));
response.setHeader('Content-Encoding', 'gzip');
response.send(compressed);

// IDE
const decompressed = await ungzip(response.data);
const data = JSON.parse(decompressed.toString());
```

### Caching
- Cache sync responses for short duration
- Invalidate cache when metadata changes
- Use ETags for conditional requests

## 🧪 Testing Strategy

### Unit Tests
- [ ] Test initial sync downloads all data
- [ ] Test incremental sync applies deltas correctly
- [ ] Test conflict resolution (cloud wins)
- [ ] Test checkpoint storage and retrieval

### Integration Tests
- [ ] Test full sync workflow (cloud → local)
- [ ] Test sync with large datasets (10k+ objects)
- [ ] Test network interruption handling
- [ ] Test concurrent syncs from multiple IDEs

### Performance Tests
- [ ] Benchmark sync speed (1000 objects/sec target)
- [ ] Test with 100k objects
- [ ] Measure SQLite write performance
- [ ] Test memory usage during sync

## ✅ Acceptance Criteria

- [ ] Initial sync completes for new user
- [ ] Incremental sync updates local database
- [ ] Background sync runs every 15 minutes
- [ ] Manual sync button works in IDE
- [ ] Sync progress shown to user
- [ ] Network errors handled gracefully (retry)
- [ ] Sync status visible in IDE settings
- [ ] Multi-organization support (switch orgs)
- [ ] Offline mode works (use cached data)

## 🚀 Future Enhancements

### Bidirectional Sync
- Allow local annotations/tags
- Sync user comments upward
- Merge strategy for conflicts

### Smart Sync
- Only sync metadata relevant to user's role
- Filter by team/project
- Selective sync (choose repositories)

### Real-time Collaboration
- Show who's viewing same object
- Live cursor positions in lineage diagrams
- Collaborative editing of descriptions
