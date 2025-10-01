# Testing Analytics Dashboard - Step by Step

## Current Status
- ✅ Backend running on http://localhost:3001
- ✅ Database has test data (2 conversations)
- ✅ 2x markup configured in IDE
- ⚠️ Dashboard not loading data

## Debugging Steps

### 1. Check Browser Console
Open the analytics dashboard and check browser console (Cmd+Option+I):

**Expected logs:**
```
🔍 Fetching analytics with token: Present
📊 Dashboard summary response: 200 true
📊 Dashboard summary data: { today: {...}, week: {...} }
✅ Analytics loaded successfully
```

**If you see:**
- `token: Missing` → You need to sign in first
- `response: 401` → Token is invalid or expired
- `response: 404` → Backend routes not registered
- `response: 500` → Backend error, check backend logs

### 2. Verify You're Signed In

```bash
# Open browser console on the dashboard page
localStorage.getItem('token')
# Should return a JWT token string
```

If null, sign in first:
1. Go to http://localhost:5175/login
2. Sign in with your account
3. Then navigate to http://localhost:5175/dashboard/ide-analytics

### 3. Test API Directly

```bash
# Get your token from localStorage (browser console)
TOKEN="your_token_here"

# Test dashboard summary endpoint
curl http://localhost:3001/api/analytics/dashboard-summary \
  -H "Authorization: Bearer $TOKEN"

# Should return JSON with today/week/month stats
```

### 4. Check Backend Logs

Backend should show:
```
GET /api/analytics/dashboard-summary 200 X.XXX ms
GET /api/analytics/conversations?limit=10 200 X.XXX ms
GET /api/analytics/daily-trends?days=30 200 X.XXX ms
GET /api/analytics/model-breakdown 200 X.XXX ms
```

If you see 404 errors, the routes aren't registered.

### 5. Verify Test Data Exists

```bash
# Check Supabase Studio
open http://127.0.0.1:54323

# Navigate to:
# - duckcode schema
# - conversation_analytics table
# - Should see 2 test conversations
```

## Common Issues & Fixes

### Issue: "Dashboard is blank/loading forever"

**Cause**: Not signed in or token missing

**Fix**:
1. Open browser console
2. Check: `localStorage.getItem('token')`
3. If null, go to /login and sign in
4. Return to /dashboard/ide-analytics

### Issue: "401 Unauthorized"

**Cause**: Token expired or invalid

**Fix**:
1. Clear localStorage: `localStorage.clear()`
2. Sign in again
3. Try dashboard again

### Issue: "No data showing"

**Cause**: User ID mismatch - test data has `user_id: "test-user-123"` but you're signed in as different user

**Fix**: Insert data with your actual user ID:
```bash
# Get your user ID from token (decode JWT at jwt.io)
# Or from backend logs when you sign in

cd /Users/Kranthi_1/duck-main/duckcode-observability

# Edit insert-test-data.sh and change user_id to your actual ID
# Then run: ./insert-test-data.sh
```

### Issue: "Backend not receiving requests"

**Cause**: Frontend proxy not configured or backend not running

**Fix**:
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Check frontend vite.config.ts has proxy
# Should proxy /api/* to http://localhost:3001
```

## Quick Test Script

```bash
#!/bin/bash

echo "1. Check backend health..."
curl -s http://localhost:3001/api/health

echo -e "\n2. Check Supabase..."
curl -s http://127.0.0.1:54321/rest/v1/ > /dev/null && echo "✅ Supabase running"

echo -e "\n3. Check test data..."
curl -s "http://127.0.0.1:54321/rest/v1/conversation_analytics?select=count" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Accept-Profile: duckcode"

echo -e "\n4. Test analytics endpoint (needs your token)..."
echo "Get token from browser console: localStorage.getItem('token')"
echo "Then run: curl http://localhost:3001/api/analytics/dashboard-summary -H 'Authorization: Bearer YOUR_TOKEN'"
```

## Expected Working Flow

1. **Sign in** → http://localhost:5175/login
2. **Navigate** → http://localhost:5175/dashboard/ide-analytics
3. **Console shows**:
   ```
   🔍 Fetching analytics with token: Present
   📊 Dashboard summary response: 200 true
   ✅ Analytics loaded successfully
   ```
4. **Backend logs**:
   ```
   GET /api/analytics/dashboard-summary 200
   GET /api/analytics/conversations 200
   ```
5. **Dashboard displays**: Cards with stats, charts, conversation table

## Next Steps

1. Open browser console on dashboard page
2. Check for the debug logs I added
3. Share what you see in console
4. Share any errors from backend logs
5. Verify you're signed in (check localStorage.token)
