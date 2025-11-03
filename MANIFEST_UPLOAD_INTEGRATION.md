# Manifest Upload UI Integration Guide

## ✅ Components Created

### 1. Backend API
- ✅ `backend/src/api/controllers/manifest-upload.controller.ts`
  - `uploadManifest()` - Processes uploaded manifest.json
  - `getExtractionError()` - Returns error details with guidance
  
- ✅ `backend/src/api/routes/metadata.routes.ts`
  - `POST /api/metadata/connections/:connectionId/upload-manifest`
  - `GET /api/metadata/connections/:connectionId/error`

### 2. Frontend Components
- ✅ `frontend/src/components/modals/ManifestUploadModal.tsx`
  - File upload with drag & drop
  - Validation and processing
  - Success stats display
  
- ✅ `frontend/src/components/ExtractionErrorRecovery.tsx`
  - Error display with guidance
  - Two recovery options (Retry / Upload)
  - Collapsible detailed guidance

---

## 🔧 Integration Steps

### Step 1: Find Your Connection Component

Look for the component that displays GitHub/GitLab connections. Common locations:
- `frontend/src/components/ConnectionCard.tsx`
- `frontend/src/components/RepositoryGrid.tsx`
- `frontend/src/components/MetadataProcessingDashboard.tsx`
- `frontend/src/pages/ConnectionsPage.tsx`

### Step 2: Import the Component

```typescript
import { ExtractionErrorRecovery } from '../components/ExtractionErrorRecovery';
```

### Step 3: Add to Connection Display

Find where you display connection status and add this logic:

```tsx
// Example integration in ConnectionCard.tsx
{connection.status === 'failed' && (
  <ExtractionErrorRecovery
    connectionId={connection.id}
    onRetry={() => {
      // Trigger extraction retry
      retryExtraction(connection.id);
    }}
    onSuccess={() => {
      // Refresh connection data
      refreshConnection();
    }}
  />
)}
```

### Full Example:

```tsx
export function ConnectionCard({ connection }: { connection: GitHubConnection }) {
  const handleRetry = async () => {
    try {
      await axios.post(`/api/metadata/connections/${connection.id}/extract`);
      // Refresh to show new status
      window.location.reload();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  const handleSuccess = () => {
    // Refresh or redirect to metadata view
    window.location.reload();
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      {/* Connection Info */}
      <div className="mb-4">
        <h3 className="text-white text-lg font-semibold">{connection.repository_url}</h3>
        <p className="text-slate-400 text-sm">Branch: {connection.branch}</p>
      </div>

      {/* Status Badge */}
      <div className="mb-4">
        <StatusBadge status={connection.status} />
      </div>

      {/* Show Error Recovery when status is 'failed' */}
      {connection.status === 'failed' && (
        <ExtractionErrorRecovery
          connectionId={connection.id}
          onRetry={handleRetry}
          onSuccess={handleSuccess}
        />
      )}

      {/* Show success state when completed */}
      {connection.status === 'completed' && (
        <div className="bg-green-500/10 border border-green-500/50 rounded p-4">
          <p className="text-green-300">✅ Extraction completed successfully</p>
          <button className="mt-2 text-sm text-blue-400 hover:underline">
            View Metadata →
          </button>
        </div>
      )}

      {/* Show extracting state */}
      {connection.status === 'extracting' && (
        <div className="bg-blue-500/10 border border-blue-500/50 rounded p-4">
          <p className="text-blue-300">⏳ Extraction in progress...</p>
        </div>
      )}
    </div>
  );
}
```

---

## 🎨 UI Flow

### Scenario 1: Extraction Fails

1. User triggers extraction → dbt parse fails in Docker
2. Connection status → `failed`
3. UI shows `ExtractionErrorRecovery` component with:
   - ❌ Error message
   - 💡 Detailed guidance (collapsible)
   - Two buttons:
     - **Retry Extraction** (blue) - Try again after fixing
     - **Upload Manifest** (green) - Opens upload modal

### Scenario 2: User Chooses Retry

1. User fixes dbt project locally
2. Clicks "Retry Extraction"
3. Backend re-runs extraction
4. If successful → status changes to `completed`
5. If fails again → same error recovery UI

### Scenario 3: User Uploads Manifest

1. User clicks "Upload Manifest"
2. Modal opens with instructions
3. User runs `dbt parse` locally
4. Drags `manifest.json` into modal or browses
5. Clicks "Upload Manifest"
6. Backend processes and stores as GOLD tier
7. Success screen shows stats
8. Auto-closes and refreshes

---

## 🔍 Testing

### Test Case 1: Upload Valid Manifest

```bash
# In your dbt project
cd /path/to/dbt/project
dbt parse

# manifest.json should exist in target/
ls target/manifest.json
```

Upload this file and verify:
- ✅ Upload succeeds
- ✅ Shows model/source counts
- ✅ Connection status → `completed`
- ✅ extraction_tier → `GOLD`

### Test Case 2: Upload Invalid File

Try uploading:
- Non-JSON file → Error: "Please select a JSON file"
- Invalid JSON → Error: "Invalid JSON format"
- JSON without metadata/nodes → Error: "Invalid manifest.json format"

### Test Case 3: Retry After Fix

1. Trigger extraction on broken dbt project → Fails
2. Fix the dbt errors locally
3. Click "Retry Extraction"
4. Should succeed

---

## 📊 Status Badge Component

If you need a status badge component:

```tsx
function StatusBadge({ status }: { status: string }) {
  const configs = {
    completed: {
      bg: 'bg-green-500/20',
      text: 'text-green-300',
      label: '✅ Completed'
    },
    failed: {
      bg: 'bg-red-500/20',
      text: 'text-red-300',
      label: '❌ Failed'
    },
    extracting: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-300',
      label: '⏳ Extracting'
    },
    connected: {
      bg: 'bg-slate-500/20',
      text: 'text-slate-300',
      label: '🔗 Connected'
    }
  };

  const config = configs[status as keyof typeof configs] || configs.connected;

  return (
    <span className={`${config.bg} ${config.text} px-3 py-1 rounded-full text-xs font-medium`}>
      {config.label}
    </span>
  );
}
```

---

## 🚀 Ready to Deploy

### Before Deploying:

1. ✅ Backend API endpoints tested
2. ✅ Frontend components match UI theme
3. ✅ TypeScript errors resolved
4. ✅ Integration added to connection UI
5. ✅ Test with real dbt project

### After Deploying:

1. Monitor error rates
2. Collect user feedback
3. Track upload success rate
4. Improve error guidance based on common failures

---

## 💡 Future Enhancements

1. **Auto-detect Common Fixes**
   - Detect missing `profiles.yml` → Suggest creating one
   - Detect missing packages → Auto-run `dbt deps`

2. **Manifest Validation**
   - Show preview of what will be extracted
   - Warn if manifest is outdated

3. **Bulk Upload**
   - Allow uploading manifest + catalog.json together
   - Support multiple connections

4. **Guided Fixes**
   - Interactive wizard for common errors
   - Link to dbt docs for specific error codes
