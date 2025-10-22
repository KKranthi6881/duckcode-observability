
# Remove Old GitHub App Integration

## 🎯 Problem Identified

The frontend is calling old GitHub App endpoints that are looking for installations that don't exist:

```
GET /api/github/connection-status  ← OLD (returns 0 rows error)
GET /api/github/start-installation  ← OLD (GitHub App approach)
```

We want to use the **NEW unified approach**:

```
GET /api/repositories  ← NEW (admin-connected repos)
```

---

## 📍 Files with Old GitHub App Code

### 1. **frontend/src/pages/dashboard/Settings.tsx**
**Lines 85-175:** GitHub App connection status and installation logic

**What it does:**
- Fetches GitHub App installation status
- Shows "Connect GitHub" button
- Redirects to GitHub App installation page

**What we need:**
- Remove GitHub App section entirely
- Add note: "Repositories are managed by admins in the Admin page"
- Or remove GitHub section completely from Settings

### 2. **frontend/src/services/githubService.ts**
**Line 166:** Calls `/api/github/connection-status`

**What it does:**
- Service function to check GitHub App connection

**What we need:**
- Replace with call to `/api/repositories`
- Or remove if not used elsewhere

---

## ✅ Solution: Quick Fix

### Option 1: Remove GitHub Section from Settings (Recommended)

Since repositories are now managed by admins, regular users don't need GitHub settings.

**Steps:**
1. Open `frontend/src/pages/dashboard/Settings.tsx`
2. Remove or comment out the entire GitHub connection section (lines ~80-400)
3. Keep only: Profile, Password, Theme, Notifications, Billing

### Option 2: Add Admin Note

Keep the section but show a message:

```tsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
  <h3 className="font-semibold text-blue-900">Repository Management</h3>
  <p className="text-sm text-blue-700 mt-2">
    GitHub repositories are managed by organization admins.
  </p>
  <p className="text-sm text-blue-700 mt-1">
    Contact your admin to connect repositories or visit the{' '}
    <a href="/admin" className="underline font-medium">Admin Page</a>
    {' '}if you have admin access.
  </p>
</div>
```

---

## 🔧 Implementation Steps

### Step 1: Update Settings Page

```bash
# Edit the file
code frontend/src/pages/dashboard/Settings.tsx
```

**Remove these sections:**
- GitHub connection status fetching (lines 85-106)
- GitHub installation handler (lines 135-176)
- GitHub connection UI rendering (find in JSX)

### Step 2: Update Main Dashboard

The Dashboard should fetch from the NEW endpoint:

```typescript
// frontend/src/pages/Dashboard.tsx

import { getOrganizationRepositories } from '@/services/repositoryService';

useEffect(() => {
  const fetchRepos = async () => {
    try {
      const token = session?.access_token;
      if (!token) return;
      
      const repos = await getOrganizationRepositories(token);
      const transformed = repos.map(transformRepositoryForDashboard);
      setRepositories(transformed);
    } catch (error) {
      console.error('Error fetching repositories:', error);
    }
  };
  
  fetchRepos();
}, [session]);
```

### Step 3: Clean Up Backend (Optional)

The old GitHub App endpoints can be removed or deprecated:

```typescript
// backend/src/api/routes/github.routes.ts
// Comment out or remove:
// - /api/github/connection-status
// - /api/github/start-installation
// - /api/github/callback
```

---

## 📊 Before vs After

### Before (Confusing - Two Systems)

```
Settings Page → Connect GitHub App → Install App → Individual user repos
     ❌ Each user connects separately
     ❌ Scattered data
     ❌ No central control

Admin Page → Connect via token → Extract metadata → Admin-only repos
     ❌ Only admin sees data
```

### After (Clean - One System)

```
Admin Page → Connect via token → Extract metadata → Org-wide repos
     ✅ Admin connects once
     ✅ All users see same repos
     ✅ Centralized control

Main Dashboard → Fetch /api/repositories → Display for all users
     ✅ Members see admin-connected repos
     ✅ Lineage, docs, catalog work for everyone
```

---

## 🧪 Testing

After making changes:

1. **As Admin:**
   - Go to Admin page
   - Connect a repository
   - Run metadata extraction
   - Verify it completes

2. **As Member:**
   - Go to Main Dashboard
   - Should see admin-connected repository
   - Click on repository
   - Should see lineage/docs/catalog

3. **Settings Page:**
   - No GitHub App connection UI
   - Or shows admin note

---

## 🚀 Quick Commands

```bash
# 1. Remove GitHub App section from Settings
# Manually edit: frontend/src/pages/dashboard/Settings.tsx

# 2. Update Dashboard to use new API
# Manually edit: frontend/src/pages/Dashboard.tsx

# 3. Test locally
cd frontend
npm run dev

# 4. Commit changes
git add frontend/src/pages/dashboard/Settings.tsx
git add frontend/src/pages/Dashboard.tsx
git commit -m "Remove old GitHub App integration, use admin-connected repos"
git push
```

---

## 📝 Summary

**Current Issue:**
- Frontend calling old GitHub App endpoints
- Getting "0 rows" errors
- Two conflicting systems

**Solution:**
- Remove GitHub App UI from Settings
- Use admin-connected repositories only
- All users see same data via `/api/repositories`

**Next Step:**
- Edit `Settings.tsx` to remove GitHub section
- Update `Dashboard.tsx` to fetch from new endpoint
- Test and deploy

**Status:** Ready to implement ✅
