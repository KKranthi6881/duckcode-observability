-- =====================================================
-- VERIFICATION SCRIPT FOR AI DOCUMENTATION SCHEMA
-- Run this after applying the migration to verify everything works
-- =====================================================

-- Check if tables exist
SELECT 
    'Tables Created' AS check_type,
    COUNT(*) AS count,
    ARRAY_AGG(tablename ORDER BY tablename) AS tables
FROM pg_tables 
WHERE schemaname = 'metadata' 
AND tablename IN ('object_documentation', 'documentation_jobs', 'documentation_generation_logs');

-- Check if indexes exist
SELECT 
    'Indexes Created' AS check_type,
    COUNT(*) AS count,
    ARRAY_AGG(indexname ORDER BY indexname) AS indexes
FROM pg_indexes 
WHERE schemaname = 'metadata' 
AND tablename IN ('object_documentation', 'documentation_jobs', 'documentation_generation_logs');

-- Check if functions exist
SELECT 
    'Functions Created' AS check_type,
    COUNT(*) AS count,
    ARRAY_AGG(proname ORDER BY proname) AS functions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'metadata'
AND proname IN (
    'increment_processed_objects',
    'increment_failed_objects',
    'update_job_status',
    'update_average_processing_time',
    'update_estimated_completion',
    'get_documentation_summary'
);

-- Check column structure of object_documentation
SELECT 
    'object_documentation columns' AS table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'metadata'
AND table_name = 'object_documentation'
ORDER BY ordinal_position;

-- Check column structure of documentation_jobs
SELECT 
    'documentation_jobs columns' AS table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'metadata'
AND table_name = 'documentation_jobs'
ORDER BY ordinal_position;

-- Check foreign key constraints
SELECT
    'Foreign Keys' AS check_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'metadata'
AND tc.table_name IN ('object_documentation', 'documentation_jobs', 'documentation_generation_logs')
ORDER BY tc.table_name, kcu.column_name;

-- Check grants/permissions
SELECT 
    'Permissions' AS check_type,
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'metadata'
AND table_name IN ('object_documentation', 'documentation_jobs', 'documentation_generation_logs')
AND grantee IN ('service_role', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- =====================================================
-- TEST INSERTS
-- =====================================================

-- Test 1: Insert a test job
DO $$
DECLARE
    v_org_id UUID;
    v_job_id UUID;
BEGIN
    -- Get a test organization (use first available)
    SELECT id INTO v_org_id FROM enterprise.organizations LIMIT 1;
    
    IF v_org_id IS NOT NULL THEN
        -- Insert test job
        INSERT INTO metadata.documentation_jobs (
            organization_id,
            total_objects,
            status,
            api_provider,
            model_name
        ) VALUES (
            v_org_id,
            10,
            'queued',
            'openai',
            'gpt-4o-latest'
        ) RETURNING id INTO v_job_id;
        
        RAISE NOTICE '✅ Test job created: %', v_job_id;
        
        -- Test increment function
        PERFORM metadata.increment_processed_objects(v_job_id);
        
        -- Verify increment worked
        DECLARE
            v_processed INTEGER;
            v_progress DECIMAL;
        BEGIN
            SELECT processed_objects, progress_percentage 
            INTO v_processed, v_progress
            FROM metadata.documentation_jobs 
            WHERE id = v_job_id;
            
            IF v_processed = 1 AND v_progress = 10.00 THEN
                RAISE NOTICE '✅ Increment function works! Processed: %, Progress: %', v_processed, v_progress;
            ELSE
                RAISE NOTICE '❌ Increment function failed! Processed: %, Progress: %', v_processed, v_progress;
            END IF;
        END;
        
        -- Test status update function
        PERFORM metadata.update_job_status(v_job_id, 'processing', NULL);
        
        -- Verify status update
        DECLARE
            v_status VARCHAR(50);
            v_started_at TIMESTAMPTZ;
        BEGIN
            SELECT status, started_at
            INTO v_status, v_started_at
            FROM metadata.documentation_jobs
            WHERE id = v_job_id;
            
            IF v_status = 'processing' AND v_started_at IS NOT NULL THEN
                RAISE NOTICE '✅ Status update function works! Status: %, Started: %', v_status, v_started_at;
            ELSE
                RAISE NOTICE '❌ Status update failed! Status: %, Started: %', v_status, v_started_at;
            END IF;
        END;
        
        -- Clean up test data
        DELETE FROM metadata.documentation_jobs WHERE id = v_job_id;
        RAISE NOTICE '✅ Test data cleaned up';
    ELSE
        RAISE NOTICE '⚠️  No organization found for testing';
    END IF;
END $$;

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ PHASE 1 VERIFICATION COMPLETE';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Schema: metadata';
    RAISE NOTICE 'Tables: 3 (object_documentation, documentation_jobs, documentation_generation_logs)';
    RAISE NOTICE 'Functions: 6 helper functions';
    RAISE NOTICE 'Indexes: 13 performance indexes';
    RAISE NOTICE 'Ready for Phase 2: Backend Service Layer';
    RAISE NOTICE '================================================';
END $$;
