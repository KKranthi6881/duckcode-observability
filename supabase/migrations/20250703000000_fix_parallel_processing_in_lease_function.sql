-- Migration: Fix parallel processing in lease function
-- Description: Ensure only one status (vector OR lineage) is processed at a time, not both

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
    selected_job_type TEXT;
    lease_expiry TIMESTAMPTZ;
BEGIN
    -- Calculate lease expiry time
    lease_expiry := NOW() - (lease_duration_minutes || ' minutes')::INTERVAL;

    -- Priority 1: Documentation jobs that are pending
    SELECT pj.id, 'documentation' INTO selected_job_id, selected_job_type
    FROM code_insights.processing_jobs pj
    JOIN code_insights.files f ON pj.file_id = f.id
    WHERE pj.status = 'pending' 
      AND 'documentation' = ANY(job_types)
      AND (pj.leased_at IS NULL OR pj.leased_at < lease_expiry)
    ORDER BY pj.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- Priority 2: Vector-only jobs (completed documentation, EXPLICITLY pending vectors)
    IF selected_job_id IS NULL THEN
        SELECT pj.id, 'vector' INTO selected_job_id, selected_job_type
        FROM code_insights.processing_jobs pj
        JOIN code_insights.files f ON pj.file_id = f.id
        WHERE pj.status = 'completed' 
          AND pj.vector_status = 'pending'  -- Only explicit 'pending', not NULL
          AND 'vector' = ANY(job_types)
          AND (pj.leased_at IS NULL OR pj.leased_at < lease_expiry)
        ORDER BY pj.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;

    -- Priority 3: Lineage jobs where documentation is complete but lineage is pending
    IF selected_job_id IS NULL THEN
        SELECT pj.id, 'lineage' INTO selected_job_id, selected_job_type
        FROM code_insights.processing_jobs pj
        JOIN code_insights.files f ON pj.file_id = f.id
        WHERE pj.status = 'completed' 
          AND pj.lineage_status = 'pending'  -- Only explicit 'pending', not NULL
          AND 'lineage' = ANY(job_types)
          AND (pj.leased_at IS NULL OR pj.leased_at < lease_expiry)
          -- Only process lineage for SQL files
          AND (f.language ILIKE '%sql%' OR f.file_path ILIKE '%.sql')
        ORDER BY pj.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;
    END IF;

    -- If we found a job, lease it and update ONLY the specific status being processed
    IF selected_job_id IS NOT NULL THEN
        UPDATE code_insights.processing_jobs pj_update
        SET 
            leased_at = NOW(),
            updated_at = NOW(),
            -- Update main status only for documentation jobs
            status = CASE 
                WHEN selected_job_type = 'documentation' AND pj_update.status = 'pending' THEN 'processing'
                ELSE pj_update.status
            END,
            -- Update lineage_status only for lineage jobs
            lineage_status = CASE 
                WHEN selected_job_type = 'lineage' AND pj_update.lineage_status = 'pending' THEN 'processing'
                ELSE pj_update.lineage_status
            END,
            -- Update vector_status only for vector jobs
            vector_status = CASE 
                WHEN selected_job_type = 'vector' AND pj_update.vector_status = 'pending' THEN 'processing'
                ELSE pj_update.vector_status
            END
        WHERE pj_update.id = selected_job_id;

        -- Return the job details with fully qualified column references
        RETURN QUERY
        SELECT 
            pj.id as job_id,
            pj.file_id as file_id,
            pj.status as status,
            COALESCE(pj.vector_status, 'null') as vector_status,  -- Return 'null' for NULL values
            COALESCE(pj.lineage_status, 'null') as lineage_status, -- Return 'null' for NULL values
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
COMMENT ON FUNCTION code_insights.lease_processing_job IS 'Fixed lease function for TRUE sequential processing - only updates the specific status being processed, preventing parallel processing'; 