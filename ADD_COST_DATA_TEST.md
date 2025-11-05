# Adding Cost Data for Budget Testing

## Quick Test: Add $31 Cost Data

Once the backend is running, use this curl command to add cost data:

```bash
# Replace with your actual values:
# - CONNECTOR_ID: Your Snowflake connector ID (from the UI)
# - JWT_TOKEN: Your authentication token (from browser dev tools)

curl -X POST "http://localhost:3002/api/connectors/YOUR_CONNECTOR_ID/costs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "usage_date": "2024-11-05",
    "total_cost": 31,
    "total_queries": 1500
  }'
```

## Alternative: Direct SQL (Run in Supabase SQL Editor)

```sql
-- Step 1: Get your connector ID
SELECT id, name FROM enterprise.connectors;

-- Step 2: Add cost data (replace the connector_id)
SELECT enterprise.upsert_daily_cost(
    'YOUR_CONNECTOR_ID'::UUID,  -- Replace with actual connector ID
    CURRENT_DATE,                 -- Today's date
    31.00,                        -- $31 cost
    1500                          -- 1500 queries (optional)
);

-- Step 3: Verify data was inserted
SELECT * FROM enterprise.snowflake_daily_costs
ORDER BY usage_date DESC
LIMIT 5;

-- Step 4: Add more historical data (for better trending)
SELECT enterprise.upsert_daily_cost(
    'YOUR_CONNECTOR_ID'::UUID,
    CURRENT_DATE - INTERVAL '1 day',
    15.00,
    800
);

SELECT enterprise.upsert_daily_cost(
    'YOUR_CONNECTOR_ID'::UUID,
    CURRENT_DATE - INTERVAL '2 days',
    12.00,
    600
);

SELECT enterprise.upsert_daily_cost(
    'YOUR_CONNECTOR_ID'::UUID,
    CURRENT_DATE - INTERVAL '3 days',
    18.00,
    950
);
```

## How This Works

1. **Migration Created Tables:**
   - `enterprise.snowflake_daily_costs` - Stores daily cost data
   - `enterprise.snowflake_warehouse_metrics` - Stores warehouse-specific metrics

2. **Function `get_budget_current_spend`:**
   - Queries `snowflake_daily_costs` table
   - Sums costs for the current budget period
   - Returns total spend

3. **Budget Display:**
   - Frontend calls `/api/connectors/:id/budgets/:budgetId/spend`
   - Backend calls `get_budget_current_spend()` function
   - Returns current spend vs budget amount
   - Calculates percentage and remaining budget

## Expected Result

After adding the $31 cost data:

- ✅ Budget shows: **$31.00 / $40.00 spent** (77.5%)
- ✅ Progress bar shows 77.5% filled
- ✅ Remaining budget: **$8.50**
- ✅ Alert threshold indicators appear (if over 75%)

## Full Flow to Test

### 1. Get Your Connector ID

In browser dev tools (Console tab):
```javascript
// Navigate to the Budgets page, then run:
console.log(window.location.pathname);
// Copy the connector ID from URL
```

### 2. Get Your JWT Token

In browser dev tools (Application tab):
- Go to Local Storage
- Find key with "supabase"
- Copy the access_token value

### 3. Add Cost Data via API

```bash
export CONNECTOR_ID="99cf25f5-77fe-44bc-b1ec-4d194bb40881"  # Your ID
export JWT_TOKEN="eyJhbGc..."  # Your token

curl -X POST "http://localhost:3002/api/connectors/$CONNECTOR_ID/costs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{
    "usage_date": "2024-11-05",
    "total_cost": 31,
    "total_queries": 1500
  }'
```

### 4. Refresh Budget Page

- Go back to browser
- Click on Budgets tab
- You should now see **$31.00 / $40.00** (77.5%)

## Future: Auto-Sync from Snowflake

The system is designed to eventually sync automatically from Snowflake:

1. Run Snowflake queries (from `SNOWFLAKE_BUDGET_SECURITY_EXTRACTION.sql`)
2. Extract daily cost data
3. POST to `/api/connectors/:id/costs/bulk` endpoint
4. Budget calculations update automatically

For now, you can manually add cost data for testing!
