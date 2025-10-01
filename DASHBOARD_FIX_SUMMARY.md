# Analytics Dashboard - Token Authentication Fix

## Problem Identified

The dashboard was showing a white screen with error: `TypeError: undefined is not an object (evaluating 'stats?.today.cost')`

**Root Causes**:
1. Token was "Missing" - using `localStorage.getItem('token')` but auth system uses Supabase session
2. All API calls returned 401 Unauthorized
3. No null check for stats causing crash when data failed to load

## Fixes Applied

### 1. Fixed Token Retrieval
**Before**:
```typescript
const token = localStorage.getItem('token');
```

**After**:
```typescript
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

### 2. Added Null Check
Added safety check to prevent crash when no data:
```typescript
if (!stats) {
  return (
    <div>No analytics data available</div>
  );
}
```

### 3. Fixed Import Path
```typescript
import { supabase } from '@/config/supabaseClient';
```

## How to Test

1. **Refresh the dashboard**: http://localhost:5175/dashboard/ide-analytics

2. **Check browser console** - should now see:
```
🔍 Fetching analytics with token: Present Length: 719
📊 Dashboard summary response: 200 true
✅ Analytics loaded successfully
```

3. **Dashboard should display**:
   - Today's revenue: $0.126
   - 2 conversations
   - Profit: $0.063
   - Conversation table with 2x markup data

## Expected Backend Logs

```
GET /api/analytics/dashboard-summary 200 X.XXX ms
GET /api/analytics/conversations?limit=10 200 X.XXX ms
GET /api/analytics/daily-trends?days=30 200 X.XXX ms
GET /api/analytics/model-breakdown 200 X.XXX ms
```

## If Still Not Working

### Check 1: Verify you're signed in
```javascript
// Browser console
localStorage.getItem('sb-127.0.0.1:54321-auth-token')
// Should return a session object
```

### Check 2: Test backend directly
```bash
# Get session token from browser
# Then test:
curl http://localhost:3001/api/analytics/dashboard-summary \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

### Check 3: Verify test data exists
```bash
curl -s "http://127.0.0.1:54321/rest/v1/conversation_analytics?select=count&user_id=eq.1bd5a3fe-bbd7-4a61-85d1-06c6f1d4956f" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Accept-Profile: duckcode"

# Should return: [{"count":2}]
```

## Files Modified

- `frontend/src/pages/AnalyticsDashboard.tsx` - Fixed token retrieval and added null checks

## Status

✅ Token authentication fixed  
✅ Null safety added  
✅ Import path corrected  
⏳ Waiting for page refresh to test

The dashboard should now load properly with your Supabase session token and display the 2 test conversations with 2x markup data.
