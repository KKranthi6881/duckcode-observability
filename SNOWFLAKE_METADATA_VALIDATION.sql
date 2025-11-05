-- ============================================================================
-- SNOWFLAKE METADATA VALIDATION GUIDE
-- Run these queries in your Snowflake SQL Worksheet to validate data sources
-- ============================================================================

-- ============================================================================
-- STEP 1: CHECK IF YOU HAVE ACCESS TO ACCOUNT_USAGE SCHEMA
-- ============================================================================
-- You need ACCOUNTADMIN role or specific grants to access ACCOUNT_USAGE

-- Check your current role
SELECT CURRENT_ROLE();

-- If not ACCOUNTADMIN, switch to it:
-- USE ROLE ACCOUNTADMIN;

-- Verify access to ACCOUNT_USAGE schema
SHOW SCHEMAS IN DATABASE SNOWFLAKE;
-- Should see: ACCOUNT_USAGE, INFORMATION_SCHEMA, etc.


-- ============================================================================
-- STEP 2: VALIDATE BUDGET TRACKING DATA SOURCES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 QUERY_HISTORY - Primary source for budget cost tracking
-- ----------------------------------------------------------------------------

-- Check if table exists and has recent data
SELECT 
    'QUERY_HISTORY' as table_name,
    COUNT(*) as total_rows,
    MIN(start_time) as oldest_record,
    MAX(start_time) as newest_record,
    COUNT(DISTINCT warehouse_name) as unique_warehouses,
    COUNT(DISTINCT user_name) as unique_users,
    SUM(credits_used_cloud_services) as total_credits_used
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE());


-- Expected: Should return rows if you have query activity
-- Note: ACCOUNT_USAGE has 45 min - 3 hour latency


-- Sample data from QUERY_HISTORY (verify columns exist)
SELECT TOP 10
    query_id,
    query_text,
    database_name,
    schema_name,
    query_type,
    user_name,
    role_name,
    warehouse_name,
    warehouse_size,
    warehouse_type,
    execution_status,
    error_code,
    error_message,
    start_time,
    end_time,
    total_elapsed_time,
    bytes_scanned,
    bytes_written,
    bytes_spilled_to_local_storage,
    bytes_spilled_to_remote_storage,
    rows_produced,
    credits_used_cloud_services,
    //credits_used,  -- KEY FIELD for cost calculation
    compilation_time,
    execution_time,
    queued_provisioning_time,
    queued_overload_time
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -1, CURRENT_DATE())
ORDER BY start_time DESC;

-- CRITICAL: Verify 'credits_used' column exists and has values


-- ----------------------------------------------------------------------------
-- 2.2 WAREHOUSE_METERING_HISTORY - Alternative for warehouse costs
-- ----------------------------------------------------------------------------

SELECT 
    'WAREHOUSE_METERING_HISTORY' as table_name,
    COUNT(*) as total_rows,
    MIN(start_time) as oldest_record,
    MAX(start_time) as newest_record,
    COUNT(DISTINCT warehouse_name) as unique_warehouses,
    SUM(credits_used) as total_credits
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE());


-- Sample data
SELECT TOP 10
    start_time,
    end_time,
    warehouse_name,
    credits_used,  -- KEY FIELD
    credits_used_compute,
    credits_used_cloud_services
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE start_time >= DATEADD(day, -1, CURRENT_DATE())
ORDER BY start_time DESC;


-- ----------------------------------------------------------------------------
-- 2.3 DATABASE_STORAGE_USAGE_HISTORY - For storage costs
-- ----------------------------------------------------------------------------

SELECT 
    'DATABASE_STORAGE_USAGE_HISTORY' as table_name,
    COUNT(*) as total_rows,
    MIN(usage_date) as oldest_record,
    MAX(usage_date) as newest_record,
    COUNT(DISTINCT database_name) as unique_databases
FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY
WHERE usage_date >= DATEADD(day, -30, CURRENT_DATE());


-- Sample data
SELECT TOP 10
    usage_date,
    database_name,
    average_database_bytes,
    average_failsafe_bytes,
    average_hybrid_table_storage_bytes
FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY
WHERE usage_date >= DATEADD(day, -7, CURRENT_DATE())
ORDER BY usage_date DESC;



-- ============================================================================
-- STEP 3: VALIDATE SECURITY MONITORING DATA SOURCES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 LOGIN_HISTORY - For access patterns & authentication
-- ----------------------------------------------------------------------------

SELECT 
    'LOGIN_HISTORY' as table_name,
    COUNT(*) as total_rows,
    MIN(event_timestamp) as oldest_record,
    MAX(event_timestamp) as newest_record,
    COUNT(DISTINCT user_name) as unique_users,
    COUNT(DISTINCT client_ip) as unique_ips
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE event_timestamp >= DATEADD(day, -7, CURRENT_DATE());


-- Sample data - verify columns
SELECT TOP 10
    event_id,
    event_timestamp,
    event_type,  -- LOGIN, LOGOUT
    user_name,  -- KEY FIELD
    client_ip,  -- KEY FIELD for anomaly detection
    reported_client_type,
    reported_client_version,
    first_authentication_factor,
    second_authentication_factor,
    is_success,
    error_code,
    error_message,
    related_event_id,
    connection
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE event_timestamp >= DATEADD(day, -1, CURRENT_DATE())
ORDER BY event_timestamp DESC;


-- ----------------------------------------------------------------------------
-- 3.2 ACCESS_HISTORY - For detailed object access tracking
-- ----------------------------------------------------------------------------

SELECT 
    'ACCESS_HISTORY' as table_name,
    COUNT(*) as total_rows,
    MIN(query_start_time) as oldest_record,
    MAX(query_start_time) as newest_record,
    COUNT(DISTINCT user_name) as unique_users
FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY
WHERE query_start_time >= DATEADD(day, -7, CURRENT_DATE());


-- Sample data
SELECT TOP 10
    query_id,
    query_start_time,
    user_name,
    direct_objects_accessed,  -- JSON array of objects
    base_objects_accessed,     -- JSON array of base tables
    objects_modified,          -- JSON array of modified objects
    object_modified_by_ddl,
    policies_referenced,
    
FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY
WHERE query_start_time >= DATEADD(day, -1, CURRENT_DATE())
  AND user_name IS NOT NULL
ORDER BY query_start_time DESC;

-- ----------------------------------------------------------------------------
-- 3.3 GRANTS_TO_USERS - For role assignments
-- ----------------------------------------------------------------------------

SELECT 
    'GRANTS_TO_USERS' as table_name,
    COUNT(*) as total_grants,
    COUNT(DISTINCT grantee_name) as unique_users,
    COUNT(DISTINCT role) as unique_roles
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
WHERE deleted_on IS NULL;  -- Only active grants



-- Sample data
SELECT TOP 20
    created_on,
    role,         -- KEY FIELD
    grantee_name,      -- KEY FIELD (username)
    granted_to,        -- Usually 'USER'
    granted_by,
    deleted_on         -- NULL if still active
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
WHERE deleted_on IS NULL
ORDER BY created_on DESC;





-- ============================================================================
-- STEP 4: TEST ACTUAL DATA EXTRACTION QUERIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 Budget Tracking - Daily Warehouse Costs
-- ----------------------------------------------------------------------------

SELECT 
    DATE(start_time) as usage_date,
    warehouse_name,
    COUNT(*) as query_count,
    SUM(credits_used_cloud_services) as total_credits,
    SUM(credits_used_cloud_services) * 3.0 as total_cost_usd,  -- ADJUST MULTIPLIER!
    AVG(total_elapsed_time) / 1000 as avg_exec_time_sec
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE())
  AND warehouse_name IS NOT NULL
GROUP BY DATE(start_time), warehouse_name
ORDER BY usage_date DESC, total_cost_usd DESC;

-- ✅ Expected: Rows with warehouse costs
-- ❌ If empty: Check date range, or no recent activity


-- ----------------------------------------------------------------------------
-- 4.2 Security - User Cost Attribution
-- ----------------------------------------------------------------------------

SELECT 
    user_name,
    COUNT(*) as total_queries,
    SUM(CASE WHEN execution_status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_queries,
    SUM(CASE WHEN execution_status != 'SUCCESS' THEN 1 ELSE 0 END) as failed_queries,
    SUM(credits_used_cloud_services) * 3.0 as total_cost_usd,  -- ADJUST MULTIPLIER!
    SUM(credits_used_cloud_services) * 3.0 / NULLIF(COUNT(*), 0) as cost_per_query,
    AVG(total_elapsed_time) as avg_execution_time_ms,
    SUM(bytes_scanned) as storage_accessed_bytes
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE())
  AND user_name IS NOT NULL
  AND user_name != 'SYSTEM'
GROUP BY user_name
ORDER BY total_cost_usd DESC
LIMIT 20;

-- ✅ Expected: List of users with costs
-- ❌ If empty: No user activity in last 7 days


-- ----------------------------------------------------------------------------
-- 4.3 Security - Login Activity
-- ----------------------------------------------------------------------------

SELECT 
    user_name,
    event_type,
    client_ip,
    reported_client_type,
    is_success,
    event_timestamp
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE event_timestamp >= DATEADD(day, -7, CURRENT_DATE())
ORDER BY event_timestamp DESC
LIMIT 100;

-- ✅ Expected: Recent login/logout events
-- ❌ If empty: No login activity or insufficient permissions


-- ----------------------------------------------------------------------------
-- 4.4 Security - Anomaly Detection: High Table Access
-- ----------------------------------------------------------------------------

WITH user_table_counts AS (
    SELECT 
        user_name,
        DATE(start_time) as access_date,
        COUNT(DISTINCT 
            CASE 
                WHEN query_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
                THEN CONCAT(database_name, '.', schema_name)
            END
        ) as schemas_accessed
    FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
    WHERE start_time >= DATEADD(day, -7, CURRENT_DATE())
    GROUP BY user_name, DATE(start_time)
)
SELECT 
    user_name,
    access_date,
    schemas_accessed,
    CASE 
        WHEN schemas_accessed > 50 THEN 'HIGH RISK'
        WHEN schemas_accessed > 25 THEN 'MEDIUM RISK'
        ELSE 'NORMAL'
    END as risk_level
FROM user_table_counts
WHERE schemas_accessed > 10
ORDER BY schemas_accessed DESC;

-- ✅ Expected: Users with unusual access patterns
-- ❌ If empty: Normal activity, no anomalies


-- ============================================================================
-- STEP 5: CRITICAL VALIDATIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 5.1 Verify CREDITS_USED has values (not all zeros)
-- ----------------------------------------------------------------------------

SELECT 
    COUNT(*) as total_queries,
    COUNT(CASE WHEN credits_used_cloud_services > 0 THEN 1 END) as queries_with_credits,
    SUM(credits_used_cloud_services) as total_credits,
    CASE 
        WHEN SUM(credits_used_cloud_services) > 0 THEN '✅ CREDITS DATA AVAILABLE'
        ELSE '❌ NO CREDITS DATA - CHECK WAREHOUSE USAGE'
    END as status
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE());


-- ----------------------------------------------------------------------------
-- 5.2 Check data latency (how old is newest data?)
-- ----------------------------------------------------------------------------

SELECT 
    'QUERY_HISTORY' as view_name,
    MAX(start_time) as newest_record,
    DATEDIFF(minute, MAX(start_time), CURRENT_TIMESTAMP()) as minutes_old,
    CASE 
        WHEN DATEDIFF(minute, MAX(start_time), CURRENT_TIMESTAMP()) > 180 
        THEN '⚠️ Data is >3 hours old (expected with ACCOUNT_USAGE)'
        ELSE '✅ Data is recent'
    END as status
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY

UNION ALL

SELECT 
    'LOGIN_HISTORY' as view_name,
    MAX(event_timestamp) as newest_record,
    DATEDIFF(minute, MAX(event_timestamp), CURRENT_TIMESTAMP()) as minutes_old,
    CASE 
        WHEN DATEDIFF(minute, MAX(event_timestamp), CURRENT_TIMESTAMP()) > 180 
        THEN '⚠️ Data is >3 hours old (expected with ACCOUNT_USAGE)'
        ELSE '✅ Data is recent'
    END as status
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY;


-- ----------------------------------------------------------------------------
-- 5.3 Verify you have data for all required fields
-- ----------------------------------------------------------------------------

SELECT 
    'Required Fields Check' as validation_type,
    COUNT(DISTINCT user_name) as users_with_data,
    COUNT(DISTINCT warehouse_name) as warehouses_with_data,
    COUNT(DISTINCT database_name) as databases_with_data,
    SUM(credits_used_cloud_services) as total_credits,
    CASE 
        WHEN COUNT(DISTINCT user_name) > 0 
         AND COUNT(DISTINCT warehouse_name) > 0 
         AND SUM(credits_used_cloud_services) > 0 
        THEN '✅ ALL REQUIRED FIELDS PRESENT'
        ELSE '❌ MISSING REQUIRED DATA'
    END as status
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE());


-- ============================================================================
-- STEP 6: DETERMINE YOUR CREDIT PRICE
-- ============================================================================

-- Check your Snowflake edition
SHOW PARAMETERS LIKE 'ACCOUNT_EDITION' IN ACCOUNT;

/*
Edition → Typical Credit Price:
- Standard: $2.00/credit
- Enterprise: $3.00/credit  
- Business Critical: $4.00/credit

Update all queries: Replace "* 3.0" with your actual price
*/


-- ============================================================================
-- TROUBLESHOOTING GUIDE
-- ============================================================================

/*
PROBLEM: No data returned from QUERY_HISTORY
SOLUTION: 
  1. Check if you have recent query activity
  2. Verify you're using ACCOUNTADMIN role
  3. Wait 45 min - 3 hours for ACCOUNT_USAGE to populate
  4. Use INFORMATION_SCHEMA for real-time data (different structure)

PROBLEM: credits_used is always 0
SOLUTION:
  1. Check if warehouses are actually running queries
  2. Verify warehouse is not suspended
  3. Use WAREHOUSE_METERING_HISTORY instead
  4. Check if you have auto-suspend enabled

PROBLEM: Can't access ACCOUNT_USAGE schema
SOLUTION:
  1. USE ROLE ACCOUNTADMIN;
  2. Or request IMPORTED PRIVILEGES on SNOWFLAKE database
  3. Grant: GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE <your_role>;

PROBLEM: No LOGIN_HISTORY data
SOLUTION:
  1. Verify authentication is enabled
  2. Check if you have login activity
  3. May need specific grants to view login history

PROBLEM: ACCESS_HISTORY is empty
SOLUTION:
  1. Object access tracking must be enabled (Enterprise feature)
  2. Enable: ALTER ACCOUNT SET ENABLE_OBJECT_ACCESS_TRACKING = TRUE;
  3. Wait 24 hours for data to populate
*/


-- ============================================================================
-- SUMMARY CHECKLIST
-- ============================================================================

SELECT 'VALIDATION CHECKLIST' as section, 
       '✅ Run each query above' as step_1,
       '✅ Verify columns exist' as step_2,
       '✅ Confirm data is present' as step_3,
       '✅ Adjust credit price multiplier' as step_4,
       '✅ Check data latency is acceptable' as step_5;

/*
NEXT STEPS:
1. ✅ Validate all queries return data
2. ✅ Note your credit price
3. ✅ Update multiplier in extraction queries
4. ✅ Set up scheduled data extraction (daily)
5. ✅ Load data into Supabase tables
6. ✅ Test backend APIs
7. ✅ View in frontend dashboard
*/
