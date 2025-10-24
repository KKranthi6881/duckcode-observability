# Automated Documentation Update System - Design Document

## Overview
Automatically update AI-generated documentation when code changes in connected repositories (GitHub, GitLab, etc.).

---

## Problem Statement

### Current Flow:
```
1. User connects repository → Metadata extracted
2. Admin generates documentation manually
3. Code changes in repository → Documentation becomes stale ❌
4. No automatic updates
```

### Desired Flow:
```
1. Code changes in repository (git push)
2. Webhook triggers metadata re-extraction
3. System detects changed objects
4. Automatically regenerates documentation for changed objects ✅
5. Users notified of updates
```

---

## Architecture Components

### 1. Webhook Receivers
**File:** `backend/src/api/controllers/webhook.controller.ts`

```typescript
// GitHub Webhook Handler
POST /api/webhooks/github/:organizationId
- Receives push events from GitHub
- Validates webhook signature (security)
- Queues metadata re-extraction job
- Returns 200 OK immediately

// GitLab Webhook Handler  
POST /api/webhooks/gitlab/:organizationId
- Receives push events from GitLab
- Validates webhook token
- Queues metadata re-extraction job
- Returns 200 OK immediately

// Bitbucket Webhook Handler
POST /api/webhooks/bitbucket/:organizationId
- Similar pattern for Bitbucket
```

### 2. Metadata Change Detector
**File:** `backend/src/services/metadata/MetadataChangeDetector.ts`

```typescript
class MetadataChangeDetector {
  /**
   * Compare old and new metadata to detect changes
   */
  async detectChanges(
    organizationId: string,
    repositoryId: string
  ): Promise<ChangeReport> {
    // 1. Get old metadata snapshot
    const oldObjects = await this.getObjectsSnapshot(repositoryId);
    
    // 2. Re-extract metadata (already done by extraction orchestrator)
    
    // 3. Get new metadata snapshot
    const newObjects = await this.getObjectsSnapshot(repositoryId);
    
    // 4. Compare and categorize changes
    const changes = {
      added: [],      // New objects
      modified: [],   // Changed objects (SQL/definition changed)
      deleted: [],    // Removed objects
      unchanged: []   // No changes
    };
    
    // 5. For each object, check:
    //    - SQL hash changed?
    //    - Column structure changed?
    //    - Dependencies changed?
    //    - File path changed?
    
    return changes;
  }
  
  /**
   * Calculate hash of object's SQL/definition
   */
  private calculateObjectHash(object: Object): string {
    const content = object.sql_definition || object.file_content;
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

### 3. Documentation Update Orchestrator
**File:** `backend/src/services/documentation/DocumentationUpdateOrchestrator.ts`

```typescript
class DocumentationUpdateOrchestrator {
  /**
   * Orchestrate documentation updates after metadata changes
   */
  async handleMetadataChange(
    organizationId: string,
    repositoryId: string,
    changeReport: ChangeReport
  ): Promise<void> {
    // 1. Determine which objects need doc updates
    const objectsToUpdate = [
      ...changeReport.added,    // New objects need new docs
      ...changeReport.modified  // Modified objects need regeneration
    ];
    
    if (objectsToUpdate.length === 0) {
      console.log('No objects changed, no documentation updates needed');
      return;
    }
    
    // 2. Create background job for documentation regeneration
    const job = await documentationJobOrchestrator.createJob({
      organizationId,
      objectIds: objectsToUpdate.map(o => o.id),
      mode: 'auto-update',  // New mode for automatic updates
      triggeredBy: 'webhook',
      changeType: 'code_change'
    });
    
    // 3. Log update event
    await this.logUpdateEvent(organizationId, repositoryId, {
      jobId: job.id,
      objectCount: objectsToUpdate.length,
      changeReport
    });
    
    // 4. Notify users
    await this.notifyUsers(organizationId, {
      type: 'documentation_update',
      objectCount: objectsToUpdate.length,
      repositoryName: repository.name
    });
  }
  
  /**
   * Handle deleted objects
   */
  async handleDeletedObjects(deletedObjects: Object[]): Promise<void> {
    // Archive old documentation (don't delete, keep history)
    for (const obj of deletedObjects) {
      await supabaseAdmin
        .schema('metadata')
        .from('object_documentation')
        .update({
          is_current: false,
          archived_at: new Date().toISOString(),
          archive_reason: 'object_deleted'
        })
        .eq('object_id', obj.id)
        .eq('is_current', true);
    }
  }
}
```

### 4. Webhook Event Flow

```
┌─────────────────┐
│  GitHub/GitLab  │
│   Git Push      │
└────────┬────────┘
         │
         │ POST webhook
         ▼
┌─────────────────────────┐
│  Webhook Controller     │
│  - Validate signature   │
│  - Queue extraction     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  Metadata Extraction    │
│  Orchestrator           │
│  - Re-extract metadata  │
│  - Update database      │
└────────┬────────────────┘
         │
         │ On complete
         ▼
┌─────────────────────────┐
│  Metadata Change        │
│  Detector               │
│  - Compare old vs new   │
│  - Categorize changes   │
└────────┬────────────────┘
         │
         │ Changes detected
         ▼
┌─────────────────────────┐
│  Documentation Update   │
│  Orchestrator           │
│  - Create job           │
│  - Regenerate docs      │
│  - Notify users         │
└─────────────────────────┘
```

---

## Database Schema Updates

### 1. Add Hash Column to Objects Table
```sql
-- Migration: Add hash column for change detection
ALTER TABLE metadata.objects 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Create index for faster lookups
CREATE INDEX idx_objects_content_hash 
ON metadata.objects(content_hash);

-- Update existing objects with hash
UPDATE metadata.objects
SET content_hash = encode(sha256(COALESCE(sql_definition, file_content, '')::bytea), 'hex')
WHERE content_hash IS NULL;
```

### 2. Documentation Update Events Table
```sql
-- Track documentation update events
CREATE TABLE IF NOT EXISTS metadata.documentation_update_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id),
  repository_id UUID NOT NULL REFERENCES metadata.repositories(id),
  job_id UUID REFERENCES metadata.documentation_jobs(id),
  
  -- Change information
  objects_added INTEGER DEFAULT 0,
  objects_modified INTEGER DEFAULT 0,
  objects_deleted INTEGER DEFAULT 0,
  
  -- Trigger information
  triggered_by VARCHAR(50), -- 'webhook', 'manual', 'scheduled'
  trigger_event VARCHAR(100), -- 'git_push', 'branch_merge', etc.
  commit_sha VARCHAR(64),
  commit_author VARCHAR(255),
  commit_message TEXT,
  
  -- Status
  status VARCHAR(50), -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_doc_update_events_org 
ON metadata.documentation_update_events(organization_id);

CREATE INDEX idx_doc_update_events_repo 
ON metadata.documentation_update_events(repository_id);
```

### 3. Update Documentation Jobs Table
```sql
-- Add mode column to track automatic vs manual jobs
ALTER TABLE metadata.documentation_jobs
ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'manual';
-- Values: 'manual', 'auto-update', 'scheduled'

ALTER TABLE metadata.documentation_jobs
ADD COLUMN IF NOT EXISTS update_event_id UUID REFERENCES metadata.documentation_update_events(id);
```

---

## Implementation Steps

### Step 1: Webhook Setup (Backend)

#### 1.1 Create Webhook Controller
```typescript
// backend/src/api/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';

export class WebhookController {
  /**
   * Handle GitHub webhook
   */
  async handleGitHubWebhook(req: Request, res: Response) {
    try {
      // 1. Validate webhook signature
      const signature = req.headers['x-hub-signature-256'] as string;
      if (!this.validateGitHubSignature(req.body, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      // 2. Check event type
      const event = req.headers['x-github-event'];
      if (event !== 'push') {
        return res.status(200).json({ message: 'Event ignored' });
      }
      
      // 3. Extract information
      const { repository, ref, commits, pusher } = req.body;
      const organizationId = req.params.organizationId;
      
      // 4. Queue metadata re-extraction
      await metadataExtractionOrchestrator.queueExtraction({
        organizationId,
        repositoryUrl: repository.clone_url,
        branch: ref.replace('refs/heads/', ''),
        triggerType: 'webhook',
        webhookData: {
          commits: commits.length,
          pusher: pusher.name,
          lastCommit: commits[commits.length - 1]
        }
      });
      
      // 5. Return success immediately (don't wait for extraction)
      res.status(200).json({ 
        message: 'Webhook received',
        status: 'queued'
      });
      
    } catch (error) {
      console.error('GitHub webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
  
  /**
   * Validate GitHub webhook signature
   */
  private validateGitHubSignature(payload: any, signature: string): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET!;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }
  
  /**
   * Handle GitLab webhook
   */
  async handleGitLabWebhook(req: Request, res: Response) {
    try {
      // 1. Validate webhook token
      const token = req.headers['x-gitlab-token'] as string;
      if (!this.validateGitLabToken(token)) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      
      // 2. Check event type
      const event = req.headers['x-gitlab-event'];
      if (event !== 'Push Hook') {
        return res.status(200).json({ message: 'Event ignored' });
      }
      
      // 3. Extract information
      const { project, ref, commits, user_name } = req.body;
      const organizationId = req.params.organizationId;
      
      // 4. Queue metadata re-extraction
      await metadataExtractionOrchestrator.queueExtraction({
        organizationId,
        repositoryUrl: project.git_http_url,
        branch: ref.replace('refs/heads/', ''),
        triggerType: 'webhook',
        webhookData: {
          commits: commits.length,
          pusher: user_name,
          lastCommit: commits[commits.length - 1]
        }
      });
      
      res.status(200).json({ 
        message: 'Webhook received',
        status: 'queued'
      });
      
    } catch (error) {
      console.error('GitLab webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
}
```

#### 1.2 Add Webhook Routes
```typescript
// backend/src/api/routes/webhook.routes.ts
import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();
const webhookController = new WebhookController();

// GitHub webhooks (no auth - signature validated in controller)
router.post('/github/:organizationId', 
  webhookController.handleGitHubWebhook.bind(webhookController)
);

// GitLab webhooks (no auth - token validated in controller)
router.post('/gitlab/:organizationId',
  webhookController.handleGitLabWebhook.bind(webhookController)
);

export default router;
```

### Step 2: Metadata Change Detection

#### 2.1 Create Change Detector
```typescript
// backend/src/services/metadata/MetadataChangeDetector.ts
interface ChangeReport {
  added: Object[];
  modified: Object[];
  deleted: Object[];
  unchanged: Object[];
  summary: {
    totalChanges: number;
    addedCount: number;
    modifiedCount: number;
    deletedCount: number;
  };
}

export class MetadataChangeDetector {
  /**
   * Detect what changed after metadata re-extraction
   */
  async detectChanges(
    organizationId: string,
    repositoryId: string
  ): Promise<ChangeReport> {
    // 1. Take snapshot BEFORE extraction (stored in temp table)
    const oldObjects = await this.getOldObjectsSnapshot(repositoryId);
    
    // 2. Get current objects AFTER extraction
    const newObjects = await this.getCurrentObjects(repositoryId);
    
    // 3. Build maps for comparison
    const oldMap = new Map(oldObjects.map(o => [o.id, o]));
    const newMap = new Map(newObjects.map(o => [o.id, o]));
    
    const changes: ChangeReport = {
      added: [],
      modified: [],
      deleted: [],
      unchanged: [],
      summary: {
        totalChanges: 0,
        addedCount: 0,
        modifiedCount: 0,
        deletedCount: 0
      }
    };
    
    // 4. Find added and modified objects
    for (const [id, newObj] of newMap) {
      const oldObj = oldMap.get(id);
      
      if (!oldObj) {
        // New object added
        changes.added.push(newObj);
      } else {
        // Check if modified
        if (this.hasObjectChanged(oldObj, newObj)) {
          changes.modified.push(newObj);
        } else {
          changes.unchanged.push(newObj);
        }
      }
    }
    
    // 5. Find deleted objects
    for (const [id, oldObj] of oldMap) {
      if (!newMap.has(id)) {
        changes.deleted.push(oldObj);
      }
    }
    
    // 6. Calculate summary
    changes.summary = {
      totalChanges: changes.added.length + changes.modified.length + changes.deleted.length,
      addedCount: changes.added.length,
      modifiedCount: changes.modified.length,
      deletedCount: changes.deleted.length
    };
    
    return changes;
  }
  
  /**
   * Check if object has changed
   */
  private hasObjectChanged(oldObj: any, newObj: any): boolean {
    // Compare content hash
    if (oldObj.content_hash !== newObj.content_hash) {
      return true;
    }
    
    // Compare column count (structure change)
    if (oldObj.column_count !== newObj.column_count) {
      return true;
    }
    
    // Compare file path (moved file)
    if (oldObj.file_path !== newObj.file_path) {
      return true;
    }
    
    return false;
  }
}
```

### Step 3: Auto-Update Orchestrator

#### 3.1 Extend Metadata Extraction Orchestrator
```typescript
// backend/src/services/metadata/MetadataExtractionOrchestrator.ts

// Add to existing orchestrator
class MetadataExtractionOrchestrator {
  /**
   * Handle extraction completion (called after metadata extraction finishes)
   */
  async onExtractionComplete(
    organizationId: string,
    repositoryId: string,
    extractionResult: ExtractionResult
  ): Promise<void> {
    try {
      console.log('[Auto-Update] Extraction completed, checking for changes...');
      
      // 1. Detect changes
      const changeDetector = new MetadataChangeDetector();
      const changes = await changeDetector.detectChanges(organizationId, repositoryId);
      
      console.log('[Auto-Update] Change summary:', changes.summary);
      
      // 2. If no changes, skip documentation update
      if (changes.summary.totalChanges === 0) {
        console.log('[Auto-Update] No changes detected, skipping documentation update');
        return;
      }
      
      // 3. Get organization settings
      const settings = await this.getOrganizationSettings(organizationId);
      
      // 4. Check if auto-update is enabled
      if (!settings.auto_update_documentation) {
        console.log('[Auto-Update] Auto-update disabled for organization');
        return;
      }
      
      // 5. Trigger documentation update
      const updateOrchestrator = new DocumentationUpdateOrchestrator();
      await updateOrchestrator.handleMetadataChange(
        organizationId,
        repositoryId,
        changes
      );
      
    } catch (error) {
      console.error('[Auto-Update] Error:', error);
      // Don't fail extraction if auto-update fails
    }
  }
}
```

### Step 4: User Notification System

#### 4.1 Create Notification Service
```typescript
// backend/src/services/notifications/NotificationService.ts
export class NotificationService {
  /**
   * Notify users about documentation updates
   */
  async notifyDocumentationUpdate(
    organizationId: string,
    updateInfo: {
      objectCount: number;
      repositoryName: string;
      commitInfo?: any;
    }
  ): Promise<void> {
    // 1. Get organization admins
    const admins = await this.getOrganizationAdmins(organizationId);
    
    // 2. Create notification
    const notification = {
      type: 'documentation_update',
      title: 'Documentation Updated',
      message: `${updateInfo.objectCount} objects in ${updateInfo.repositoryName} have been updated`,
      data: updateInfo,
      created_at: new Date()
    };
    
    // 3. Send to all admins
    for (const admin of admins) {
      await this.createUserNotification(admin.user_id, notification);
    }
    
    // 4. Optional: Send email
    if (updateInfo.objectCount > 10) {
      await this.sendEmailNotification(admins, notification);
    }
  }
}
```

---

## Configuration & Settings

### Organization Settings Table
```sql
CREATE TABLE IF NOT EXISTS enterprise.organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES enterprise.organizations(id),
  
  -- Auto-update settings
  auto_update_documentation BOOLEAN DEFAULT true,
  auto_update_on_push BOOLEAN DEFAULT true,
  auto_update_on_merge BOOLEAN DEFAULT true,
  
  -- Notification settings
  notify_on_update BOOLEAN DEFAULT true,
  notify_admins_only BOOLEAN DEFAULT true,
  
  -- Frequency control
  min_update_interval_minutes INTEGER DEFAULT 30, -- Avoid too frequent updates
  
  -- Cost control
  max_auto_updates_per_day INTEGER DEFAULT 100,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### UI Settings Panel
```tsx
// Admin Settings Page
<div className="settings-section">
  <h3>Documentation Auto-Update</h3>
  
  <label>
    <input type="checkbox" checked={settings.auto_update_documentation} />
    Enable automatic documentation updates
  </label>
  
  <label>
    <input type="checkbox" checked={settings.auto_update_on_push} />
    Update on Git push
  </label>
  
  <label>
    <input type="checkbox" checked={settings.auto_update_on_merge} />
    Update on branch merge
  </label>
  
  <div className="cost-control">
    <label>
      Max auto-updates per day:
      <input type="number" value={settings.max_auto_updates_per_day} />
    </label>
    <p className="help-text">
      Limit automatic updates to control API costs
    </p>
  </div>
</div>
```

---

## Webhook Setup Instructions

### For GitHub:
1. Go to repository Settings → Webhooks
2. Click "Add webhook"
3. Payload URL: `https://your-domain.com/api/webhooks/github/{organizationId}`
4. Content type: `application/json`
5. Secret: (copy from env var `GITHUB_WEBHOOK_SECRET`)
6. Events: Select "Just the push event"
7. Active: ✓

### For GitLab:
1. Go to repository Settings → Webhooks
2. URL: `https://your-domain.com/api/webhooks/gitlab/{organizationId}`
3. Secret token: (copy from env var `GITLAB_WEBHOOK_TOKEN`)
4. Trigger: ✓ Push events
5. Enable SSL verification: ✓
6. Click "Add webhook"

---

## Testing Strategy

### Unit Tests
```typescript
// Test webhook signature validation
describe('WebhookController', () => {
  it('should validate GitHub signature correctly', () => {
    // Test implementation
  });
  
  it('should detect added objects', () => {
    // Test change detection
  });
  
  it('should detect modified objects', () => {
    // Test content hash comparison
  });
});
```

### Integration Tests
```typescript
// Test end-to-end webhook flow
describe('Auto-Update Flow', () => {
  it('should trigger documentation update on push', async () => {
    // 1. Send webhook payload
    // 2. Wait for metadata extraction
    // 3. Verify documentation job created
    // 4. Verify documentation regenerated
  });
});
```

---

## Performance Considerations

### 1. Debouncing
```typescript
// Avoid too frequent updates (multiple pushes in short time)
class WebhookDebouncer {
  private pending = new Map<string, NodeJS.Timeout>();
  
  debounce(repositoryId: string, callback: () => void, delayMs: number = 60000) {
    // Clear existing timer
    if (this.pending.has(repositoryId)) {
      clearTimeout(this.pending.get(repositoryId)!);
    }
    
    // Set new timer
    const timer = setTimeout(() => {
      callback();
      this.pending.delete(repositoryId);
    }, delayMs);
    
    this.pending.set(repositoryId, timer);
  }
}
```

### 2. Smart Regeneration
```typescript
// Only regenerate if content actually changed (not just formatting)
async shouldRegenerateDocumentation(
  oldObject: Object,
  newObject: Object
): Promise<boolean> {
  // Skip if only whitespace/comments changed
  const oldNormalized = this.normalizeSQL(oldObject.sql_definition);
  const newNormalized = this.normalizeSQL(newObject.sql_definition);
  
  return oldNormalized !== newNormalized;
}
```

### 3. Batch Processing
```typescript
// Process updates in batches to avoid overwhelming API
const BATCH_SIZE = 10;
for (let i = 0; i < objectsToUpdate.length; i += BATCH_SIZE) {
  const batch = objectsToUpdate.slice(i, i + BATCH_SIZE);
  await this.regenerateBatch(batch);
  await this.delay(5000); // Rate limiting
}
```

---

## Cost Management

### API Cost Estimation
```
Average documentation generation: $0.003 per object
10 objects changed per day: $0.03/day = $0.90/month
100 objects changed per day: $0.30/day = $9/month
```

### Cost Control Features
1. **Daily limits** - Max auto-updates per day
2. **Threshold detection** - Only update if >X% of content changed
3. **Manual approval** - For large updates (>50 objects)
4. **Scheduled updates** - Batch updates during off-peak hours

---

## Monitoring & Alerting

### Metrics to Track
```typescript
// Track in analytics table
- webhook_received_count
- extraction_triggered_count
- documentation_update_count
- objects_updated_count
- update_success_rate
- average_update_time
- api_cost_per_update
```

### Alerts
```
- Alert if >100 objects changed (potential issue)
- Alert if update success rate <90%
- Alert if daily cost exceeds budget
- Alert if webhook signature validation fails (security)
```

---

## Rollout Plan

### Phase 1: Foundation (Week 1)
- [ ] Add webhook controllers
- [ ] Add webhook routes
- [ ] Implement signature validation
- [ ] Test with GitHub/GitLab

### Phase 2: Change Detection (Week 2)
- [ ] Implement MetadataChangeDetector
- [ ] Add content_hash to objects table
- [ ] Create comparison logic
- [ ] Add unit tests

### Phase 3: Auto-Update (Week 3)
- [ ] Implement DocumentationUpdateOrchestrator
- [ ] Integrate with existing job system
- [ ] Add notification service
- [ ] Create settings UI

### Phase 4: Polish & Deploy (Week 4)
- [ ] Add monitoring/logging
- [ ] Implement cost controls
- [ ] Add debouncing
- [ ] Documentation & training
- [ ] Production deployment

---

## Security Considerations

1. **Webhook Validation** - Always validate signatures/tokens
2. **Rate Limiting** - Prevent webhook spam/DoS
3. **IP Whitelist** - Optional: Only accept from GitHub/GitLab IPs
4. **Secret Rotation** - Rotate webhook secrets regularly
5. **Audit Logging** - Log all auto-update events
6. **Access Control** - Only org admins can configure webhooks

---

## Future Enhancements

### Phase 2 Features:
1. **Smart Scheduling** - Update during off-peak hours
2. **Diff Preview** - Show what changed before regenerating
3. **Selective Updates** - Let users choose which objects to update
4. **Version History** - Keep documentation versions (git-like)
5. **A/B Testing** - Compare old vs new documentation
6. **CI/CD Integration** - Block merges if documentation out of sync

---

## Summary

### What This Solves:
✅ Automatic documentation updates on code changes
✅ Works with GitHub, GitLab, and other providers
✅ Smart change detection (only update what changed)
✅ Cost-effective (batch processing, rate limiting)
✅ User notifications
✅ Full audit trail

### User Experience:
```
Developer pushes code → 
Webhook received → 
Metadata re-extracted → 
Changes detected → 
Documentation auto-updated → 
Team notified → 
✅ Documentation always fresh!
```

### Next Steps:
1. Review this design
2. Prioritize phases
3. Start with Phase 1 (webhooks)
4. Iterate based on feedback
