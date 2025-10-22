# Unified Repository Architecture

## 🎯 Goal

Consolidate to **ONE GitHub integration approach** where:
- **Admins** connect repositories in admin page
- **All users** (admins + members) view and use those repositories in main dashboard
- Remove old GitHub App approach (if exists)

---

## 📊 Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│ ADMIN PAGE (Admins Only)                                    │
│                                                              │
│ ✅ Connect GitHub repositories                              │
│ ✅ Enter GitHub Personal Access Token (encrypted AES-256)   │
│ ✅ Run metadata extraction                                  │
│ ✅ Manage connections (delete, re-extract)                  │
│                                                              │
│ Database: enterprise.github_connections                     │
└──────────────────────────────────────────────────────────────┘
                            ↓
                    (Stored in Database)
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ MAIN DASHBOARD (All Users: Admins + Members)                │
│                                                              │
│ ✅ View all connected repositories                          │
│ ✅ Browse lineage diagrams                                  │
│ ✅ Read documentation                                       │
│ ✅ Explore data catalog                                     │
│ ✅ Search metadata (Tantivy)                                │
│                                                              │
│ API: GET /api/repositories (organization-scoped)            │
└──────────────────────────────────────────────────────────────┘
```

---

## ✅ Completed Work

### 1. Backend API Infrastructure

#### **New Controller:** `repository.controller.ts`
- `listRepositories()` - Get all repos for user's organization
- `getRepositoryStats()` - Get stats for specific repository
- `getRepositoryMetadata()` - Get metadata objects for repository

#### **New Routes:** `repository.routes.ts`
```typescript
GET /api/repositories              // List all org repos
GET /api/repositories/:id/stats    // Get repo statistics
GET /api/repositories/:id/metadata // Get repo metadata objects
```

#### **Security:**
- All endpoints require authentication (`requireAuth` middleware)
- Organization-scoped (users only see their org's repos)
- Admins and members have same read access

### 2. Frontend Service Layer

#### **New Service:** `repositoryService.ts`
```typescript
// Fetch organization repositories
getOrganizationRepositories(token)

// Get repository statistics
getRepositoryStats(repositoryId, token)

// Get metadata objects
getRepositoryMetadata(repositoryId, token)

// Transform for dashboard display
transformRepositoryForDashboard(repo)
```

#### **TypeScript Interfaces:**
- `Repository` - Admin-connected repository data
- `RepositoryStats` - Dashboard display format
- `MetadataObject` - Metadata object structure

---

## 📋 Remaining Work

### Step 3: Update Main Dashboard Component

**File:** `frontend/src/pages/Dashboard.tsx`

**Changes Needed:**
```typescript
// BEFORE (Mock Data):
useEffect(() => {
  setRepositories([/* hardcoded mock data */]);
}, []);

// AFTER (Real Data):
import { getOrganizationRepositories, transformRepositoryForDashboard } from '@/services/repositoryService';

useEffect(() => {
  const fetchRepositories = async () => {
    const token = await getAuthToken(); // Get from auth context
    const repos = await getOrganizationRepositories(token);
    const transformed = repos.map(transformRepositoryForDashboard);
    setRepositories(transformed);
  };
  fetchRepositories();
}, []);
```

### Step 4: Update Lineage View

**Files to Update:**
- `frontend/src/components/lineage/*`
- `frontend/src/pages/LineagePage.tsx` (if exists)

**Changes:**
- Replace user-specific repo selection with org repos
- Use `getOrganizationRepositories()` for repo list
- Filter lineage data by selected org repository

### Step 5: Update Documentation View

**Changes:**
- Show documentation from admin-connected repos
- Use org repository list for navigation
- Display metadata objects from `getRepositoryMetadata()`

### Step 6: Update Data Catalog

**Changes:**
- Catalog shows objects from all admin-connected repos
- Use org repository filter
- Search across all org repositories

### Step 7: Remove Old GitHub App Code

**Files to Audit & Remove:**
- `frontend/src/hooks/useGitHubRepository.ts` (if user-specific)
- `frontend/src/services/githubService.ts` (if GitHub App related)
- `frontend/src/pages/GitHubCallbackPage.tsx` (if GitHub App OAuth)
- Any GitHub App installation UI components

**Keep:**
- Admin GitHub connection UI (already working)
- Encryption service (already implemented)
- Metadata extraction orchestrators (already working)

---

## 🔄 Data Flow

### Admin Connects Repository

```
1. Admin → Admin Page → "Connect Repository"
2. Enter: GitHub URL, Branch, Personal Access Token
3. Backend validates token format
4. Backend encrypts token (AES-256-GCM)
5. Store in: enterprise.github_connections
6. Run metadata extraction
7. Store metadata in: metadata.objects, metadata.columns, etc.
8. Create Tantivy search index
```

### User Views Data

```
1. User → Main Dashboard
2. Frontend: GET /api/repositories (with auth token)
3. Backend: Fetch from enterprise.github_connections
   WHERE organization_id = user's org
4. Return all repos (admin-connected)
5. User selects repository
6. Frontend: GET /api/repositories/:id/metadata
7. Display: Lineage, Documentation, Catalog
```

---

## 🔒 Security Model

### Admin Permissions
- ✅ Connect repositories
- ✅ Run metadata extraction
- ✅ Delete connections
- ✅ View all data

### Member Permissions
- ✅ View connected repositories
- ✅ Browse lineage diagrams
- ✅ Read documentation
- ✅ Search metadata
- ❌ Cannot connect/disconnect repos
- ❌ Cannot run extraction

### Data Isolation
- Users only see repos from their organization
- Organization ID enforced at API level
- GitHub tokens encrypted at rest
- Tokens never exposed to frontend

---

## 📊 Database Schema

### Admin Connections
```sql
enterprise.github_connections
├── id (UUID)
├── organization_id (UUID) ← Organization isolation
├── repository_name (TEXT)
├── repository_owner (TEXT)
├── repository_url (TEXT)
├── branch (TEXT)
├── access_token_encrypted (TEXT) ← AES-256-GCM encrypted
├── status (TEXT) ← connected|extracting|completed|error
├── total_files (INTEGER)
├── total_objects (INTEGER)
├── total_columns (INTEGER)
├── last_extraction_at (TIMESTAMP)
└── created_at (TIMESTAMP)
```

### Metadata Storage
```sql
metadata.objects
├── id (UUID)
├── connection_id (UUID) ← Links to github_connections
├── organization_id (UUID)
├── name (TEXT)
├── object_type (TEXT)
├── schema_name (TEXT)
└── ...

metadata.columns
├── id (UUID)
├── object_id (UUID)
├── name (TEXT)
├── data_type (TEXT)
└── ...

metadata.dependencies
├── source_object_id (UUID)
├── target_object_id (UUID)
└── ...
```

---

## 🧪 Testing Checklist

### Admin Flow
- [ ] Admin can connect GitHub repository
- [ ] Token is encrypted before storage
- [ ] Metadata extraction runs successfully
- [ ] Tantivy index is created
- [ ] Connection appears in admin list

### User Flow
- [ ] Member can see admin-connected repos
- [ ] Member can view lineage diagrams
- [ ] Member can read documentation
- [ ] Member can search metadata
- [ ] Member cannot connect new repos

### Security
- [ ] Users only see their org's repos
- [ ] Tokens are encrypted in database
- [ ] API requires authentication
- [ ] Organization ID is validated

---

## 🚀 Deployment Steps

1. **Deploy Backend Changes:**
   ```bash
   cd backend
   npm run build
   # Restart backend server
   ```

2. **Deploy Frontend Changes:**
   ```bash
   cd frontend
   npm run build
   # Deploy to hosting
   ```

3. **Verify:**
   - Admin connects test repository
   - Member logs in and sees repository
   - Lineage/docs/catalog work correctly

---

## 📝 Benefits

### Before (Two Systems)
- ❌ Confusing - two ways to connect repos
- ❌ Scattered data - each user has own connections
- ❌ Duplication - same repo connected multiple times
- ❌ No central control - admins can't manage

### After (Unified System)
- ✅ Simple - one way to connect repos
- ✅ Centralized - admin controls all connections
- ✅ Efficient - one connection per repo
- ✅ Secure - encrypted tokens, org isolation
- ✅ Scalable - all users share same data

---

## 🎯 Next Steps

1. Update Dashboard component to use real API
2. Update Lineage view with org repos
3. Update Documentation view
4. Update Data Catalog
5. Remove old GitHub App code
6. Test end-to-end flow
7. Deploy to production

**Status:** Backend infrastructure complete ✅  
**Next:** Frontend integration 🚧
