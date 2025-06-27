-- Add vector processing status tracking to existing jobs
ALTER TABLE code_insights.processing_jobs 
ADD COLUMN vector_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed, skipped
ADD COLUMN vector_chunks_count INT DEFAULT 0,
ADD COLUMN vector_error_details TEXT,
ADD COLUMN vector_processed_at TIMESTAMPTZ;

-- Add index for vector status queries
CREATE INDEX idx_jobs_vector_status ON code_insights.processing_jobs(vector_status);

-- Add comments
COMMENT ON COLUMN code_insights.processing_jobs.vector_status IS 'Status of vector embedding generation: pending, processing, completed, failed, skipped';
COMMENT ON COLUMN code_insights.processing_jobs.vector_chunks_count IS 'Number of vector chunks generated for this file';
COMMENT ON COLUMN code_insights.processing_jobs.vector_error_details IS 'Error details if vector processing failed';
COMMENT ON COLUMN code_insights.processing_jobs.vector_processed_at IS 'Timestamp when vector processing completed';

-- Create a function to get comprehensive processing status including vectors
CREATE OR REPLACE FUNCTION code_insights.get_repository_processing_status(
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
    overall_completed BIGINT,
    overall_progress NUMERIC,
    file_details JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH file_stats AS (
        SELECT 
            f.id,
            f.file_path,
            f.parsing_status,
            COALESCE(pj.status, 'pending') as doc_status,
            COALESCE(pj.vector_status, 'pending') as vec_status,
            pj.error_details,
            pj.vector_error_details,
            pj.vector_chunks_count,
            -- Consider overall status: both doc and vector must be completed
            CASE 
                WHEN COALESCE(pj.status, 'pending') = 'completed' AND COALESCE(pj.vector_status, 'pending') = 'completed' THEN 'completed'
                WHEN COALESCE(pj.status, 'pending') = 'failed' OR COALESCE(pj.vector_status, 'pending') = 'failed' THEN 'failed'
                ELSE 'pending'
            END as overall_status
        FROM code_insights.files f
        LEFT JOIN code_insights.processing_jobs pj ON f.id = pj.file_id
        WHERE f.repository_full_name = repo_full_name 
        AND f.user_id = user_id_param
    ),
    aggregated_stats AS (
        SELECT 
            COUNT(*) as total_files,
            COUNT(*) FILTER (WHERE doc_status = 'completed') as documentation_completed,
            COUNT(*) FILTER (WHERE doc_status = 'failed') as documentation_failed,
            COUNT(*) FILTER (WHERE doc_status = 'pending' OR doc_status = 'processing') as documentation_pending,
            COUNT(*) FILTER (WHERE vec_status = 'completed') as vector_completed,
            COUNT(*) FILTER (WHERE vec_status = 'failed') as vector_failed,
            COUNT(*) FILTER (WHERE vec_status = 'pending' OR vec_status = 'processing') as vector_pending,
            COUNT(*) FILTER (WHERE overall_status = 'completed') as overall_completed,
            jsonb_agg(
                jsonb_build_object(
                    'filePath', file_path,
                    'docStatus', doc_status,
                    'vectorStatus', vec_status,
                    'overallStatus', overall_status,
                    'docError', error_details,
                    'vectorError', vector_error_details,
                    'vectorChunks', vector_chunks_count
                ) ORDER BY file_path
            ) as file_details
        FROM file_stats
    )
    SELECT 
        s.total_files,
        s.documentation_completed,
        s.documentation_failed,
        s.documentation_pending,
        s.vector_completed,
        s.vector_failed,
        s.vector_pending,
        s.overall_completed,
        CASE 
            WHEN s.total_files > 0 THEN ROUND((s.overall_completed::NUMERIC / s.total_files::NUMERIC) * 100, 2)
            ELSE 0
        END as overall_progress,
        s.file_details
    FROM aggregated_stats s;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION code_insights.get_repository_processing_status TO service_role;

-- Create a function to update vector processing status
CREATE OR REPLACE FUNCTION code_insights.update_vector_processing_status(
    job_id_param UUID,
    new_status TEXT,
    chunks_count INT DEFAULT NULL,
    error_details TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE code_insights.processing_jobs
    SET 
        vector_status = new_status,
        vector_chunks_count = COALESCE(chunks_count, vector_chunks_count),
        vector_error_details = error_details,
        vector_processed_at = CASE WHEN new_status = 'completed' THEN now() ELSE vector_processed_at END,
        updated_at = now()
    WHERE id = job_id_param;
END;
$$;

-- Grant execute permission on the update function
GRANT EXECUTE ON FUNCTION code_insights.update_vector_processing_status TO service_role; 