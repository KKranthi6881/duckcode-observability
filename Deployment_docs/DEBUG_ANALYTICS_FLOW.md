# Analytics Flow Debugging Guide

## Problem: 2x Markup Not Showing & No Data in Supabase

### Issue 1: Cost Not Showing 2x Markup

**Where to Check:**
1. **IDE Display** - Look at TaskHeader.tsx cost display
2. **Console Logs** - Check browser console for cost calculations
3. **Backend Logs** - Verify what cost values are being sent

**Test Steps:**
```bash
# 1. Open VS Code Extension Development Host
# 2. Open browser console (Cmd+Option+I)
# 3. Start a conversation
# 4. Look for these logs:
#    - "📊 ChatView: Sending final metrics"
#    - Cost values in the metrics
```

**Expected vs Actual:**
- Expected: Cost should be 2x the actual API cost
- Check: Look at TaskHeader badge showing cost
- Verify: Console should show `totalCost` with 2x value

### Issue 2: No Data in Supabase

**Root Causes to Check:**

#### A. Analytics Not Being Sent from IDE
```typescript
// Check ChatView.tsx line 543
await chatAnalyticsService.startConversation(...)

// Check ChatView.tsx line 385
chatAnalyticsService.updateConversation(...)
```

**Debug Steps:**
1. Add console.log in chatAnalyticsService.ts
2. Check if `startConversation` is called
3. Check if `updateConversation` is called with final metrics
4. Verify vscode.postMessage is being called

#### B. WebviewMessageHandler Not Forwarding
```typescript
// Check WebviewMessageHandler.ts line 2526
case "chatAnalytics": {
    await cloudService.sendChatAnalytics(...)
}
```

**Debug Steps:**
1. Check extension host console for analytics messages
2. Verify CloudService.sendChatAnalytics is called
3. Check network requests to backend

#### C. Backend Not Receiving
```bash
# Check backend logs for:
POST /api/analytics/conversation/start
POST /api/analytics/conversation/update
```

**Debug Steps:**
1. Backend should log incoming requests
2. Check for 401 errors (auth issues)
3. Check for 500 errors (server issues)

#### D. Supabase Connection Issues
```bash
# Test Supabase connection
curl http://127.0.0.1:54321/rest/v1/conversation_analytics \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Quick Fix Checklist

### 1. Verify Extension is Compiled
```bash
cd /Users/Kranthi_1/duck-main/duck-code
npm run compile
# Press F5 to reload Extension Development Host
```

### 2. Check Backend is Running
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
lsof -ti:3001 | xargs kill -9  # Kill existing
npm run dev                     # Start fresh
```

### 3. Verify Supabase is Running
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability
supabase status
# Should show: API URL: http://127.0.0.1:54321
```

### 4. Test Data Flow Manually

**Insert Test Data:**
```sql
-- Connect to Supabase
psql "postgresql://postgres:postgres@127.0.0.1:54321/postgres?sslmode=disable"

-- Insert test conversation
INSERT INTO duckcode.conversation_analytics (
  user_id, conversation_id, topic_title, model_name,
  total_tokens_in, total_tokens_out, total_cache_reads,
  actual_api_cost, charged_cost, profit_amount, profit_margin,
  message_count, status
) VALUES (
  'test-user-123', 
  'test-conv-001', 
  'Test Conversation', 
  'claude-3-5-sonnet-20241022',
  10500, 2300, 5200,
  0.02, 0.04, 0.02, 100.00,
  5, 'completed'
);

-- Verify insert
SELECT * FROM duckcode.conversation_analytics;

-- Check dashboard summary
SELECT * FROM duckcode.dashboard_summary;
```

### 5. Enable Debug Logging

**Add to ChatView.tsx (line 543):**
```typescript
console.log("🔍 DEBUG: Starting conversation", {
  modelInfo,
  topicTitle,
  providerName,
  modeName
});
await chatAnalyticsService.startConversation(modelInfo, topicTitle, providerName, modeName)
console.log("✅ DEBUG: Conversation started successfully");
```

**Add to chatAnalyticsService.ts (line 137):**
```typescript
console.log("🔍 DEBUG: Updating conversation with metrics", {
  conversationId: this.currentSession.conversationId,
  chargedCost,
  actualApiCost,
  metrics
});
```

**Add to DuckCodeCloudService.ts (line 113):**
```typescript
console.log("🔍 DEBUG: Sending analytics to backend", {
  endpoint,
  payload
});
const response = await fetch(endpoint, {...});
console.log("🔍 DEBUG: Backend response", {
  status: response.status,
  ok: response.ok
});
```

## Testing the Complete Flow

### Step 1: Start Everything
```bash
# Terminal 1: Backend
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
npm run dev

# Terminal 2: Frontend
cd /Users/Kranthi_1/duck-main/duckcode-observability/frontend
npm run dev

# Terminal 3: Supabase
cd /Users/Kranthi_1/duck-main/duckcode-observability
supabase start
```

### Step 2: Test IDE Extension
1. Open VS Code
2. Press F5 (Extension Development Host)
3. Open browser console (Cmd+Option+I)
4. Start a conversation
5. Send a message
6. Watch console logs

### Step 3: Verify Data Flow
```bash
# Check backend received data
curl http://localhost:3001/api/analytics/conversations \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check Supabase has data
psql "postgresql://postgres:postgres@127.0.0.1:54321/postgres?sslmode=disable" \
  -c "SELECT COUNT(*) FROM duckcode.conversation_analytics;"
```

### Step 4: Check Dashboard
1. Open http://localhost:5175
2. Sign in
3. Navigate to /dashboard/ide-analytics
4. Should see data

## Common Issues & Solutions

### Issue: "Port 3001 already in use"
```bash
lsof -ti:3001 | xargs kill -9
npm run dev
```

### Issue: "Cannot connect to Supabase"
```bash
supabase stop
supabase start
```

### Issue: "401 Unauthorized"
- Sign in through frontend first
- Check localStorage for auth token
- Verify JWT_SECRET in backend .env

### Issue: "Cost not showing 2x"
- Recompile extension: `npm run compile`
- Reload Extension Development Host
- Check cost.ts has PROFIT_MARKUP = 2.0

### Issue: "No data in tables"
- Check backend logs for POST requests
- Verify auth token is being sent
- Check Supabase logs: `supabase logs`

## Success Indicators

✅ Backend logs show: "Backend server is running on http://localhost:3001"
✅ Console shows: "✅ DEBUG: Conversation started successfully"
✅ Console shows: "🔍 DEBUG: Backend response { status: 200, ok: true }"
✅ Supabase query returns: count > 0
✅ Dashboard displays conversation data
✅ Cost shows 2x value (e.g., $0.04 instead of $0.02)

## Next Steps

1. Follow Step 1-4 above
2. Add debug logging if needed
3. Check each layer of the stack
4. Report which layer is failing
