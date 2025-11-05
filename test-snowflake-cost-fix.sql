-- Test Snowflake Cost Extraction Fix
-- Verify column names match what we expect

-- 1. Test TABLE_STORAGE_METRICS schema
SELECT 
  TABLE_CATALOG,
  TABLE_SCHEMA,
  TABLE_NAME,
  ACTIVE_BYTES,
  TIME_TRAVEL_BYTES,
  FAILSAFE_BYTES,
  IS_TRANSIENT,
  TABLE_CREATED,
  TABLE_DROPPED
FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
WHERE DELETED = FALSE
  AND ACTIVE_BYTES > 0
  AND TABLE_CATALOG IS NOT NULL
LIMIT 1;

-- Expected: All column names in UPPERCASE
-- IS_TRANSIENT should be 'YES' or 'NO' (not boolean)

-- 2. Test WAREHOUSE_METERING_HISTORY schema
SELECT 
  WAREHOUSE_NAME,
  CREDITS_USED_COMPUTE,
  CREDITS_USED_CLOUD_SERVICES,
  START_TIME
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
LIMIT 1;

-- Expected: All column names in UPPERCASE

-- 3. Test QUERY_HISTORY schema
SELECT 
  WAREHOUSE_NAME,
  TOTAL_ELAPSED_TIME,
  CREDITS_USED_CLOUD_SERVICES,  -- Only cloud services credits available here
  START_TIME
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
LIMIT 1;

-- Expected: All column names in UPPERCASE
-- NOTE: CREDITS_USED_COMPUTE is NOT in QUERY_HISTORY!
-- Use WAREHOUSE_METERING_HISTORY for compute credits

-- 4. Verify our database schema (PostgreSQL)
-- Run this on the Supabase database to verify schema
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'enterprise'
  AND table_name = 'snowflake_storage_usage'
ORDER BY ordinal_position;

-- Expected: All column names in lowercase
-- database_name should be NOT NULL
