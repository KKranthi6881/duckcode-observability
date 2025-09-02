-- Migration: Fix ambiguous column references in lease function UPDATE statement
-- Description: Use fully qualified column references in UPDATE to avoid ambiguity with RETURNS TABLE

-- Drop and recreate the lease function with unambiguous UPDATE statement
DROP FUNCTION IF EXISTS code_insights.lease_processing_job(TEXT[], INTEGER);

CREATE OR REPLACE FUNCTION code_insights.lease_processing_job(
    job_types TEXT[] DEFAULT ARRAY['documentation', 'lineage'],
    lease_duration_minutes INTEGER DEFAULT 30
) RETURNS TABLE (
    job_id UUID,
    file_id UUID,
    status TEXT,
    vector_status TEXT,
    lineage_status TEXT,
    retry_count INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    leased_at TIMESTAMPTZ,
    error_details TEXT,
    analysis_language TEXT,
    file_path TEXT,
    language TEXT
) 
LANGUAGE plpgsql 
AS $$
DECLARE
    selected_job_id UUID;
    lease_expiry TIMESTAMPTZ;
BEGIN
    -- Calculate lease expiry time
    lease_expiry := NOW() - (lease_duration_minutes || ' minutes')::INTERVAL;

    -- Priority 1: Documentation jobs that are pending
    SELECT pj.id INTO selected_job_id
    FROM code_insights.processing_jobs pj
    JOIN code_insights.files f ON pj.file_id = f.id
    WHERE pj.status = 'pending' 
      AND 'documentation' = ANY(job_types)
      AND (pj.leased_at IS NULL OR pj.leased_at < lease_expiry)
    ORDER BY pj.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- Priority 2: Lineage jobs where documentation is complete but lineage is pending
    IF selected_job_id IS NULL THEN
        SELECT pj.id INTO selected_job_id
        FROM code_insights.processing_jobs pj
        JOIN code_insights.files f ON pj.file_id = f.id
        WHERE pj.status = 'completed' 
          AND COALESCE(pj.lineage_status, 'pending') = 'pending'
          AND 'lineage' = ANY(job_types)
          AND (pj.leased_at IS NULL OR pj.leased_at < lease_expiry)
          -- Only process lineage for SQL files
          AND (f.language ILIKE '%sql%' OR f.file_path ILIKE '%.sql')
        ORDER BY pj.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;

    -- Priority 3: Vector-only jobs (completed documentation, pending vectors)
    IF selected_job_id IS NULL THEN
        SELECT pj.id INTO selected_job_id
        FROM code_insights.processing_jobs pj
        JOIN code_insights.files f ON pj.file_id = f.id
        WHERE pj.status = 'completed' 
          AND COALESCE(pj.vector_status, 'pending') = 'pending'
          AND 'vector' = ANY(job_types)
          AND (pj.leased_at IS NULL OR pj.leased_at < lease_expiry)
        ORDER BY pj.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;

    -- If we found a job, lease it (using column aliases to avoid ambiguity)
    IF selected_job_id IS NOT NULL THEN
        UPDATE code_insights.processing_jobs pj_update
        SET 
            leased_at = NOW(),
            updated_at = NOW(),
            status = CASE 
                WHEN pj_update.status = 'pending' THEN 'processing'
                ELSE pj_update.status
            END,
            lineage_status = CASE 
                WHEN pj_update.status = 'completed' AND COALESCE(pj_update.lineage_status, 'pending') = 'pending' THEN 'processing'
                ELSE pj_update.lineage_status
            END,
            vector_status = CASE 
                WHEN pj_update.status = 'completed' AND COALESCE(pj_update.vector_status, 'pending') = 'pending' THEN 'processing'
                ELSE pj_update.vector_status
            END
        WHERE pj_update.id = selected_job_id;

        -- Return the job details with fully qualified column references
        RETURN QUERY
        SELECT 
            pj.id as job_id,
            pj.file_id as file_id,
            pj.status as status,
            COALESCE(pj.vector_status, 'pending') as vector_status,
            COALESCE(pj.lineage_status, 'pending') as lineage_status,
            COALESCE(pj.retry_count, 0) as retry_count,
            pj.created_at as created_at,
            pj.updated_at as updated_at,
            pj.leased_at as leased_at,
            pj.error_details as error_details,
            COALESCE(pj.analysis_language, 'default') as analysis_language,
            f.file_path as file_path,
            f.language as language
        FROM code_insights.processing_jobs pj
        JOIN code_insights.files f ON pj.file_id = f.id
        WHERE pj.id = selected_job_id;
    END IF;

    RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION code_insights.lease_processing_job TO service_role;

-- Add comment
COMMENT ON FUNCTION code_insights.lease_processing_job IS 'Lease function with unambiguous column references in UPDATE statement'; 