-- ============================================================================
-- SNOWFLAKE DATA EXTRACTION QUERIES
-- For Budget Guardrails & Security Monitoring Features
-- ============================================================================

-- ============================================================================
-- PART 1: BUDGET GUARDRAILS DATA EXTRACTION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 Daily Cost Tracking (for budget spend calculation)
-- ----------------------------------------------------------------------------
-- This query aggregates daily costs for budget tracking
-- Run this daily to populate budget spend data

SELECT 
    -- Date dimension
    DATE(start_time) as usage_date,
    
    -- Organization/Account
    'YOUR_SNOWFLAKE_ACCOUNT' as account_name,
    
    -- Warehouse dimension
    warehouse_name,
    
    -- Cost metrics (CORRECTED: using credits_used_cloud_services)
    SUM(credits_used_cloud_services) as total_credits,
    SUM(credits_used_cloud_services) * 3.0 as total_cost_usd,  -- Adjust multiplier for your credit price
    
    -- Query metrics
    COUNT(*) as query_count,
    SUM(CASE WHEN execution_status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_queries,
    SUM(CASE WHEN execution_status != 'SUCCESS' THEN 1 ELSE 0 END) as failed_queries,
    
    -- Time metrics
    SUM(total_elapsed_time) / 1000 as total_execution_time_seconds,
    AVG(total_elapsed_time) / 1000 as avg_execution_time_seconds

FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
  AND warehouse_name IS NOT NULL
GROUP BY DATE(start_time), warehouse_name
ORDER BY usage_date DESC, total_cost_usd DESC;

-- ----------------------------------------------------------------------------
-- 1.2 Warehouse-Level Budget Tracking
-- ----------------------------------------------------------------------------
-- Get current period spending by warehouse for budget comparison

SELECT 
    warehouse_name,
    
    -- Current month costs (CORRECTED: using credits_used_cloud_services)
    SUM(CASE 
        WHEN DATE(start_time) >= DATE_TRUNC('MONTH', CURRENT_DATE())
        THEN credits_used_cloud_services * 3.0 
        ELSE 0 
    END) as current_month_cost,
    
    -- Last 7 days
    SUM(CASE 
        WHEN start_time >= DATEADD(day, -7, CURRENT_DATE())
        THEN credits_used_cloud_services * 3.0 
        ELSE 0 
    END) as last_7_days_cost,
    
    -- Last 30 days
    SUM(CASE 
        WHEN start_time >= DATEADD(day, -30, CURRENT_DATE())
        THEN credits_used_cloud_services * 3.0 
        ELSE 0 
    END) as last_30_days_cost,
    
    -- Query counts
    COUNT(*) as total_queries,
    
    -- Average daily cost (last 30 days)
    (SUM(CASE 
        WHEN start_time >= DATEADD(day, -30, CURRENT_DATE())
        THEN credits_used_cloud_services * 3.0 
        ELSE 0 
    END) / 30) as avg_daily_cost

FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -90, CURRENT_DATE())
  AND warehouse_name IS NOT NULL
GROUP BY warehouse_name
ORDER BY current_month_cost DESC;

-- ----------------------------------------------------------------------------
-- 1.3 Storage Costs (for budget tracking)
-- ----------------------------------------------------------------------------

SELECT 
    DATE(usage_date) as usage_date,
    'STORAGE' as cost_category,
    database_name,
    SUM(average_hybrid_table_storage_bytes) / POWER(1024, 4) as storage_tb,
    SUM(average_hybrid_table_storage_bytes) / POWER(1024, 4) * 23 as estimated_monthly_cost_usd  -- $23/TB/month
FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY
WHERE usage_date >= DATEADD(day, -30, CURRENT_DATE())
GROUP BY DATE(usage_date), database_name
ORDER BY usage_date DESC, storage_tb DESC;


-- ============================================================================
-- PART 2: SECURITY & ACCESS MONITORING DATA EXTRACTION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1 User Cost Attribution (Who's spending what?)
-- ----------------------------------------------------------------------------
-- This is the MOST IMPORTANT query for security monitoring

SELECT 
    -- User identification
    user_name,
    role_name,
    
    -- Period
    DATE_TRUNC('MONTH', start_time) as period_start,
    LAST_DAY(start_time) as period_end,
    
    -- Query metrics
    COUNT(*) as total_queries,
    SUM(CASE WHEN execution_status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_queries,
    SUM(CASE WHEN execution_status != 'SUCCESS' THEN 1 ELSE 0 END) as failed_queries,
    
    -- Cost metrics (CORRECTED: using credits_used_cloud_services)
    SUM(credits_used_cloud_services) as total_credits,
    SUM(credits_used_cloud_services) * 3.0 as total_cost_usd,
    SUM(credits_used_cloud_services) * 3.0 / NULLIF(COUNT(*), 0) as cost_per_query,
    
    -- Performance metrics
    AVG(total_elapsed_time) as avg_execution_time_ms,
    SUM(total_elapsed_time) as total_execution_time_ms,
    
    -- Data access
    SUM(bytes_scanned) as storage_accessed_bytes,
    
    -- Top warehouse used
    MODE(warehouse_name) as top_warehouse_name,
    COUNT(DISTINCT warehouse_name) as warehouses_used,
    
    -- Failure rate
    (SUM(CASE WHEN execution_status != 'SUCCESS' THEN 1 ELSE 0 END)::FLOAT / 
     NULLIF(COUNT(*), 0) * 100) as failure_rate_pct

FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
  AND user_name IS NOT NULL
  AND user_name != 'SYSTEM'  -- Exclude system queries
GROUP BY user_name, role_name, DATE_TRUNC('MONTH', start_time), LAST_DAY(start_time)
ORDER BY total_cost_usd DESC;

-- ----------------------------------------------------------------------------
-- 2.2 User Access Patterns & Login History
-- ----------------------------------------------------------------------------

SELECT 
    -- User & session
    user_name,
    event_type,
    client_ip as source_ip,
    
    -- Authentication details
    first_authentication_factor,
    second_authentication_factor,
    
    -- Client information
    reported_client_type as client_type,
    reported_client_version,
    
    -- Event details
    event_timestamp,
    is_success,
    error_code,
    error_message,
    
    -- Connection details
    connection as connection_name

FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE event_timestamp >= DATEADD(day, -30, CURRENT_DATE())
ORDER BY event_timestamp DESC
LIMIT 1000;

-- ----------------------------------------------------------------------------
-- 2.3 Query Access Patterns (Table/Object Access)
-- ----------------------------------------------------------------------------

SELECT 
    -- User info
    user_name,
    role_name,
    
    -- Object access
    database_name,
    schema_name,
    query_type,
    
    -- Access metrics
    COUNT(*) as access_count,
    COUNT(DISTINCT CONCAT(database_name, '.', schema_name)) as unique_schemas_accessed,
    
    -- Recent access
    MAX(start_time) as last_access_time,
    MIN(start_time) as first_access_time,
    
    -- Cost of access (CORRECTED: using credits_used_cloud_services)
    SUM(credits_used_cloud_services) * 3.0 as total_access_cost_usd

FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
  AND user_name IS NOT NULL
  AND database_name IS NOT NULL
GROUP BY user_name, role_name, database_name, schema_name, query_type
ORDER BY access_count DESC;

-- ----------------------------------------------------------------------------
-- 2.4 Detailed Object Access (for anomaly detection)
-- ----------------------------------------------------------------------------

SELECT 
    user_name,
    query_id,
    
    -- Access details
    base_objects_accessed,
    direct_objects_accessed,
    objects_modified,
    
    -- Query details
    query_type,
    query_text,
    
    -- Context
    database_name,
    schema_name,
    warehouse_name,
    
    -- Timing
    start_time,
    end_time,
    total_elapsed_time,
    
    -- Resource usage
    credits_used_cloud_services,  -- CORRECTED
    bytes_scanned,
    bytes_written

FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY
WHERE query_start_time >= DATEADD(day, -7, CURRENT_DATE())
  AND user_name IS NOT NULL
ORDER BY query_start_time DESC
LIMIT 1000;

-- ----------------------------------------------------------------------------
-- 2.5 Role & Permission Audit
-- ----------------------------------------------------------------------------

-- Get all role grants (who has which role)
SELECT 
    grantee_name,
    role,  -- CORRECTED: column name is 'role' not 'role_name'
    granted_to,
    granted_by,
    created_on as granted_at,
    deleted_on as revoked_at,
    CASE WHEN deleted_on IS NULL THEN TRUE ELSE FALSE END as is_active
    
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
WHERE deleted_on IS NULL OR deleted_on >= DATEADD(day, -90, CURRENT_DATE())
ORDER BY grantee_name, role;

-- NOTE: OBJECT_PRIVILEGES table does not exist in standard Snowflake ACCOUNT_USAGE
-- Use GRANTS_TO_ROLES for object-level permissions instead

-- Get grants to roles (alternative to OBJECT_PRIVILEGES)
SELECT 
    grantee_name as role_name,
    privilege,
    granted_on,
    name as object_name,
    table_catalog as database_name,
    table_schema as schema_name,
    granted_by,
    created_on as granted_at,
    deleted_on as revoked_at,
    CASE WHEN deleted_on IS NULL THEN TRUE ELSE FALSE END as is_active
    
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
WHERE deleted_on IS NULL OR deleted_on >= DATEADD(day, -90, CURRENT_DATE())
  AND granted_on IN ('TABLE', 'VIEW', 'DATABASE', 'SCHEMA')
ORDER BY grantee_name, granted_on, object_name;

-- ----------------------------------------------------------------------------
-- 2.6 Anomaly Detection Queries
-- ----------------------------------------------------------------------------

-- 2.6.1 Users accessing unusually high number of tables
WITH user_table_access AS (
    SELECT 
        user_name,
        DATE(start_time) as access_date,
        COUNT(DISTINCT CONCAT(database_name, '.', schema_name, '.', 
              REGEXP_SUBSTR(query_text, 'FROM\\s+([\\w.]+)', 1, 1, 'ie', 1))) as tables_accessed
    FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
    WHERE start_time >= DATEADD(day, -7, CURRENT_DATE())
      AND query_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    GROUP BY user_name, DATE(start_time)
)
SELECT 
    user_name,
    access_date,
    tables_accessed,
    CASE 
        WHEN tables_accessed > 100 THEN 'CRITICAL'
        WHEN tables_accessed > 50 THEN 'HIGH'
        WHEN tables_accessed > 25 THEN 'MEDIUM'
        ELSE 'NORMAL'
    END as risk_level,
    'Unusual table access pattern detected' as anomaly_reason
FROM user_table_access
WHERE tables_accessed > 25
ORDER BY tables_accessed DESC;

-- 2.6.2 Users with query volume spikes
WITH daily_query_counts AS (
    SELECT 
        user_name,
        DATE(start_time) as query_date,
        COUNT(*) as query_count
    FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
    WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
    GROUP BY user_name, DATE(start_time)
),
user_averages AS (
    SELECT 
        user_name,
        AVG(query_count) as avg_daily_queries,
        STDDEV(query_count) as stddev_queries
    FROM daily_query_counts
    GROUP BY user_name
)
SELECT 
    d.user_name,
    d.query_date,
    d.query_count,
    u.avg_daily_queries,
    ROUND(d.query_count / NULLIF(u.avg_daily_queries, 0), 2) as spike_multiplier,
    CASE 
        WHEN d.query_count > u.avg_daily_queries * 5 THEN 'CRITICAL'
        WHEN d.query_count > u.avg_daily_queries * 3 THEN 'HIGH'
        WHEN d.query_count > u.avg_daily_queries * 2 THEN 'MEDIUM'
        ELSE 'NORMAL'
    END as risk_level
FROM daily_query_counts d
JOIN user_averages u ON d.user_name = u.user_name
WHERE d.query_count > u.avg_daily_queries * 2
  AND d.query_date >= DATEADD(day, -7, CURRENT_DATE())
ORDER BY spike_multiplier DESC;

-- 2.6.3 New IP address access detection
WITH user_ips AS (
    SELECT DISTINCT
        user_name,
        client_ip,
        MIN(event_timestamp) as first_seen
    FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
    WHERE event_timestamp >= DATEADD(day, -90, CURRENT_DATE())
    GROUP BY user_name, client_ip
)
SELECT 
    l.user_name,
    l.client_ip as source_ip,
    l.event_timestamp,
    'NEW_IP_ACCESS' as event_type,
    'User logged in from new IP address' as anomaly_reason,
    CASE 
        WHEN ui.first_seen >= DATEADD(day, -1, CURRENT_DATE()) THEN 80
        WHEN ui.first_seen >= DATEADD(day, -7, CURRENT_DATE()) THEN 60
        ELSE 40
    END as risk_score
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY l
JOIN user_ips ui ON l.user_name = ui.user_name AND l.client_ip = ui.client_ip
WHERE ui.first_seen >= DATEADD(day, -7, CURRENT_DATE())
  AND l.is_success = 'YES'
ORDER BY ui.first_seen DESC;

-- ----------------------------------------------------------------------------
-- 2.7 Over-Permissioned Roles Detection
-- ----------------------------------------------------------------------------

-- Find roles with excessive permissions that are rarely used
WITH role_usage AS (
    SELECT 
        role_name,
        COUNT(DISTINCT user_name) as users_with_role,
        COUNT(DISTINCT query_id) as queries_executed,
        MAX(start_time) as last_used
    FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
    WHERE start_time >= DATEADD(day, -90, CURRENT_DATE())
    GROUP BY role_name
),
role_permissions AS (
    SELECT 
        grantee_name as role_name,
        COUNT(*) as total_permissions,
        COUNT(DISTINCT granted_on) as object_types_granted
    FROM SNOWFLAKE.ACCOUNT_USAGE.OBJECT_PRIVILEGES
    WHERE deleted_on IS NULL
    GROUP BY grantee_name
)
SELECT 
    p.role_name,
    p.total_permissions,
    p.object_types_granted,
    COALESCE(u.users_with_role, 0) as active_users,
    COALESCE(u.queries_executed, 0) as queries_last_90_days,
    u.last_used,
    CASE 
        WHEN u.last_used IS NULL THEN TRUE
        WHEN u.last_used < DATEADD(day, -90, CURRENT_DATE()) THEN TRUE
        ELSE FALSE
    END as is_unused,
    CASE 
        WHEN p.total_permissions > 100 AND COALESCE(u.queries_executed, 0) < 100 THEN TRUE
        ELSE FALSE
    END as is_excessive
FROM role_permissions p
LEFT JOIN role_usage u ON p.role_name = u.role_name
WHERE p.total_permissions > 10
ORDER BY p.total_permissions DESC;


-- ============================================================================
-- PART 3: COMBINED SUMMARY QUERIES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 Security Summary Dashboard Data
-- ----------------------------------------------------------------------------

SELECT 
    COUNT(DISTINCT user_name) as total_active_users,
    SUM(credits_used_cloud_services) * 3.0 as total_cost_last_30_days,
    COUNT(*) as total_queries_last_30_days,
    COUNT(DISTINCT warehouse_name) as warehouses_used,
    COUNT(DISTINCT CASE WHEN execution_status != 'SUCCESS' THEN query_id END) as failed_queries,
    
    -- Top spender
    (SELECT user_name FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY 
     WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
     GROUP BY user_name 
     ORDER BY SUM(credits_used_cloud_services) DESC 
     LIMIT 1) as top_spender_user,
     
    (SELECT SUM(credits_used_cloud_services) * 3.0 FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY 
     WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
     GROUP BY user_name 
     ORDER BY SUM(credits_used_cloud_services) DESC 
     LIMIT 1) as top_spender_cost

FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -30, CURRENT_DATE());

-- ----------------------------------------------------------------------------
-- 3.2 Budget vs Actual Spending (Current Month)
-- ----------------------------------------------------------------------------

SELECT 
    'CURRENT_MONTH' as period,
    DATE_TRUNC('MONTH', CURRENT_DATE()) as period_start,
    LAST_DAY(CURRENT_DATE()) as period_end,
    
    -- Spending (CORRECTED: using credits_used_cloud_services)
    SUM(credits_used_cloud_services) * 3.0 as current_spend,
    
    -- Daily average
    SUM(credits_used_cloud_services) * 3.0 / DAY(CURRENT_DATE()) as avg_daily_spend,
    
    -- Projected end of month
    (SUM(credits_used_cloud_services) * 3.0 / DAY(CURRENT_DATE())) * 
    DAY(LAST_DAY(CURRENT_DATE())) as projected_month_end_spend,
    
    -- Days remaining
    DAY(LAST_DAY(CURRENT_DATE())) - DAY(CURRENT_DATE()) as days_remaining

FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATE_TRUNC('MONTH', CURRENT_DATE());


-- ============================================================================
-- NOTES & USAGE INSTRUCTIONS
-- ============================================================================

/*
CREDIT PRICING:
- Adjust the multiplier "* 3.0" to match your Snowflake credit price
- Standard pricing is ~$2-4 per credit depending on edition
- Check your contract for exact pricing

FREQUENCY:
- Budget tracking: Run daily
- User costs: Run daily or weekly
- Access patterns: Run weekly
- Role audit: Run monthly
- Anomaly detection: Run daily

INTEGRATION WITH YOUR PLATFORM:
1. Run these queries from your backend service
2. Store results in your Supabase tables:
   - snowflake_user_costs
   - snowflake_access_patterns
   - snowflake_role_permissions
3. Use stored data for dashboard display and alerts

PERFORMANCE:
- ACCOUNT_USAGE views have latency (45 min - 3 hours)
- For real-time data, use INFORMATION_SCHEMA views
- Add date filters to improve query performance
- Consider materializing results for large accounts
*/
