# DuckCode Analytics - Quick Start Guide

## Current Status Summary

### ✅ What's Working
1. **Backend**: Running on http://localhost:3001
2. **Supabase**: Running on http://127.0.0.1:54321
3. **Database Schema**: All migrations applied to `duckcode` schema
4. **2x Markup**: Configured in `/Users/Kranthi_1/duck-main/duck-code/src/utils/cost.ts`
5. **Analytics Routes**: Registered at `/api/analytics/*`

### ⚠️ What's Missing
**No conversation data yet** - The system is ready but needs actual IDE usage to generate data.

## Why You're Not Seeing Data

The analytics system has 3 parts:
1. **IDE Extension** (duck-code) - Captures costs with 2x markup ✅
2. **Backend API** (duckcode-observability/backend) - Receives and stores data ✅
3. **Database** (Supabase duckcode schema) - Stores conversation analytics ✅

**The issue**: You need to actually use the IDE extension to generate conversations.

## How to Generate Test Data

### Option 1: Use the IDE Extension (Recommended)

```bash
# 1. Compile the extension
cd /Users/Kranthi_1/duck-main/duck-code
npm run compile

# 2. Open VS Code
# 3. Press F5 to start Extension Development Host
# 4. In the new window, start a conversation with AI
# 5. Send several messages
# 6. Check browser console (Cmd+Option+I) for analytics logs
```

**What to look for in console:**
```
📊 ChatView: Starting conversation
📊 ChatView: Sending final metrics
🔍 DEBUG: Sending analytics to backend
```

### Option 2: Insert Test Data Directly

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability

# Connect to Supabase (use REST API to avoid SSL issues)
curl -X POST http://127.0.0.1:54321/rest/v1/conversation_analytics \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "user_id": "test-user-123",
    "conversation_id": "test-conv-001",
    "topic_title": "Test Conversation",
    "model_name": "claude-3-5-sonnet-20241022",
    "provider_name": "anthropic",
    "total_tokens_in": 10500,
    "total_tokens_out": 2300,
    "total_cache_reads": 5200,
    "actual_api_cost": 0.02,
    "charged_cost": 0.04,
    "profit_amount": 0.02,
    "profit_margin": 100.00,
    "message_count": 5,
    "status": "completed"
  }'
```

### Option 3: Use Supabase Studio

```bash
# 1. Open Supabase Studio
open http://127.0.0.1:54323

# 2. Navigate to Table Editor
# 3. Select "duckcode" schema
# 4. Select "conversation_analytics" table
# 5. Click "Insert row"
# 6. Fill in the data
```

## Verify Data is Flowing

### Check Database
```bash
# Using Supabase REST API
curl http://127.0.0.1:54321/rest/v1/conversation_analytics \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

### Check Backend API
```bash
# Get dashboard summary (requires auth)
curl http://localhost:3001/api/analytics/dashboard-summary \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Frontend Dashboard
```bash
# 1. Start frontend
cd /Users/Kranthi_1/duck-main/duckcode-observability/frontend
npm run dev

# 2. Open browser
open http://localhost:5175

# 3. Sign in

# 4. Navigate to
open http://localhost:5175/dashboard/ide-analytics
```

## Verify 2x Markup is Working

### In IDE
1. Start a conversation
2. Look at the cost badge in TaskHeader
3. Cost should be 2x the actual API cost

### In Console
```javascript
// Browser console should show:
{
  totalCost: 0.04,        // This is charged cost (2x)
  actualApiCost: 0.02     // This is actual cost
}
```

### In Database
```bash
# Check the data
curl http://127.0.0.1:54321/rest/v1/conversation_analytics?select=actual_api_cost,charged_cost,profit_amount \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Should return:
# actual_api_cost: 0.02
# charged_cost: 0.04
# profit_amount: 0.02
```

## Common Issues

### "No data in dashboard"
→ You haven't used the IDE yet. Follow Option 1 or 2 above.

### "Cost not showing 2x"
→ Recompile extension: `cd duck-code && npm run compile`
→ Reload Extension Development Host (Cmd+R)

### "Backend 404 error"
→ Backend is running but routes not loaded
→ Restart: `cd backend && npm run dev`

### "Cannot connect to Supabase"
→ Check status: `supabase status`
→ Restart: `supabase stop && supabase start`

## Next Steps

1. **Generate Data**: Use the IDE to create conversations
2. **Verify Flow**: Check console logs for analytics messages
3. **Check Dashboard**: View data at http://localhost:5175/dashboard/ide-analytics
4. **Verify Markup**: Confirm costs show 2x value

## Support Files

- **Debug Guide**: `/Users/Kranthi_1/duck-main/DEBUG_ANALYTICS_FLOW.md`
- **Implementation Summary**: `/Users/Kranthi_1/duck-main/ANALYTICS_IMPLEMENTATION_SUMMARY.md`
- **Troubleshooting**: `/Users/Kranthi_1/duck-main/ANALYTICS_TROUBLESHOOTING.md`

---

**TL;DR**: Everything is set up correctly. You just need to use the IDE extension to generate conversation data. The 2x markup is configured and ready to work.
