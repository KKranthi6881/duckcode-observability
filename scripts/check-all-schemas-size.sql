-- Complete Database Size Analysis
-- Shows ALL schemas, tables, and detailed statistics

-- ============================================
-- 1. TOTAL DATABASE SIZE
-- ============================================
SELECT 
    current_database() AS database_name,
    pg_size_pretty(pg_database_size(current_database())) AS total_size,
    pg_database_size(current_database()) AS size_bytes
;

-- ============================================
-- 2. ALL SCHEMAS SIZE (Sorted by size)
-- ============================================
SELECT 
    schemaname,
    pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) AS total_size,
    sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint AS size_bytes,
    count(*) AS table_count
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname
ORDER BY size_bytes DESC;

-- ============================================
-- 3. ALL TABLES BY SCHEMA (Top 30 largest)
-- ============================================
SELECT 
    schemaname AS schema,
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY size_bytes DESC
LIMIT 30;

-- ============================================
-- 4. METADATA SCHEMA - Detailed Table Info
-- ============================================
\echo ''
\echo '========== METADATA SCHEMA BREAKDOWN =========='
SELECT 
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size('metadata.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size('metadata.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size('metadata.'||tablename) - pg_relation_size('metadata.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'metadata'
ORDER BY pg_total_relation_size('metadata.'||tablename) DESC;

-- ============================================
-- 5. ENTERPRISE SCHEMA (if exists)
-- ============================================
\echo ''
\echo '========== ENTERPRISE SCHEMA =========='
SELECT 
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size('enterprise.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'enterprise'
ORDER BY pg_total_relation_size('enterprise.'||tablename) DESC;

-- ============================================
-- 6. AI_DOCUMENTATION SCHEMA (if exists)
-- ============================================
\echo ''
\echo '========== AI_DOCUMENTATION SCHEMA =========='
SELECT 
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size('ai_documentation.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'ai_documentation'
ORDER BY pg_total_relation_size('ai_documentation.'||tablename) DESC;

-- ============================================
-- 7. PUBLIC SCHEMA
-- ============================================
\echo ''
\echo '========== PUBLIC SCHEMA =========='
SELECT 
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- ============================================
-- 8. AUTH SCHEMA (Supabase Auth)
-- ============================================
\echo ''
\echo '========== AUTH SCHEMA =========='
SELECT 
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size('auth.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'auth'
ORDER BY pg_total_relation_size('auth.'||tablename) DESC;

-- ============================================
-- 9. STORAGE SCHEMA (Supabase Storage)
-- ============================================
\echo ''
\echo '========== STORAGE SCHEMA =========='
SELECT 
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size('storage.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'storage'
ORDER BY pg_total_relation_size('storage.'||tablename) DESC;

-- ============================================
-- 10. ROW COUNTS FOR KEY TABLES
-- ============================================
\echo ''
\echo '========== ROW COUNTS =========='

-- Metadata schema
SELECT 'metadata.objects' AS table_name, count(*) AS row_count FROM metadata.objects
UNION ALL SELECT 'metadata.columns', count(*) FROM metadata.columns
UNION ALL SELECT 'metadata.dependencies', count(*) FROM metadata.dependencies
UNION ALL SELECT 'metadata.files', count(*) FROM metadata.files
UNION ALL SELECT 'metadata.columns_lineage', count(*) FROM metadata.columns_lineage
UNION ALL SELECT 'metadata.repositories', count(*) FROM metadata.repositories
UNION ALL SELECT 'metadata.object_documentation', count(*) FROM metadata.object_documentation

-- Enterprise schema (if exists)
UNION ALL SELECT 'enterprise.organizations', count(*) FROM enterprise.organizations
UNION ALL SELECT 'enterprise.user_organization_roles', count(*) FROM enterprise.user_organization_roles

-- Auth schema
UNION ALL SELECT 'auth.users', count(*) FROM auth.users

ORDER BY row_count DESC;

-- ============================================
-- 11. INDEX USAGE STATISTICS
-- ============================================
\echo ''
\echo '========== INDEX STATISTICS (metadata schema) =========='
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan AS times_used,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'metadata'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;

-- ============================================
-- 12. VACUUM & BLOAT INFO
-- ============================================
\echo ''
\echo '========== TABLE BLOAT ESTIMATE (metadata) =========='
SELECT
    schemaname||'.'||tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    round(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'metadata'
ORDER BY n_dead_tup DESC
LIMIT 10;
