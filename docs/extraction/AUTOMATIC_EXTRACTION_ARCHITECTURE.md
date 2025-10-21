# Automatic Metadata Extraction Architecture

**Date:** October 20, 2025  
**Status:** 🎯 Recommended Approach

---

## Problem Statement

**Manual manifest upload doesn't work because:**
1. ❌ Developers change dbt models 10-50 times per day
2. ❌ Manual upload = friction + forgotten uploads
3. ❌ Data becomes stale within minutes
4. ❌ Not scalable for teams
5. ❌ Poor developer experience

---

## Proposed Solution: Automatic Extraction

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER CONNECTS GITHUB REPO                    │
│                                                                 │
│  1. User provides: repo URL, branch, access token              │
│  2. Backend validates and stores connection                     │
│  3. Triggers initial extraction                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND AUTO-EXTRACTION                      │
│                                                                 │
│  ┌─────────────┐         ┌──────────────┐                     │
│  │   Clone     │ ------> │  Install dbt │                     │
│  │   Repo      │         │  Dependencies│                     │
│  └─────────────┘         └──────────────┘                     │
│         │                        │                             │
│         ↓                        ↓                             │
│  ┌─────────────┐         ┌──────────────┐                     │
│  │  Run dbt    │ ------> │  Extract     │                     │
│  │  parse      │         │  manifest    │                     │
│  └─────────────┘         └──────────────┘                     │
│                                  │                             │
│                                  ↓                             │
│                          ┌──────────────┐                     │
│                          │  Parse &     │                     │
│                          │  Store in DB │                     │
│                          └──────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    KEEP DATA FRESH (3 Options)                  │
│                                                                 │
│  Option A: GitHub Webhooks (Recommended)                       │
│  ├─ GitHub sends webhook on push to main branch               │
│  ├─ Backend receives webhook → triggers extraction            │
│  └─ Data always up-to-date (30 seconds delay)                 │
│                                                                 │
│  Option B: Scheduled Polling                                   │
│  ├─ Cron job checks for new commits every 5-15 minutes        │
│  ├─ Compares latest commit SHA                                │
│  └─ If changed → triggers extraction                          │
│                                                                 │
│  Option C: Manual Trigger                                      │
│  ├─ User clicks "Refresh" button in UI                        │
│  ├─ Immediately triggers extraction                           │
│  └─ For urgent updates                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Auto-Extraction (Week 2)

#### 1. Backend Service: DbtRunner
**File:** `backend/src/services/metadata/DbtRunner.ts`

**Responsibilities:**
- Clone GitHub repository
- Detect dbt version from `dbt_project.yml`
- Install dbt + dependencies
- Run `dbt parse` or `dbt compile`
- Extract `target/manifest.json`
- Clean up temp files

**API:**
```typescript
class DbtRunner {
  async cloneRepo(repoUrl: string, branch: string, token: string): Promise<string>
  async detectDbtVersion(projectPath: string): Promise<string>
  async installDbt(version: string): Promise<void>
  async runDbtParse(projectPath: string): Promise<string>
  async extractManifest(projectPath: string): Promise<any>
  async cleanup(projectPath: string): Promise<void>
}
```

#### 2. Backend Service: ExtractionOrchestrator
**File:** `backend/src/services/metadata/ExtractionOrchestrator.ts`

**Responsibilities:**
- Orchestrate full extraction workflow
- Handle errors and retries
- Update connection status
- Log progress
- Trigger ManifestParser

**Workflow:**
```typescript
async function extractMetadata(connectionId: string) {
  try {
    // 1. Update status to "extracting"
    await updateConnectionStatus(connectionId, 'extracting');
    
    // 2. Get connection details
    const connection = await getConnection(connectionId);
    
    // 3. Clone repo
    const repoPath = await dbtRunner.cloneRepo(
      connection.repository_url,
      connection.branch,
      connection.access_token
    );
    
    // 4. Run dbt parse
    const manifestPath = await dbtRunner.runDbtParse(repoPath);
    
    // 5. Parse manifest
    const manifest = await fs.readFile(manifestPath, 'utf-8');
    const parsed = await manifestParser.parseManifest(manifest);
    
    // 6. Store in database
    await storeManifestData(connectionId, parsed);
    
    // 7. Update status to "completed"
    await updateConnectionStatus(connectionId, 'completed');
    
    // 8. Cleanup
    await dbtRunner.cleanup(repoPath);
    
  } catch (error) {
    await updateConnectionStatus(connectionId, 'failed', error.message);
    throw error;
  }
}
```

#### 3. Docker Container for dbt Execution
**File:** `backend/Dockerfile.dbt`

**Why Docker?**
- Isolated Python environment
- Easy dbt installation
- Consistent across environments
- No conflicts with Node.js backend

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

# Install dbt-core and adapters
RUN pip install dbt-core dbt-snowflake dbt-bigquery dbt-postgres dbt-redshift

# Install git for cloning
RUN apt-get update && apt-get install -y git

WORKDIR /app

CMD ["dbt", "parse"]
```

**Usage:**
```bash
docker run -v /path/to/repo:/app dbt-runner dbt parse
```

---

### Phase 2: GitHub Webhooks (Week 3)

#### 1. Webhook Endpoint
**File:** `backend/src/api/controllers/webhook.controller.ts`

**Endpoint:**
```typescript
POST /api/webhooks/github

Headers:
  X-GitHub-Event: push
  X-Hub-Signature-256: <signature>

Body:
  {
    "ref": "refs/heads/main",
    "repository": {
      "clone_url": "https://github.com/..."
    },
    "commits": [...]
  }
```

**Handler:**
```typescript
async function handleGitHubWebhook(req: Request, res: Response) {
  // 1. Verify webhook signature
  if (!verifyGitHubSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // 2. Check if push to main branch
  if (req.body.ref !== 'refs/heads/main') {
    return res.status(200).json({ message: 'Ignored: not main branch' });
  }
  
  // 3. Find connection by repo URL
  const connection = await findConnectionByRepo(req.body.repository.clone_url);
  
  // 4. Trigger extraction (async)
  extractionQueue.add({ connectionId: connection.id });
  
  return res.status(200).json({ message: 'Extraction queued' });
}
```

#### 2. Setup GitHub Webhook
**UI Flow:**
1. User connects repository
2. Backend creates webhook via GitHub API:
   ```
   POST https://api.github.com/repos/:owner/:repo/hooks
   {
     "config": {
       "url": "https://your-backend.com/api/webhooks/github",
       "content_type": "json",
       "secret": "<secret>"
     },
     "events": ["push"]
   }
   ```
3. GitHub sends webhook on every push
4. Backend automatically extracts metadata

---

### Phase 3: Scheduled Polling (Backup)

#### 1. Cron Job Service
**File:** `backend/src/services/metadata/PollingService.ts`

**Schedule:**
- Every 15 minutes (configurable)
- Check all active connections
- Compare latest commit SHA
- Trigger extraction if changed

**Implementation:**
```typescript
import cron from 'node-cron';

class PollingService {
  start() {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      const connections = await getActiveConnections();
      
      for (const connection of connections) {
        const latestCommit = await getLatestCommit(connection);
        
        if (latestCommit !== connection.last_commit_sha) {
          console.log(`Change detected for ${connection.id}`);
          await extractionQueue.add({ connectionId: connection.id });
        }
      }
    });
  }
}
```

---

## UI Changes

### 1. Connection Setup Flow

**Before (Manual Upload):**
```
Connect Repo → Wait → Upload manifest → See lineage
```

**After (Automatic):**
```
Connect Repo → Auto-extraction starts → See progress → See lineage
```

### 2. Real-time Progress Display

**Component:** `ExtractionProgress.tsx`

```typescript
// Shows live progress
┌─────────────────────────────────────────┐
│  🔄 Extracting metadata...             │
│                                         │
│  ✓ Cloned repository                   │
│  ✓ Installed dbt dependencies          │
│  ⟳ Running dbt parse...               │
│  ⏳ Parsing manifest...                │
│  ⏳ Storing in database...             │
│                                         │
│  [Progress Bar: 60%]                   │
└─────────────────────────────────────────┘
```

### 3. Auto-Refresh Indicator

```typescript
// Shows last extraction time
┌─────────────────────────────────────────┐
│  Last updated: 2 minutes ago           │
│  Auto-refresh: ON                      │
│  Next check: 13 minutes                │
│                                         │
│  [Refresh Now] [Settings]              │
└─────────────────────────────────────────┘
```

---

## Data Freshness Comparison

### Manual Upload
- ❌ Updated: When user remembers
- ❌ Typical delay: Hours to days
- ❌ Developer friction: High
- ❌ Data quality: Poor (often stale)

### Webhook (Recommended)
- ✅ Updated: 30 seconds after push
- ✅ Typical delay: < 1 minute
- ✅ Developer friction: None
- ✅ Data quality: Excellent (near real-time)

### Polling
- ⚠️ Updated: Every 15 minutes
- ⚠️ Typical delay: 0-15 minutes
- ✅ Developer friction: None
- ✅ Data quality: Good

---

## Technical Considerations

### 1. dbt Version Compatibility
**Challenge:** Different projects use different dbt versions

**Solution:**
- Parse `dbt_project.yml` to detect version
- Use Docker with specific dbt version
- Support dbt 1.0+

```python
# dbt_project.yml
require-dbt-version: ">=1.7.0"
```

### 2. dbt Dependencies/Packages
**Challenge:** Projects have dbt packages

**Solution:**
```bash
# Run before dbt parse
dbt deps  # Installs packages from packages.yml
dbt parse # Generates manifest
```

### 3. Database Credentials
**Challenge:** dbt needs database connection

**Solution for manifest extraction:**
```bash
# Use --no-compile for faster parsing
dbt parse --no-compile  # Doesn't need DB credentials

# If needed, use dummy profiles.yml
profiles:
  default:
    target: dev
    outputs:
      dev:
        type: duckdb
        path: /tmp/dummy.duckdb
```

### 4. Large Repositories
**Challenge:** Some repos are huge (GB of data)

**Solution:**
- Shallow clone: `git clone --depth 1`
- Only clone specific branch
- Clean up immediately after extraction

### 5. Rate Limits
**Challenge:** GitHub API rate limits

**Solution:**
- Use GitHub App authentication (5000 req/hr vs 60)
- Cache clone between extractions
- Batch multiple connections

---

## Cost Comparison

### Manual Upload
- **Storage:** None (user's device)
- **Compute:** None
- **Time:** 2-5 minutes per upload
- **Cost:** $0/month

### Automatic Extraction
- **Storage:** Temp clone (~100 MB per repo)
- **Compute:** 1-2 minutes per extraction
- **Time:** Automated (0 user time)
- **Cost:** ~$5-10/month for small scale

---

## Migration Path

### Week 1 (Current)
- ✅ Manual upload UI working
- ✅ Manifest parsing working
- ✅ Database schema ready

### Week 2 (Recommended)
1. Build DbtRunner service
2. Build ExtractionOrchestrator
3. Add Docker support
4. Update UI for auto-extraction
5. Test with sample repos

### Week 3
1. Add GitHub webhook support
2. Setup webhook on connection
3. Handle webhook events
4. Add real-time progress

### Week 4
1. Add polling service (backup)
2. Add manual refresh button
3. Add extraction history
4. Performance optimization

---

## Recommended Approach

### For MVP (Week 2-3)
✅ **Automatic extraction on connection**
- User connects repo
- System automatically runs dbt parse
- Extracts and stores metadata
- No manual upload needed

✅ **Manual refresh button**
- User can trigger re-extraction anytime
- Simple, immediate feedback
- No webhook setup complexity

### For Production (Week 4+)
✅ **GitHub webhooks**
- Real-time updates (30 seconds)
- Best developer experience
- Industry standard

✅ **Polling as backup**
- For repos without webhook access
- Fallback for failed webhooks
- Configurable intervals

---

## Summary

### Current Approach (Manual Upload)
❌ **Not suitable for production**
- Too manual
- Data gets stale
- Poor UX

### Recommended Approach (Auto-Extraction)
✅ **Production-ready solution**
- Automatic on connection
- Always up-to-date
- Zero user friction
- Better DX

### Next Steps
1. **Keep manual upload** as fallback option
2. **Build auto-extraction** (DbtRunner + Orchestrator)
3. **Add webhooks** for real-time updates
4. **Add polling** as backup

---

**Bottom Line:** You're right - manual upload doesn't work. Let's build automatic extraction! 🚀
