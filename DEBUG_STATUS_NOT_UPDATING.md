# Debug Status Not Updating Issue

## Problem
Status not updating when job is processing. Progress bar shows 0% and object processing list shows "Pending" or "Processing..." but doesn't update.

## Debugging Steps

### 1. Check Browser Console
I've added detailed console logging. Please do the following:

1. **Open browser DevTools** (`F12` or `Cmd+Option+I`)
2. **Go to Console tab**
3. **Clear console** (`Cmd+K` or Ctrl+L)
4. **Trigger a new job** (select objects and click "Generate Documentation")

### Look for these console messages:

```
[AIDocumentation] Job created: <job-id>
[AIDocumentation] Job status fetched: { ... }
```

### What to check:
- ✅ Does `Job created` appear with a valid UUID?
- ✅ Does `Job status fetched` appear every 2 seconds?
- ✅ What does the `job` object contain? Look for:
  - `status`: should change from "queued" → "processing" → "completed"
  - `processed_objects`: should increment (0, 1, 2...)
  - `total_objects`: should match your selection
  - `current_object_name`: should show the object being processed

---

### 2. Check Backend Logs

In your backend terminal, look for:

```
[DocOrchestrator] Starting job processing: <job-id>
[DocOrchestrator] Job <job-id> status: processing
[DocOrchestrator] Processing: <object-name> (<object-type>)
[DocOrchestrator] Generated documentation in XXXms
[DocOrchestrator] Documentation stored: <doc-id>
```

### What to check:
- ✅ Does job processing start?
- ✅ Do you see "Processing: object_name"?
- ✅ Does it complete successfully?
- ✅ Any error messages?

---

### 3. Check Database Directly

Run this SQL query in Supabase SQL Editor:

```sql
-- Check job status
SELECT 
  id,
  status,
  total_objects,
  processed_objects,
  failed_objects,
  current_object_id,
  current_object_name,
  created_at,
  started_at,
  completed_at
FROM metadata.documentation_jobs
ORDER BY created_at DESC
LIMIT 5;
```

### What to check:
- ✅ Is `status` changing? (queued → processing → completed)
- ✅ Is `processed_objects` incrementing?
- ✅ Is `current_object_name` updating?
- ✅ Is `started_at` set?

---

### 4. Check if Job is Actually Running

Run this in Supabase SQL Editor while job is processing:

```sql
-- Check recent logs
SELECT 
  job_id,
  object_id,
  layer_name,
  status,
  created_at
FROM metadata.documentation_generation_logs
ORDER BY created_at DESC
LIMIT 20;
```

### What to check:
- ✅ Are logs being created?
- ✅ Is `status` 'completed' or 'failed'?
- ✅ Which layers are being generated?

---

### 5. Check API Response

In browser DevTools:

1. **Go to Network tab**
2. **Filter by "XHR" or "Fetch"**
3. **Look for requests to `/api/ai-documentation/jobs/<job-id>`**
4. **Click on the request**
5. **Check the Response**

### What to check:
```json
{
  "id": "...",
  "status": "processing",  // ← Should change
  "total_objects": 2,
  "processed_objects": 0,  // ← Should increment
  "failed_objects": 0,
  "current_object_id": "...",
  "current_object_name": "...",  // ← Should update
  "actual_cost": 0.0023,  // ← Should increase
  "total_tokens_used": 1234  // ← Should increase
}
```

---

## Common Issues & Solutions

### Issue 1: Job Never Starts Processing
**Symptom:** Status stays "queued", backend logs show no processing

**Possible Causes:**
1. ❌ Backend not running
2. ❌ API key not configured
3. ❌ Job creation failed silently

**Solution:**
```bash
# Restart backend
cd backend
npm run dev

# Check API key exists
# Go to Admin → API Keys and verify OpenAI key is configured
```

---

### Issue 2: Job Starts But Never Updates
**Symptom:** Backend logs show processing, but database not updating

**Possible Causes:**
1. ❌ Database RPC functions missing
2. ❌ Permissions issue
3. ❌ Database connection issue

**Solution:**
```sql
-- Check if RPC functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'metadata'
  AND routine_name IN (
    'increment_processed_objects',
    'increment_failed_objects',
    'update_job_status'
  );
```

Should return 3 rows. If not, migration didn't run correctly.

**Re-run migration:**
```bash
cd backend
npx supabase db reset  # WARNING: This resets database!
# OR manually run the migration SQL
```

---

### Issue 3: Frontend Not Polling
**Symptom:** No console logs showing "Job status fetched"

**Possible Causes:**
1. ❌ Polling interval not starting
2. ❌ API request failing
3. ❌ CORS issue

**Check Network Tab:**
- Look for failed requests
- Check for CORS errors
- Verify authentication token

---

### Issue 4: Status Updates But UI Doesn't Reflect
**Symptom:** Console shows correct data, but UI shows 0%

**Possible Causes:**
1. ❌ Property name mismatch
2. ❌ React state not updating
3. ❌ Component not re-rendering

**Already Fixed:**
- ✅ Changed `objects_completed` → `processed_objects`
- ✅ Changed `total_cost` → `actual_cost`
- ✅ Changed `total_tokens` → `total_tokens_used`
- ✅ Changed `current_object` → `current_object_name`
- ✅ Changed `'running'` → `'processing'`

---

## Quick Test Commands

### Test 1: Create a Simple Job
```bash
# In browser console
fetch('/api/ai-documentation/organizations/<org-id>/jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-token>'
  },
  body: JSON.stringify({
    objectIds: ['<object-id>'],
    options: { skipExisting: false }
  })
})
.then(r => r.json())
.then(console.log);
```

### Test 2: Check Job Status
```bash
# In browser console
fetch('/api/ai-documentation/jobs/<job-id>', {
  headers: {
    'Authorization': 'Bearer <your-token>'
  }
})
.then(r => r.json())
.then(console.log);
```

---

## Expected Console Output

### When Working Correctly:

```
[AIDocumentation] Job created: 123e4567-e89b-12d3-a456-426614174000

// After ~500ms
[AIDocumentation] Job status fetched: {
  id: "123e4567-e89b-12d3-a456-426614174000",
  status: "processing",
  total_objects: 2,
  processed_objects: 0,
  current_object_name: "airflow_dag_source",
  actual_cost: 0,
  total_tokens_used: 0
}

// After ~2 seconds
[AIDocumentation] Job status fetched: {
  id: "123e4567-e89b-12d3-a456-426614174000",
  status: "processing",
  total_objects: 2,
  processed_objects: 0,
  current_object_name: "airflow_dag_source",
  actual_cost: 0.0012,
  total_tokens_used: 245
}

// After ~15 seconds (first object done)
[AIDocumentation] Job status fetched: {
  id: "123e4567-e89b-12d3-a456-426614174000",
  status: "processing",
  total_objects: 2,
  processed_objects: 1,  // ← Incremented!
  current_object_name: "airflow_dag_run_source",  // ← Changed!
  actual_cost: 0.0023,  // ← Increased!
  total_tokens_used: 512  // ← Increased!
}

// After ~30 seconds (all done)
[AIDocumentation] Job status fetched: {
  id: "123e4567-e89b-12d3-a456-426614174000",
  status: "completed",  // ← Changed!
  total_objects: 2,
  processed_objects: 2,  // ← All done!
  actual_cost: 0.0045,
  total_tokens_used: 1024
}
```

---

## Next Steps

1. **Refresh browser** (`Cmd+Shift+R`)
2. **Open DevTools Console**
3. **Start a new job**
4. **Share the console output** with me

Also share:
- Backend logs (if available)
- Database query results
- Network tab responses

This will help pinpoint exactly where the issue is! 🔍
