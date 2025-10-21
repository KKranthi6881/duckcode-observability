# Testing Docker-Based Automatic Extraction

## ✅ Setup Complete

- ✅ Backend running on port 3001
- ✅ Docker image `dbt-runner:latest` built
- ✅ Routes registered in frontend
- ✅ All services initialized

---

## 🧪 How to Test the Complete Flow

### Step 1: Access the New UI

Open your browser and navigate to:
```
http://localhost:5173/metadata/connections
```

**What you'll see:**
- Repository connections grid
- "Connect Repository" button
- Existing connections (if any)

### Step 2: Connect a dbt Repository

1. Click "Connect Repository" button
2. Fill in the form:
   - **Repository URL:** `https://github.com/owner/repo`
   - **Branch:** `main` (or `master`)
   - **GitHub Token:** Your personal access token

3. Click "Save"

### Step 3: Trigger Extraction

**Option A: From Connections List**
1. Find your connection card
2. Click the **"Extract"** button
3. You'll be redirected to the extraction progress page

**Option B: Direct Navigation**
```
http://localhost:5173/metadata/connections/YOUR_CONNECTION_ID/extract
```

### Step 4: Watch Real-Time Progress

You'll see a live progress UI showing:

```
┌────────────────────────────────────┐
│ 🔧 Running dbt parse               │
│ Parsing manifest...                │
│                                    │
│ Progress: ████████░░ 60%           │
│                                    │
│ ✓ Queued                           │
│ ✓ Cloning repository               │
│ ✓ Installing dbt dependencies      │
│ • Running dbt parse ⟳              │
│ ○ Storing metadata in database     │
│ ○ Extraction completed             │
└────────────────────────────────────┘
```

### Step 5: Check Backend Logs

Watch for these messages in your backend terminal:

```
🚀 Triggering extraction for connection: abc-123
📦 Cloning repository: https://github.com/owner/repo
✅ Repository cloned successfully
🐳 Running dbt parse in Docker container...
   Docker command: docker run --rm -v /tmp/repo:/project...
✅ dbt parse completed in Docker
📊 Manifest generated successfully
   Models: 45
   Sources: 12
   Duration: 45000ms
✅ Extraction completed
```

### Step 6: Check Docker (Optional)

**Docker containers are ephemeral** (they run and exit immediately), but you can see them while running:

```bash
# In another terminal, watch for Docker activity
watch -n 0.5 'docker ps -a | grep dbt-runner'

# Or check Docker events
docker events --filter 'image=dbt-runner:latest'
```

**You'll see:**
```
CONTAINER_ID   IMAGE               COMMAND           STATUS
abc123         dbt-runner:latest   "sh -c cd..."     Exited (0)
```

### Step 7: Verify Data in Database

Check that manifest data was stored:

```sql
-- Check connections
SELECT id, repository_name, manifest_uploaded, total_objects
FROM github_connections;

-- Check objects (models)
SELECT id, name, object_type, full_name
FROM metadata.objects
WHERE connection_id = 'YOUR_CONNECTION_ID';

-- Check dependencies
SELECT so.name AS source, to_.name AS target
FROM metadata.dependencies d
JOIN metadata.objects so ON d.source_object_id = so.id
JOIN metadata.objects to_ ON d.target_object_id = to_.id
WHERE d.connection_id = 'YOUR_CONNECTION_ID';
```

---

## 🐛 Troubleshooting

### Issue: "Connection not found"

**Cause:** Connection ID doesn't exist or you're not authorized

**Solution:**
```bash
# List all connections
curl http://localhost:3001/api/admin/metadata/connections \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Issue: No extraction logs in backend

**Cause:** Extraction endpoint not being called

**Check:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Trigger extraction
4. Look for POST request to `/api/metadata/connections/:id/extract`

**Expected response:** `202 Accepted`

### Issue: Docker image not found

**Cause:** Docker image not built or wrong name

**Solution:**
```bash
# Check image exists
docker images | grep dbt-runner

# If missing, build it
cd backend
docker build -f Dockerfile.dbt -t dbt-runner:latest .
```

### Issue: Extraction fails

**Check backend logs for:**
- Git clone errors (auth token invalid?)
- Docker errors (Docker not running?)
- dbt errors (invalid dbt_project.yml?)

**Enable verbose logging:**
```typescript
// In DbtRunner.ts, check for error messages
console.error(`❌ dbt parse failed:`, error.message);
```

---

## 📊 Testing Checklist

### Frontend
- [ ] Navigate to `/metadata/connections`
- [ ] See connections list page
- [ ] Click "Connect Repository"
- [ ] Fill form and save
- [ ] See new connection card
- [ ] Click "Extract" button
- [ ] Redirected to `/metadata/connections/:id/extract`
- [ ] See real-time progress UI
- [ ] Progress updates every 2 seconds
- [ ] Phase checklist shows current step
- [ ] Progress bar animates
- [ ] Success message on completion

### Backend
- [ ] Extraction endpoint called: `POST /api/metadata/connections/:id/extract`
- [ ] Returns `202 Accepted` immediately
- [ ] Backend logs show: "Triggering extraction"
- [ ] Backend logs show: "Cloning repository"
- [ ] Backend logs show: "Running dbt parse in Docker"
- [ ] Docker command executes
- [ ] Manifest extracted successfully
- [ ] Data stored in database
- [ ] Cleanup completes

### Docker
- [ ] Docker image exists: `dbt-runner:latest`
- [ ] Image has dbt installed: `docker run --rm dbt-runner dbt --version`
- [ ] Container runs during extraction
- [ ] Container exits after completion
- [ ] No orphaned containers: `docker ps -a | grep dbt-runner`

### Database
- [ ] Connection status updated to "extracting"
- [ ] Manifest_uploaded set to true on success
- [ ] Total_objects populated
- [ ] Objects table has models
- [ ] Dependencies table has lineage
- [ ] Column_lineage table has column-level lineage (if available)

---

## 🎯 Expected Behavior

### Successful Extraction Flow

```
1. User clicks "Extract" button
   ↓
2. Frontend: POST /api/metadata/connections/:id/extract
   ↓
3. Backend: Returns 202 Accepted (extraction queued)
   ↓
4. Backend: Starts async extraction
   ↓
5. Frontend: Redirects to progress page
   ↓
6. Frontend: Polls GET /api/metadata/connections/:id/progress every 2s
   ↓
7. Backend: Updates progress in real-time
   • phase: "cloning", progress: 10%
   • phase: "installing_deps", progress: 30%
   • phase: "parsing", progress: 60%
   • phase: "storing", progress: 80%
   • phase: "completed", progress: 100%
   ↓
8. Docker: Runs ephemeral container
   • Clones repo to /tmp
   • Mounts /tmp/repo to /project
   • Runs: dbt deps && dbt parse
   • Generates target/manifest.json
   • Exits and self-destructs (--rm flag)
   ↓
9. Backend: Parses manifest.json
   • Extracts models
   • Extracts sources
   • Extracts dependencies
   • Stores in PostgreSQL
   ↓
10. Backend: Cleanup
   • Deletes /tmp/repo-*
   • Clears progress tracking
   • Updates connection status
   ↓
11. Frontend: Shows completion
   • Success message
   • Statistics (models, sources)
   • "View Lineage" button
```

### Timing

- **Small project (10 models):** 30-60 seconds
- **Medium project (50 models):** 1-2 minutes
- **Large project (200+ models):** 2-3 minutes

---

## 🔍 Manual API Testing

### Test extraction endpoint

```bash
# Get your connection ID
curl http://localhost:3001/api/admin/metadata/connections \
  -H "Authorization: Bearer YOUR_TOKEN" | jq

# Trigger extraction
curl -X POST http://localhost:3001/api/metadata/connections/YOUR_CONNECTION_ID/extract \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
{
  "success": true,
  "message": "Extraction started",
  "connectionId": "abc-123",
  "status": "extracting"
}
```

### Check progress

```bash
# Poll progress
curl http://localhost:3001/api/metadata/connections/YOUR_CONNECTION_ID/progress \
  -H "Authorization: Bearer YOUR_TOKEN" | jq

# Expected response:
{
  "connectionId": "abc-123",
  "phase": "parsing",
  "progress": 60,
  "message": "Running dbt parse...",
  "startTime": "2025-10-20T14:00:00Z",
  "errors": []
}
```

### Check active extractions

```bash
curl http://localhost:3001/api/metadata/extractions/active \
  -H "Authorization: Bearer YOUR_TOKEN" | jq

# Expected response:
{
  "count": 1,
  "extractions": [
    {
      "connectionId": "abc-123",
      "phase": "parsing",
      "progress": 60
    }
  ]
}
```

---

## 🚀 Quick Test Script

Save this as `test-extraction.sh`:

```bash
#!/bin/bash

# Configuration
API_URL="http://localhost:3001"
TOKEN="YOUR_ACCESS_TOKEN"
CONNECTION_ID="YOUR_CONNECTION_ID"

echo "🧪 Testing Docker-based automatic extraction..."

# 1. Trigger extraction
echo "1️⃣ Triggering extraction..."
RESPONSE=$(curl -s -X POST "$API_URL/api/metadata/connections/$CONNECTION_ID/extract" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")
echo "$RESPONSE" | jq

# 2. Poll progress every 5 seconds
echo ""
echo "2️⃣ Polling progress..."
while true; do
  PROGRESS=$(curl -s "$API_URL/api/metadata/connections/$CONNECTION_ID/progress" \
    -H "Authorization: Bearer $TOKEN")
  
  PHASE=$(echo "$PROGRESS" | jq -r '.phase')
  PERCENT=$(echo "$PROGRESS" | jq -r '.progress')
  MESSAGE=$(echo "$PROGRESS" | jq -r '.message')
  
  echo "[$PHASE] $PERCENT% - $MESSAGE"
  
  if [ "$PHASE" = "completed" ] || [ "$PHASE" = "failed" ]; then
    break
  fi
  
  sleep 5
done

# 3. Show final result
echo ""
echo "3️⃣ Final result:"
echo "$PROGRESS" | jq

# 4. Check data
echo ""
echo "4️⃣ Checking database..."
curl -s "$API_URL/api/metadata/connections/$CONNECTION_ID/stats" \
  -H "Authorization: Bearer $TOKEN" | jq

echo ""
echo "✅ Test complete!"
```

**Run it:**
```bash
chmod +x test-extraction.sh
./test-extraction.sh
```

---

## 📝 Summary

**To test the complete Docker-based extraction:**

1. ✅ Navigate to `http://localhost:5173/metadata/connections`
2. ✅ Click "Extract" on any connection
3. ✅ Watch real-time progress
4. ✅ Check backend logs for Docker activity
5. ✅ Verify data in database

**The Docker container runs automatically - you don't manually run it!**

Backend handles everything:
- Cloning repo
- Running Docker with dbt
- Extracting manifest
- Storing data
- Cleanup

**All you do:** Click "Extract" and watch it work! 🚀
