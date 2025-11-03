# 📝 Frontend Integration - Final Steps

## ✅ Completed So Far

1. ✅ Python SQLGlot service deployed (port 8000)
2. ✅ Backend integration complete
3. ✅ ExtractionStatus component created
4. ✅ ManifestUploadModal component created
5. ✅ Components imported into CodeBase.tsx
6. ✅ State added for modal management

## 🔧 Remaining Integration Steps

### **Step 1: Add ExtractionStatus to Repository Cards**

In `CodeBase.tsx` around line 1098, **after** the repository card div but inside the map, add:

```tsx
{repositories.map((repo) => (
  <div key={repo.id}>
    {/* Existing repository card */}
    <div
      onClick={() => handleRepositorySelect(repo)}
      className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 hover:border-blue-300"
    >
      {/* ... existing card content ... */}
    </div>
    
    {/* ADD THIS: Extraction status display */}
    <div className="mt-3">
      <ExtractionStatus
        connection={{
          id: repo.id,
          repository_name: repo.repository_name,
          status: repo.status || 'connected',
          error_message: repo.error_message,
          manifest_uploaded: repo.manifest_uploaded,
          extraction_tier: repo.extraction_tier,
          models_count: repo.models_count,
          sources_count: repo.sources_count,
          column_lineage_count: repo.column_lineage_count
        }}
        onUploadManifest={(connectionId) => {
          setSelectedConnectionId(connectionId);
          setUploadModalOpen(true);
        }}
        onRetry={async (connectionId) => {
          // Trigger extraction retry
          try {
            const response = await fetch(
              `/api/metadata/extract/${connectionId}`,
              {
                method: 'POST',
                credentials: 'include'
              }
            );
            if (response.ok) {
              // Refresh repositories
              const repos = await getOrganizationRepositories(session.access_token);
              setRepositories(repos);
            }
          } catch (error) {
            console.error('Retry extraction failed:', error);
          }
        }}
      />
    </div>
  </div>
))}
```

---

### **Step 2: Add ManifestUploadModal at End of Component**

At the **very end** of the component, before the final closing tag, add:

```tsx
{/* Manifest Upload Modal */}
<ManifestUploadModal
  connectionId={selectedConnectionId || ''}
  repositoryName={
    repositories.find(r => r.id === selectedConnectionId)?.repository_name || ''
  }
  isOpen={uploadModalOpen}
  onClose={() => {
    setUploadModalOpen(false);
    setSelectedConnectionId(null);
  }}
  onSuccess={async () => {
    // Refresh repositories to show updated status
    try {
      const repos = await getOrganizationRepositories(session?.access_token || '');
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to refresh repositories:', error);
    }
  }}
/>
```

---

## 📊 Expected Repository Schema

The integration expects repositories to have these fields (from backend):

```typescript
interface Repository {
  id: string;
  repository_name: string;
  repository_owner: string;
  status: 'connected' | 'extracting' | 'completed' | 'failed';
  error_message?: string;
  manifest_uploaded?: boolean;
  extraction_tier?: 'GOLD' | 'SILVER' | 'BRONZE';
  models_count?: number;
  sources_count?: number;
  column_lineage_count?: number;
  total_objects?: number;
  total_files?: number;
}
```

**Backend Endpoint:** `GET /api/repositories` or `getOrganizationRepositories()`

These fields should be returned by the `enterprise.github_connections` table.

---

## 🗄️ Database Fields Needed

Ensure `enterprise.github_connections` table has:

```sql
-- These should already exist:
- id
- repository_name
- repository_owner
- status (values: 'connected', 'extracting', 'completed', 'failed')
- error_message
- manifest_uploaded
- extraction_tier

-- These might need to be added:
ALTER TABLE enterprise.github_connections
ADD COLUMN IF NOT EXISTS models_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sources_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS column_lineage_count INTEGER DEFAULT 0;
```

---

## 🧪 Testing Steps

### **1. Test Failed State**

```sql
-- Manually set a connection to failed
UPDATE enterprise.github_connections
SET 
  status = 'failed',
  error_message = 'dbt parse failed: profiles.yml not found'
WHERE id = 'your-connection-id';
```

**Expected UI:**
- Red error card appears
- Shows error message
- Shows "profiles.yml" specific guidance
- [Upload Manifest] and [Retry] buttons visible

---

### **2. Test Upload Flow**

1. Click [Upload Manifest.json]
2. Modal opens with instructions
3. Select a manifest.json file
4. Click "Upload & Process"
5. Success message appears
6. Modal auto-closes
7. Repository refreshes to "completed" status

---

### **3. Test Completed State**

```sql
-- Set a connection to completed
UPDATE enterprise.github_connections
SET 
  status = 'completed',
  extraction_tier = 'GOLD',
  models_count = 150,
  sources_count = 25,
  column_lineage_count = 450
WHERE id = 'your-connection-id';
```

**Expected UI:**
- Green success card appears
- Shows "GOLD tier accuracy"
- Displays metrics: 150 models, 25 sources, 450 column lineages

---

## 🎯 End-to-End Flow

### **Scenario: User Connects GitHub Repo**

```
1. User goes to /admin page
2. Connects new GitHub repo
3. Backend creates record with status='connected'
4. Status shown: No extraction card (just repository card)

5. Admin triggers extraction
6. Backend updates status='extracting'
7. Status shown: Blue "Extracting..." card

--- If Success ---
8a. dbt parse succeeds
9a. Python SQLGlot extracts lineage
10a. Backend updates status='completed', tier='GOLD'
11a. Status shown: Green "Extraction Completed" card

--- If Failure ---
8b. dbt parse fails
9b. Backend updates status='failed', error_message='...'
10b. Status shown: Red "Extraction Failed" card
11b. User clicks [Upload Manifest]
12b. Modal opens with instructions
13b. User uploads manifest.json
14b. Backend processes it
15b. Backend updates status='completed', tier='GOLD'
16b. Status shown: Green "Extraction Completed" card
```

---

## 📁 Files Modified Summary

| File | Changes | Status |
|------|---------|--------|
| `ExtractionStatus.tsx` | Created (210 lines) | ✅ Done |
| `ManifestUploadModal.tsx` | Created (280 lines) | ✅ Done |
| `CodeBase.tsx` | Added imports & state | ✅ Done |
| `CodeBase.tsx` | Integrate components | ⏭️ Next |

---

## 🚀 Quick Integration (Copy-Paste)

If you want to integrate quickly, here's the minimal code to add:

**Location:** `CodeBase.tsx` line ~1098

```tsx
{/* After repository card div */}
<div className="mt-3">
  <ExtractionStatus
    connection={repo}
    onUploadManifest={(id) => {
      setSelectedConnectionId(id);
      setUploadModalOpen(true);
    }}
    onRetry={async (id) => {
      await fetch(`/api/metadata/extract/${id}`, { method: 'POST', credentials: 'include' });
      const repos = await getOrganizationRepositories(session.access_token);
      setRepositories(repos);
    }}
  />
</div>
```

**Location:** End of CodeBase component (before final `</div>`)

```tsx
<ManifestUploadModal
  connectionId={selectedConnectionId || ''}
  repositoryName={repositories.find(r => r.id === selectedConnectionId)?.repository_name || ''}
  isOpen={uploadModalOpen}
  onClose={() => { setUploadModalOpen(false); setSelectedConnectionId(null); }}
  onSuccess={async () => {
    const repos = await getOrganizationRepositories(session?.access_token || '');
    setRepositories(repos);
  }}
/>
```

---

## ✅ Done!

After these two additions:
1. ExtractionStatus will show for each repository
2. Upload modal will work when clicking [Upload Manifest]
3. Users will never be stuck when dbt parse fails
4. Complete two-option recovery flow is operational

**Next:** Test with a real dbt project!
