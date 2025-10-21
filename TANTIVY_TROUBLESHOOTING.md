# Tantivy Integration Troubleshooting Guide

## ✅ **Current Status**

### What's Working:
1. ✅ Tantivy service is running on port 3002
2. ✅ Manual indexing works perfectly (16 objects indexed)
3. ✅ Files are being created in Supabase Storage under `tantivy-indexes/[org-id]/`
4. ✅ Integration code is present in `MetadataExtractionOrchestrator.ts`

### What's NOT Working:
❌ **Automatic indexing is NOT triggered after metadata extraction completes**

---

## 🔍 **Root Cause Analysis**

The integration code exists but the backend is NOT calling it during metadata extraction. This could be due to:

1. **Backend not restarted** - Old code still running
2. **Silent errors** - Errors being caught and swallowed
3. **Async timing issues** - Code executing but failing silently

---

## 🛠️ **Fixes Applied**

### 1. Enhanced Logging in `TantivySearchService.ts`
Added detailed logging to track:
- Tantivy URL configuration
- JWT secret presence
- Token generation
- HTTP request/response details
- Detailed error messages with status codes

### 2. Enhanced Logging in `MetadataExtractionOrchestrator.ts`
Added logging to track:
- When `completeJob()` is called
- Organization ID lookup
- Tantivy indexing trigger
- File indexing trigger
- Detailed error stack traces

### 3. Created Test Script
`backend/test-tantivy-indexing.js` - Manually test indexing to verify service works

---

## 📋 **Next Steps to Debug**

### Step 1: Restart Backend Server
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
# Kill existing process
pkill -f "ts-node.*server.ts"
# Start fresh
npm run dev
```

### Step 2: Run Metadata Extraction
1. Go to admin page
2. Add/re-extract a GitHub repository
3. Wait for extraction to complete

### Step 3: Check Backend Logs
Look for these log messages:
```
📊 Fetching organization_id for connection: [connection-id]
🚀 Starting Tantivy indexing for org: [org-id]
🔍 Triggering search index creation for org: [org-id]
   Tantivy URL: http://localhost:3002
   JWT Secret configured: YES
   Generated JWT token (first 20 chars): ...
✅ Search index created: 16 objects indexed
   Index stored in Supabase Storage with org ID: [org-id]
```

### Step 4: If You See Errors
Common issues and solutions:

**Error: "JWT Secret configured: NO"**
- Solution: Add `JWT_SECRET` to `backend/.env`
- Must match the secret in `tantivy-search-v2/.env`

**Error: "Status: 401 Unauthorized"**
- Solution: JWT secrets don't match between backend and Tantivy
- Check both `.env` files have identical `JWT_SECRET`

**Error: "Status: 404"**
- Solution: Tantivy service not running
- Start it: `cd tantivy-search-v2 && cargo run --release`

**Error: "ECONNREFUSED"**
- Solution: Tantivy service not accessible
- Check: `curl http://localhost:3002/api/v2/search/health`

---

## 🧪 **Manual Testing**

### Test 1: Verify Tantivy Service
```bash
curl http://localhost:3002/api/v2/search/health
```
Expected: `{"status":"healthy","service":"tantivy-search-v2",...}`

### Test 2: Run Integration Test
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
node test-tantivy-indexing.js
```
Expected: `✅ SUCCESS! Index created successfully!`

### Test 3: Check Supabase Storage
```bash
psql postgresql://postgres:postgres@localhost:54322/postgres -c \
  "SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'tantivy-indexes';"
```
Expected: Multiple files (22+ per organization)

### Test 4: Query Index Files
```bash
psql postgresql://postgres:postgres@localhost:54322/postgres -c \
  "SELECT name FROM storage.objects WHERE bucket_id = 'tantivy-indexes' AND name LIKE 'a6feee1a-47c7-4256-bb34-a3fb2c269cc1%' LIMIT 5;"
```

---

## 📊 **Verification Checklist**

After metadata extraction completes, verify:

- [ ] Backend logs show "🚀 Starting Tantivy indexing"
- [ ] Backend logs show "✅ Search index created: X objects indexed"
- [ ] Supabase Storage has files in `tantivy-indexes/[org-id]/`
- [ ] Files include: `.managed.json`, `.tantivy-meta.lock`, `*.fast`, `*.idx`, `*.term`, etc.
- [ ] `metadata.tantivy_indexes` table has entry for organization

---

## 🔧 **Configuration Requirements**

### Backend `.env`
```env
TANTIVY_SERVICE_URL=http://localhost:3002
JWT_SECRET=your-secret-key-here
```

### Tantivy `.env`
```env
PORT=3002
JWT_SECRET=your-secret-key-here  # MUST MATCH BACKEND
SUPABASE_URL=http://localhost:54321
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

---

## 📝 **Expected Workflow**

1. User adds GitHub repo in admin page
2. Backend starts metadata extraction job
3. Extraction processes files and stores in PostgreSQL
4. **Extraction completes** ✅
5. `completeJob()` method is called
6. Backend fetches organization_id
7. Backend calls `TantivySearchService.triggerIndexing(org_id)`
8. TantivySearchService generates JWT token
9. TantivySearchService POSTs to `http://localhost:3002/api/v2/search/index`
10. Tantivy service builds index from PostgreSQL data
11. Tantivy service uploads 22 files to Supabase Storage
12. Tantivy service returns success response
13. Backend logs success message
14. **Search is now available** 🎉

---

## 🚨 **Current Issue**

Steps 5-13 are NOT happening automatically. The code exists but isn't being executed.

**Most Likely Cause:** Backend server needs restart to load new code with enhanced logging.

**Action Required:** Restart backend and run metadata extraction again, then check logs.
