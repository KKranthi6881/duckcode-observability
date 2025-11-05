-- Quick Test Script: Add $31 Cost Data
-- Run this in Supabase SQL Editor after migration

-- Step 1: Get your connector ID
SELECT id, name, snowflake_account 
FROM enterprise.connectors
ORDER BY created_at DESC
LIMIT 5;

-- Copy the connector ID from above, then replace in queries below

-- Step 2: Add $31 cost for today
SELECT enterprise.upsert_daily_cost(
    'YOUR_CONNECTOR_ID_HERE'::UUID,  -- ⚠️ REPLACE THIS
    CURRENT_DATE,
    31.00,
    1500
);

-- Step 3: Verify it was added
SELECT 
    usage_date,
    total_cost,
    total_credits,
    total_queries
FROM enterprise.snowflake_daily_costs
WHERE connector_id = 'YOUR_CONNECTOR_ID_HERE'::UUID  -- ⚠️ REPLACE THIS
ORDER BY usage_date DESC;

-- Step 4: Add more historical data for better trending (optional)
SELECT enterprise.upsert_daily_cost(
    'YOUR_CONNECTOR_ID_HERE'::UUID,  -- ⚠️ REPLACE THIS
    CURRENT_DATE - 1,
    15.00,
    800
);

SELECT enterprise.upsert_daily_cost(
    'YOUR_CONNECTOR_ID_HERE'::UUID,  -- ⚠️ REPLACE THIS
    CURRENT_DATE - 2,
    12.00,
    600
);

SELECT enterprise.upsert_daily_cost(
    'YOUR_CONNECTOR_ID_HERE'::UUID,  -- ⚠️ REPLACE THIS
    CURRENT_DATE - 3,
    18.00,
    950
);

-- Step 5: Verify total monthly spend
SELECT 
    SUM(total_cost) as total_monthly_cost,
    COUNT(*) as days_with_data,
    AVG(total_cost) as avg_daily_cost
FROM enterprise.snowflake_daily_costs
WHERE connector_id = 'YOUR_CONNECTOR_ID_HERE'::UUID  -- ⚠️ REPLACE THIS
  AND usage_date >= DATE_TRUNC('month', CURRENT_DATE())
  AND usage_date <= CURRENT_DATE;

-- Expected result: total_monthly_cost = 76.00 (31+15+12+18)
-- With just today: 31.00

-- ✅ Now refresh your budget page!
-- It should show: $31.00 / $40.00 (77.5%)
