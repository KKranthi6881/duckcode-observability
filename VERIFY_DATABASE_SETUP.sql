-- ============================================================================
-- DATABASE SETUP VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to verify Budget & Security tables exist
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Check if all required tables exist
-- ----------------------------------------------------------------------------

SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'snowflake_budgets',
            'snowflake_budget_alerts', 
            'snowflake_budget_snapshots',
            'snowflake_user_costs',
            'snowflake_access_patterns',
            'snowflake_role_permissions'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'enterprise' 
  AND table_name IN (
    'snowflake_budgets',
    'snowflake_budget_alerts',
    'snowflake_budget_snapshots',
    'snowflake_user_costs',
    'snowflake_access_patterns',
    'snowflake_role_permissions'
  )
ORDER BY table_name;

-- Expected: 6 tables with ✅ EXISTS status

-- ----------------------------------------------------------------------------
-- 2. Check if views exist
-- ----------------------------------------------------------------------------

SELECT 
    table_name as view_name,
    '✅ VIEW EXISTS' as status
FROM information_schema.views
WHERE table_schema = 'enterprise'
  AND table_name IN (
    'v_top_expensive_users',
    'v_security_issues'
  )
ORDER BY table_name;

-- Expected: 2 views

-- ----------------------------------------------------------------------------
-- 3. Check if functions exist
-- ----------------------------------------------------------------------------

SELECT 
    routine_name as function_name,
    '✅ FUNCTION EXISTS' as status
FROM information_schema.routines
WHERE routine_schema = 'enterprise'
  AND routine_name IN (
    'get_budget_current_spend',
    'check_budget_alerts',
    'detect_access_anomalies'
  )
ORDER BY routine_name;

-- Expected: 3 functions

-- ----------------------------------------------------------------------------
-- 4. Verify table structures (Budget Guardrails)
-- ----------------------------------------------------------------------------

-- 4.1 snowflake_budgets columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'enterprise'
  AND table_name = 'snowflake_budgets'
ORDER BY ordinal_position;

-- 4.2 snowflake_budget_alerts columns  
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'enterprise'
  AND table_name = 'snowflake_budget_alerts'
ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 5. Verify table structures (Security Monitoring)
-- ----------------------------------------------------------------------------

-- 5.1 snowflake_user_costs columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'enterprise'
  AND table_name = 'snowflake_user_costs'
ORDER BY ordinal_position;

-- 5.2 snowflake_access_patterns columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'enterprise'
  AND table_name = 'snowflake_access_patterns'
ORDER BY ordinal_position;

-- 5.3 snowflake_role_permissions columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'enterprise'
  AND table_name = 'snowflake_role_permissions'
ORDER BY ordinal_position;

-- ----------------------------------------------------------------------------
-- 6. Test inserting sample data (Budget)
-- ----------------------------------------------------------------------------

-- Insert a test budget
INSERT INTO enterprise.snowflake_budgets (
    organization_id,
    connector_id,
    budget_type,
    budget_name,
    budget_amount,
    budget_period,
    currency,
    alert_threshold_1,
    alert_threshold_2,
    alert_threshold_3,
    email_alerts,
    auto_suspend_at_limit,
    status,
    current_period_start,
    current_period_end
) VALUES (
    (SELECT id FROM enterprise.organizations LIMIT 1),  -- Use existing org
    NULL,  -- Organization-level budget
    'organization',
    'TEST BUDGET - DELETE ME',
    50000,
    'monthly',
    'USD',
    75,
    90,
    100,
    true,
    false,
    'active',
    DATE_TRUNC('month', CURRENT_DATE),
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE
) RETURNING id, budget_name, budget_amount;

-- Verify it was inserted
SELECT 
    id,
    budget_name,
    budget_amount,
    budget_type,
    status,
    created_at
FROM enterprise.snowflake_budgets
WHERE budget_name = 'TEST BUDGET - DELETE ME';

-- Clean up test data
DELETE FROM enterprise.snowflake_budgets
WHERE budget_name = 'TEST BUDGET - DELETE ME';

-- ----------------------------------------------------------------------------
-- 7. Test budget calculation function
-- ----------------------------------------------------------------------------

-- This tests if the get_budget_current_spend function works
-- (Will return 0 if no data exists, but should not error)

SELECT enterprise.get_budget_current_spend(
    (SELECT id FROM enterprise.snowflake_budgets LIMIT 1)
) as test_current_spend;

-- ----------------------------------------------------------------------------
-- 8. Check indexes exist
-- ----------------------------------------------------------------------------

SELECT 
    indexname as index_name,
    tablename as table_name,
    '✅ INDEX EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'enterprise'
  AND indexname IN (
    'idx_budgets_org',
    'idx_budgets_connector',
    'idx_budgets_status',
    'idx_budget_alerts_budget',
    'idx_user_costs_connector',
    'idx_user_costs_user',
    'idx_access_patterns_connector',
    'idx_access_patterns_user',
    'idx_access_patterns_anomaly',
    'idx_role_permissions_connector'
  )
ORDER BY tablename, indexname;

-- ----------------------------------------------------------------------------
-- 9. SUMMARY: Quick Health Check
-- ----------------------------------------------------------------------------

SELECT 
    'BUDGET GUARDRAILS' as feature,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'enterprise' 
       AND table_name LIKE 'snowflake_budget%') as tables_count,
    '3 expected' as expected,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.tables 
               WHERE table_schema = 'enterprise' 
                 AND table_name LIKE 'snowflake_budget%') = 3 
         THEN '✅ PASS' 
         ELSE '❌ FAIL' 
    END as status

UNION ALL

SELECT 
    'SECURITY MONITORING' as feature,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema = 'enterprise' 
       AND table_name IN ('snowflake_user_costs', 'snowflake_access_patterns', 'snowflake_role_permissions')) as tables_count,
    '3 expected' as expected,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.tables 
               WHERE table_schema = 'enterprise' 
                 AND table_name IN ('snowflake_user_costs', 'snowflake_access_patterns', 'snowflake_role_permissions')) = 3 
         THEN '✅ PASS' 
         ELSE '❌ FAIL' 
    END as status

UNION ALL

SELECT 
    'SECURITY VIEWS' as feature,
    (SELECT COUNT(*) FROM information_schema.views 
     WHERE table_schema = 'enterprise' 
       AND table_name IN ('v_top_expensive_users', 'v_security_issues')) as tables_count,
    '2 expected' as expected,
    CASE WHEN (SELECT COUNT(*) FROM information_schema.views 
               WHERE table_schema = 'enterprise' 
                 AND table_name IN ('v_top_expensive_users', 'v_security_issues')) = 2 
         THEN '✅ PASS' 
         ELSE '❌ FAIL' 
    END as status;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
/*
✅ All 6 tables exist
✅ Both views exist (v_top_expensive_users, v_security_issues)
✅ All 3 functions exist
✅ Test budget can be inserted and deleted
✅ Summary shows all PASS

If any failures:
1. Check migration files were applied
2. Run: supabase db reset (to reapply all migrations)
3. Check for errors in migration logs
*/
