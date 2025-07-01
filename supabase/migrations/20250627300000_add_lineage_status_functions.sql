-- Migration: Add lineage processing status functions
-- Description: Add RPC functions to update and track lineage processing status in the processing workflow

-- Function to update lineage processing status
CREATE OR REPLACE FUNCTION code_insights.update_lineage_processing_status(
    job_id_param UUID,
    new_status TEXT,
    dependencies_extracted JSONB DEFAULT NULL,
    assets_discovered JSONB DEFAULT NULL,
    confidence_score DECIMAL DEFAULT NULL,
    error_details TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE code_insights.processing_jobs
    SET 
        lineage_status = new_status,
        lineage_processed_at = CASE 
            WHEN new_status IN ('completed', 'failed') THEN NOW() 
            ELSE lineage_processed_at 
        END,
        lineage_dependencies_extracted = COALESCE(dependencies_extracted, lineage_dependencies_extracted),
        lineage_assets_discovered = COALESCE(assets_discovered, lineage_assets_discovered),
        lineage_confidence_score = COALESCE(confidence_score, lineage_confidence_score),
        lineage_error_details = CASE 
            WHEN new_status = 'failed' THEN error_details 
            WHEN new_status = 'completed' THEN NULL
            ELSE lineage_error_details 
        END,
        lineage_retry_count = CASE
            WHEN new_status = 'processing' AND lineage_status = 'failed' THEN COALESCE(lineage_retry_count, 0) + 1
            ELSE COALESCE(lineage_retry_count, 0)
        END,
        updated_at = NOW()
    WHERE id = job_id_param;
    
    -- Log the status update
    RAISE INFO 'Updated lineage processing status for job % to %', job_id_param, new_status;
END;
$$;

-- Function to get comprehensive repository processing status including lineage
CREATE OR REPLACE FUNCTION code_insights.get_comprehensive_repository_status(
    repo_full_name TEXT,
    user_id_param UUID
)
RETURNS TABLE (
    total_files BIGINT,
    documentation_completed BIGINT,
    documentation_failed BIGINT,
    documentation_pending BIGINT,
    vector_completed BIGINT,
    vector_failed BIGINT,
    vector_pending BIGINT,
    lineage_completed BIGINT,
    lineage_failed BIGINT,
    lineage_pending BIGINT,
    lineage_eligible BIGINT,
    overall_completed BIGINT,
    overall_progress DECIMAL,
    documentation_progress DECIMAL,
    vector_progress DECIMAL,
    lineage_progress DECIMAL,
    file_details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH file_status AS (
        SELECT 
            f.id,
            f.file_path,
            f.language,
            COALESCE(pj.status, 'pending') as doc_status,
            COALESCE(pj.vector_status, 'pending') as vector_status,
            pj.lineage_status,
            pj.error_message as doc_error,
            pj.vector_error_details as vector_error,
            pj.lineage_error_details as lineage_error,
            pj.vector_chunks_count,
            pj.lineage_confidence_score,
            -- Determine if lineage processing is applicable
            CASE 
                WHEN (f.language ILIKE '%sql%' OR 
                      f.language ILIKE '%postgres%' OR 
                      f.language ILIKE '%mysql%' OR 
                      f.language ILIKE '%snowflake%' OR 
                      f.language ILIKE '%bigquery%' OR 
                      f.language ILIKE '%redshift%' OR 
                      f.file_path ILIKE '%.sql') 
                THEN true 
                ELSE false 
            END as is_lineage_eligible,
            -- Overall status calculation
            CASE 
                WHEN pj.status = 'completed' AND 
                     pj.vector_status = 'completed' AND 
                     (pj.lineage_status IS NULL OR pj.lineage_status = 'completed')
                THEN 'completed'
                WHEN pj.status = 'failed' OR pj.vector_status = 'failed' OR pj.lineage_status = 'failed'
                THEN 'failed'
                ELSE 'pending'
            END as overall_status
        FROM code_insights.files f
        LEFT JOIN code_insights.processing_jobs pj ON f.id = pj.file_id
        WHERE f.repository_full_name = repo_full_name 
          AND f.user_id = user_id_param
    )
    SELECT 
        COUNT(*)::BIGINT as total_files,
        COUNT(*) FILTER (WHERE doc_status = 'completed')::BIGINT as documentation_completed,
        COUNT(*) FILTER (WHERE doc_status = 'failed')::BIGINT as documentation_failed,
        COUNT(*) FILTER (WHERE doc_status = 'pending')::BIGINT as documentation_pending,
        COUNT(*) FILTER (WHERE vector_status = 'completed')::BIGINT as vector_completed,
        COUNT(*) FILTER (WHERE vector_status = 'failed')::BIGINT as vector_failed,
        COUNT(*) FILTER (WHERE vector_status = 'pending')::BIGINT as vector_pending,
        COUNT(*) FILTER (WHERE lineage_status = 'completed')::BIGINT as lineage_completed,
        COUNT(*) FILTER (WHERE lineage_status = 'failed')::BIGINT as lineage_failed,
        COUNT(*) FILTER (WHERE lineage_status = 'pending')::BIGINT as lineage_pending,
        COUNT(*) FILTER (WHERE is_lineage_eligible = true)::BIGINT as lineage_eligible,
        COUNT(*) FILTER (WHERE overall_status = 'completed')::BIGINT as overall_completed,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE overall_status = 'completed'))::DECIMAL / COUNT(*) * 100, 2)
            ELSE 0 
        END as overall_progress,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE doc_status = 'completed'))::DECIMAL / COUNT(*) * 100, 2)
            ELSE 0 
        END as documentation_progress,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE vector_status = 'completed'))::DECIMAL / COUNT(*) * 100, 2)
            ELSE 0 
        END as vector_progress,
        CASE 
            WHEN COUNT(*) FILTER (WHERE is_lineage_eligible = true) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE lineage_status = 'completed'))::DECIMAL / COUNT(*) FILTER (WHERE is_lineage_eligible = true) * 100, 2)
            ELSE 0 
        END as lineage_progress,
        JSONB_AGG(
            JSONB_BUILD_OBJECT(
                'filePath', file_path,
                'language', language,
                'docStatus', doc_status,
                'vectorStatus', vector_status,
                'lineageStatus', lineage_status,
                'overallStatus', overall_status,
                'docError', doc_error,
                'vectorError', vector_error,
                'lineageError', lineage_error,
                'vectorChunks', vector_chunks_count,
                'lineageConfidence', lineage_confidence_score,
                'isLineageEligible', is_lineage_eligible
            )
        ) as file_details
    FROM file_status;
END;
$$;

-- Function to retry failed lineage processing
CREATE OR REPLACE FUNCTION code_insights.retry_lineage_processing(
    repo_full_name TEXT,
    user_id_param UUID
)
RETURNS TABLE (
    jobs_reset BIGINT,
    file_paths TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    reset_count BIGINT;
    reset_files TEXT[];
BEGIN
    -- Find and reset failed lineage processing jobs
    WITH reset_jobs AS (
        UPDATE code_insights.processing_jobs pj
        SET 
            lineage_status = 'pending',
            lineage_error_details = NULL,
            lineage_processed_at = NULL,
            updated_at = NOW()
        FROM code_insights.files f
        WHERE pj.file_id = f.id
          AND f.repository_full_name = repo_full_name
          AND f.user_id = user_id_param
          AND pj.status = 'completed' -- Only retry for files with completed documentation
          AND pj.lineage_status = 'failed'
        RETURNING pj.file_id, f.file_path
    )
    SELECT 
        COUNT(*),
        ARRAY_AGG(file_path)
    INTO reset_count, reset_files
    FROM reset_jobs;
    
    RETURN QUERY SELECT reset_count, COALESCE(reset_files, ARRAY[]::TEXT[]);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION code_insights.update_lineage_processing_status TO service_role;
GRANT EXECUTE ON FUNCTION code_insights.get_comprehensive_repository_status TO service_role;
GRANT EXECUTE ON FUNCTION code_insights.retry_lineage_processing TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION code_insights.update_lineage_processing_status IS 'Updates lineage processing status for a specific job with metadata';
COMMENT ON FUNCTION code_insights.get_comprehensive_repository_status IS 'Returns comprehensive processing status including lineage for a repository';
COMMENT ON FUNCTION code_insights.retry_lineage_processing IS 'Resets failed lineage processing jobs to pending status for retry'; 