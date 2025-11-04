-- ============================================
-- ALL BACKEND SQL QUERIES FOR SNOWFLAKE
-- Please run each query in your Snowflake and provide corrections
-- ============================================

-- ============================================
-- FILE: SnowflakeConnector.ts
-- ============================================

-- ---------------------------------------------
-- QUERY 1: extractCostMetrics() - Compute Credits
-- Line: ~496
-- Purpose: Get total compute credits for last 30 days
-- ---------------------------------------------
SELECT 
  COALESCE(SUM(CREDITS_USED_COMPUTE + CREDITS_USED_CLOUD_SERVICES), 0) AS TOTAL_CREDITS
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE START_TIME >= '2025-10-05 00:00:00';  -- Replace with actual date

-- Expected columns in result: TOTAL_CREDITS (NUMBER)


-- ---------------------------------------------
-- QUERY 2: extractCostMetrics() - Storage Costs
-- Line: ~504
-- Purpose: Get average storage bytes for last 30 days
-- ---------------------------------------------
SELECT 
  AVG(STORAGE_BYTES + STAGE_BYTES + FAILSAFE_BYTES) AS AVG_BYTES
FROM SNOWFLAKE.ACCOUNT_USAGE.STORAGE_USAGE
WHERE USAGE_DATE >= DATEADD(day, -30, CURRENT_DATE());

-- Expected columns in result: AVG_BYTES (NUMBER)


-- ---------------------------------------------
-- QUERY 3: extractStorageData()
-- Line: ~525
-- Purpose: Get storage metrics for all tables
-- ---------------------------------------------
SELECT 
  TABLE_CATALOG,
  TABLE_SCHEMA,
  TABLE_NAME,
  ACTIVE_BYTES,
  TIME_TRAVEL_BYTES,
  FAILSAFE_BYTES,
  RETAINED_FOR_CLONE_BYTES,
  IS_TRANSIENT,
  TABLE_CREATED,
  TABLE_DROPPED
FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
WHERE DELETED = FALSE
  AND ACTIVE_BYTES > 0
  AND TABLE_CATALOG IS NOT NULL
  AND TABLE_SCHEMA IS NOT NULL
  AND TABLE_NAME IS NOT NULL
ORDER BY ACTIVE_BYTES DESC NULLS LAST
LIMIT 1000;

-- Expected columns in result:
-- TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, ACTIVE_BYTES, TIME_TRAVEL_BYTES,
-- FAILSAFE_BYTES, RETAINED_FOR_CLONE_BYTES, IS_TRANSIENT, TABLE_CREATED, TABLE_DROPPED


-- ---------------------------------------------
-- QUERY 4: extractWarehouseMetrics() - FIXED VERSION ✅
-- Line: ~577
-- Purpose: Get warehouse query stats and credit usage
-- Fix: Separated window function from GROUP BY to avoid START_TIME conflict
-- ---------------------------------------------
WITH query_aggregates AS (
  SELECT 
    WAREHOUSE_NAME,
    COUNT(*) AS TOTAL_QUERIES,
    SUM(TOTAL_ELAPSED_TIME) AS TOTAL_EXECUTION_TIME_MS
  FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
  WHERE START_TIME >= '2025-10-28 00:00:00'  -- Last 7 days
    AND WAREHOUSE_NAME IS NOT NULL
  GROUP BY WAREHOUSE_NAME
),
warehouse_sizes AS (
  SELECT DISTINCT
    WAREHOUSE_NAME,
    FIRST_VALUE(WAREHOUSE_SIZE) OVER (PARTITION BY WAREHOUSE_NAME ORDER BY START_TIME DESC) AS WAREHOUSE_SIZE
  FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
  WHERE START_TIME >= '2025-10-28 00:00:00'  -- Last 7 days
    AND WAREHOUSE_NAME IS NOT NULL
),
credit_usage AS (
  SELECT 
    WAREHOUSE_NAME,
    SUM(CREDITS_USED_COMPUTE + CREDITS_USED_CLOUD_SERVICES) AS CREDITS_USED
  FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
  WHERE START_TIME >= '2025-10-28 00:00:00'  -- Last 7 days
  GROUP BY WAREHOUSE_NAME
)
SELECT 
  COALESCE(qa.WAREHOUSE_NAME, cu.WAREHOUSE_NAME) AS WAREHOUSE_NAME,
  COALESCE(qa.TOTAL_QUERIES, 0) AS TOTAL_QUERIES,
  COALESCE(qa.TOTAL_EXECUTION_TIME_MS, 0) AS TOTAL_EXECUTION_TIME_MS,
  COALESCE(cu.CREDITS_USED, 0) AS CREDITS_USED,
  NULL AS UTILIZATION_PERCENT,
  ws.WAREHOUSE_SIZE
FROM query_aggregates qa
FULL OUTER JOIN credit_usage cu ON qa.WAREHOUSE_NAME = cu.WAREHOUSE_NAME
LEFT JOIN warehouse_sizes ws ON COALESCE(qa.WAREHOUSE_NAME, cu.WAREHOUSE_NAME) = ws.WAREHOUSE_NAME;

-- Expected columns in result:
-- WAREHOUSE_NAME, TOTAL_QUERIES, TOTAL_EXECUTION_TIME_MS, CREDITS_USED, 
-- UTILIZATION_PERCENT, WAREHOUSE_SIZE


-- ---------------------------------------------
-- QUERY 5: detectWasteOpportunities() - Unused Tables - FIXED ✅
-- Line: ~627
-- Purpose: Find tables not accessed in 90+ days with >1GB storage
-- Fix: DIRECT_OBJECTS_ACCESSED is ARRAY - use LATERAL FLATTEN to extract table names
-- ---------------------------------------------
WITH table_storage AS (
  SELECT 
    TABLE_CATALOG,
    TABLE_SCHEMA,
    TABLE_NAME,
    ACTIVE_BYTES,
    COALESCE(TABLE_DROPPED, TABLE_CREATED) AS LAST_MODIFIED
  FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
  WHERE DELETED = FALSE 
    AND ACTIVE_BYTES > 1073741824
    AND TABLE_CATALOG IS NOT NULL
),
table_access AS (
  SELECT 
    obj.value:objectName::STRING AS TABLE_NAME,
    obj.value:objectDomain::STRING AS OBJECT_DOMAIN,
    MAX(QUERY_START_TIME) AS LAST_ACCESS
  FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY,
  LATERAL FLATTEN(input => DIRECT_OBJECTS_ACCESSED) obj
  WHERE QUERY_START_TIME >= DATEADD(day, -90, CURRENT_TIMESTAMP())
    AND obj.value:objectDomain::STRING = 'Table'
  GROUP BY obj.value:objectName::STRING, obj.value:objectDomain::STRING
)
SELECT 
  ts.TABLE_CATALOG AS DATABASE_NAME,
  ts.TABLE_SCHEMA AS SCHEMA_NAME,
  ts.TABLE_NAME,
  ts.ACTIVE_BYTES AS STORAGE_BYTES,
  ts.LAST_MODIFIED,
  ta.LAST_ACCESS,
  DATEDIFF(day, COALESCE(ta.LAST_ACCESS, ts.LAST_MODIFIED), CURRENT_TIMESTAMP()) AS DAYS_SINCE_ACCESS
FROM table_storage ts
LEFT JOIN table_access ta ON ts.TABLE_NAME = ta.TABLE_NAME
WHERE COALESCE(ta.LAST_ACCESS, ts.LAST_MODIFIED) < DATEADD(day, -90, CURRENT_TIMESTAMP())
ORDER BY ts.ACTIVE_BYTES DESC
LIMIT 50;

-- Expected columns in result:
-- DATABASE_NAME, SCHEMA_NAME, TABLE_NAME, STORAGE_BYTES, LAST_MODIFIED,
-- LAST_ACCESS, DAYS_SINCE_ACCESS


-- ============================================
-- FILE: SnowflakeCostService.ts
-- ============================================

-- ---------------------------------------------
-- QUERY 6: getStorageUsage()
-- Line: ~263
-- Purpose: Get storage usage breakdown by database/schema/table
-- ---------------------------------------------
SELECT 
  TABLE_CATALOG AS DATABASE_NAME,
  TABLE_SCHEMA AS SCHEMA_NAME,
  TABLE_NAME,
  'TABLE' AS TABLE_TYPE,
  ACTIVE_BYTES AS STORAGE_BYTES,
  NULL AS ROW_COUNT,
  IS_TRANSIENT,
  CASE WHEN IS_TRANSIENT = 'YES' THEN 0 ELSE 1 END AS RETENTION_DAYS,
  COALESCE(TABLE_DROPPED, TABLE_CREATED) AS LAST_ALTERED,
  TABLE_CREATED AS CREATED
FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
WHERE DELETED = FALSE
  AND TABLE_CATALOG IS NOT NULL
ORDER BY ACTIVE_BYTES DESC NULLS LAST
LIMIT 1000;

-- Expected columns in result:
-- DATABASE_NAME, SCHEMA_NAME, TABLE_NAME, TABLE_TYPE, STORAGE_BYTES,
-- ROW_COUNT, IS_TRANSIENT, RETENTION_DAYS, LAST_ALTERED, CREATED


-- ---------------------------------------------
-- QUERY 7: getStorageCosts()
-- Line: ~292
-- Purpose: Get daily storage costs
-- ---------------------------------------------
SELECT 
  USAGE_DATE,
  STORAGE_BYTES,
  STAGE_BYTES,
  FAILSAFE_BYTES
FROM SNOWFLAKE.ACCOUNT_USAGE.STORAGE_USAGE
WHERE USAGE_DATE >= DATEADD(day, -30, CURRENT_DATE())
ORDER BY USAGE_DATE DESC
LIMIT 90;

-- Expected columns in result:
-- USAGE_DATE, STORAGE_BYTES, STAGE_BYTES, FAILSAFE_BYTES


-- ---------------------------------------------
-- QUERY 8: detectUnusedTables() - FIXED ✅
-- Line: ~317
-- Purpose: Detect unused tables (>90 days, >1GB)
-- Fix: DIRECT_OBJECTS_ACCESSED is ARRAY - use LATERAL FLATTEN
-- ---------------------------------------------
WITH table_storage AS (
  SELECT 
    TABLE_CATALOG,
    TABLE_SCHEMA,
    TABLE_NAME,
    ACTIVE_BYTES,
    COALESCE(TABLE_DROPPED, TABLE_CREATED) AS LAST_MODIFIED
  FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
  WHERE DELETED = FALSE
    AND TABLE_CATALOG IS NOT NULL
),
table_access AS (
  SELECT 
    obj.value:objectName::STRING AS TABLE_NAME,
    obj.value:objectDomain::STRING AS OBJECT_DOMAIN,
    MAX(QUERY_START_TIME) AS LAST_ACCESS
  FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY,
  LATERAL FLATTEN(input => DIRECT_OBJECTS_ACCESSED) obj
  WHERE QUERY_START_TIME >= '2025-08-05'  -- 90 days ago
    AND obj.value:objectDomain::STRING = 'Table'
  GROUP BY obj.value:objectName::STRING, obj.value:objectDomain::STRING
)
SELECT 
  ts.TABLE_CATALOG AS DATABASE_NAME,
  ts.TABLE_SCHEMA AS SCHEMA_NAME,
  ts.TABLE_NAME,
  ts.ACTIVE_BYTES AS STORAGE_BYTES,
  ts.LAST_MODIFIED AS LAST_ALTERED,
  ta.LAST_ACCESS,
  DATEDIFF(day, COALESCE(ta.LAST_ACCESS, ts.LAST_MODIFIED), CURRENT_TIMESTAMP()) AS DAYS_SINCE_ACCESS
FROM table_storage ts
LEFT JOIN table_access ta ON ts.TABLE_NAME = ta.TABLE_NAME
WHERE COALESCE(ta.LAST_ACCESS, ts.LAST_MODIFIED) < '2025-08-05'
  AND ts.ACTIVE_BYTES > 1073741824
ORDER BY ts.ACTIVE_BYTES DESC
LIMIT 100;

-- Expected columns in result:
-- DATABASE_NAME, SCHEMA_NAME, TABLE_NAME, STORAGE_BYTES, LAST_ALTERED,
-- LAST_ACCESS, DAYS_SINCE_ACCESS


-- ============================================
-- SIMPLIFIED TEST QUERIES
-- Run these first to identify which specific columns are problematic
-- ============================================

-- TEST 1: Check QUERY_HISTORY columns we're using
SELECT TOP 1
  WAREHOUSE_NAME,
  WAREHOUSE_SIZE,
  TOTAL_ELAPSED_TIME,
  START_TIME
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
  AND WAREHOUSE_NAME IS NOT NULL;

-- TEST 2: Check WAREHOUSE_METERING_HISTORY columns
SELECT TOP 1
  WAREHOUSE_NAME,
  START_TIME,
  CREDITS_USED_COMPUTE,
  CREDITS_USED_CLOUD_SERVICES
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP());

-- TEST 3: Check TABLE_STORAGE_METRICS columns
SELECT TOP 1
  TABLE_CATALOG,
  TABLE_SCHEMA,
  TABLE_NAME,
  ACTIVE_BYTES,
  TIME_TRAVEL_BYTES,
  FAILSAFE_BYTES,
  IS_TRANSIENT,
  DELETED,
  TABLE_CREATED,
  TABLE_DROPPED
FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
WHERE DELETED = FALSE;

-- TEST 4: Try GROUP BY with window function - FIXED ✅
-- Fix: Can't use window function with ORDER BY in same query as GROUP BY
-- Split into subquery approach
WITH size_data AS (
  SELECT DISTINCT
    WAREHOUSE_NAME,
    FIRST_VALUE(WAREHOUSE_SIZE) OVER (PARTITION BY WAREHOUSE_NAME ORDER BY START_TIME DESC) AS WAREHOUSE_SIZE
  FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
  WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
    AND WAREHOUSE_NAME IS NOT NULL
),
query_counts AS (
  SELECT 
    WAREHOUSE_NAME,
    COUNT(*) AS TOTAL_QUERIES
  FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
  WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
    AND WAREHOUSE_NAME IS NOT NULL
  GROUP BY WAREHOUSE_NAME
)
SELECT 
  qc.WAREHOUSE_NAME,
  qc.TOTAL_QUERIES,
  sd.WAREHOUSE_SIZE
FROM query_counts qc
LEFT JOIN size_data sd ON qc.WAREHOUSE_NAME = sd.WAREHOUSE_NAME
LIMIT 5;

-- ============================================
-- INSTRUCTIONS
-- ============================================
-- 1. Run each numbered query in your Snowflake account
-- 2. If any query fails, note:
--    - Which query number
--    - The exact error message
--    - Which columns are invalid
-- 3. For working queries, confirm the column names in the result
-- 4. Provide me the corrected queries that work in your environment
