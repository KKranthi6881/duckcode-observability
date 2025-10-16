# Analytics Dashboard Troubleshooting Guide

## Issue: No Data Showing in Dashboard

### Root Causes Identified

1. **Backend Server Issues** ✅ FIXED
   - Old `.js` file conflicting with new `.ts` file
   - TypeScript compilation error in analytics.ts
   - **Solution**: Removed old file, fixed null check

2. **No Conversation Data in Database** ⚠️ NEEDS DATA
   - Dashboard queries `conversation_analytics` table
   - Table is empty because no conversations tracked yet
   - **Solution**: Need to use IDE to generate conversation data

3. **Authentication Required** ✅ WORKING
   - All analytics endpoints require valid JWT token
   - Frontend must be logged in to see data

## Current Status

### Backend ✅
- Server running on http://localhost:3001
- Analytics routes properly registered
- Endpoints responding with 401 (auth required) - correct behavior

### Database Schema ✅
- All migrations applied successfully
- Tables created: `conversation_analytics`, `daily_conversation_stats`, etc.
- Views created: `conversation_analytics_enriched`, `dashboard_summary`

### Frontend ✅
- Dependencies installed: recharts, lucide-react
- Dashboard component created
- Route added: `/dashboard/ide-analytics`

## How to Generate Test Data

### Option 1: Use IDE Extension
1. Open VS Code with DuckCode extension
2. Sign in to your account
3. Start a conversation with AI
4. Send several messages
5. Cost data will be tracked automatically
6. Check backend logs for analytics data

### Option 2: Manual Database Insert (Testing)
```sql
-- Insert test conversation
INSERT INTO duckcode.conversation_analytics (
  user_id,
  conversation_id,
  topic_title,
  model_name,
  provider_name,
  total_tokens_in,
  total_tokens_out,
  total_cache_reads,
  actual_api_cost,
  charged_cost,
  profit_amount,
  profit_margin,
  message_count,
  status
) VALUES (
  'YOUR_USER_ID',
  'test_conv_001',
  'Test Conversation',
  'claude-3-5-sonnet-20241022',
  'anthropic',
  10500,
  2300,
  5200,
  0.02,
  0.04,
  0.02,
  100.00,
  5,
  'completed'
);
```

### Option 3: Test Analytics Endpoint
```bash
# Get your auth token from browser localStorage
# Then test:
curl -X GET http://localhost:3001/api/analytics/dashboard-summary \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Verification Steps

1. **Check Backend Logs**
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
# Look for:
# - "Backend server is running on http://localhost:3001"
# - No TypeScript errors
```

2. **Check Database**
```sql
-- Check if tables exist
SELECT * FROM duckcode.conversation_analytics LIMIT 1;

-- Check materialized view
SELECT * FROM duckcode.dashboard_summary LIMIT 1;
```

3. **Check Frontend**
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/frontend
npm run dev
# Navigate to: http://localhost:5175/dashboard/ide-analytics
```

4. **Check Browser Console**
- Open DevTools → Console
- Look for API calls to `/api/analytics/dashboard-summary`
- Should see 200 response with data (or empty data if no conversations)

## Expected Behavior

### With No Data
```json
{
  "today": { "conversations": 0, "cost": 0, "profit": 0, "tokens": 0 },
  "week": { "conversations": 0, "cost": 0, "profit": 0 },
  "month": { "conversations": 0, "cost": 0, "profit": 0 },
  "total": { "conversations": 0, "cost": 0, "profit": 0, "tokens": 0 },
  "avgCostPer1kTokens": 0,
  "avgCacheEfficiency": 0
}
```

### With Data
```json
{
  "today": { "conversations": 3, "cost": 0.12, "profit": 0.06, "tokens": 45000 },
  "week": { "conversations": 15, "cost": 0.60, "profit": 0.30 },
  "month": { "conversations": 50, "cost": 2.00, "profit": 1.00 },
  "total": { "conversations": 150, "cost": 6.00, "profit": 3.00, "tokens": 675000 },
  "avgCostPer1kTokens": 0.0089,
  "avgCacheEfficiency": 35.5
}
```

## Next Steps

1. **Generate Real Data**: Use IDE extension to create conversations
2. **Verify Flow**: Check that data flows from IDE → Backend → Database
3. **Test Dashboard**: Refresh dashboard to see data appear
4. **Monitor**: Check backend logs for analytics POST requests

## Common Issues

### Issue: "Cannot GET /api/analytics/dashboard-summary"
- **Cause**: Backend not running or routes not loaded
- **Fix**: Restart backend server

### Issue: 401 Unauthorized
- **Cause**: No valid auth token
- **Fix**: Sign in through frontend first

### Issue: Empty dashboard
- **Cause**: No conversation data in database
- **Fix**: Use IDE to generate conversations

### Issue: TypeScript errors
- **Cause**: Compilation issues
- **Fix**: Check backend logs, fix errors, restart

---

**Current Status**: Backend running ✅ | Routes working ✅ | Need conversation data ⚠️
