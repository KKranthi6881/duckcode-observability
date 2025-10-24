-- Check Metadata Schema Size
-- Run this against your local Supabase database

-- 1. Total database size
SELECT pg_size_pretty(pg_database_size(current_database())) AS total_database_size;

-- 2. Metadata schema size
SELECT 
    schemaname,
    pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) AS total_size
FROM pg_tables
WHERE schemaname = 'metadata'
GROUP BY schemaname;

-- 3. Size breakdown by table in metadata schema
SELECT 
    tablename AS table_name,
    pg_size_pretty(pg_total_relation_size('metadata.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size('metadata.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size('metadata.'||tablename) - pg_relation_size('metadata.'||tablename)) AS index_size,
    (SELECT count(*) FROM (SELECT 1 FROM metadata.objects LIMIT 1) t) AS row_count_sample
FROM pg_tables
WHERE schemaname = 'metadata'
ORDER BY pg_total_relation_size('metadata.'||tablename) DESC;

-- 4. Row counts for metadata tables
SELECT 
    'connections' AS table_name,
    count(*) AS row_count
FROM metadata.connections
UNION ALL
SELECT 'objects', count(*) FROM metadata.objects
UNION ALL
SELECT 'columns', count(*) FROM metadata.columns
UNION ALL
SELECT 'dependencies', count(*) FROM metadata.dependencies
UNION ALL
SELECT 'files', count(*) FROM metadata.files
UNION ALL
SELECT 'repositories', count(*) FROM metadata.repositories
ORDER BY row_count DESC;

-- 5. AI Documentation schema size (if exists)
SELECT 
    schemaname,
    pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) AS total_size
FROM pg_tables
WHERE schemaname = 'ai_documentation'
GROUP BY schemaname;

-- 6. Top 10 largest tables across all schemas
SELECT 
    schemaname||'.'||tablename AS table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
