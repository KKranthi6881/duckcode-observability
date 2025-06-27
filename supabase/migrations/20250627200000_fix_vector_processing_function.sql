-- Fix the update_vector_processing_status function parameter name ambiguity
-- The original function had a parameter named 'error_details' which conflicts with the column name
-- This causes "column reference 'error_details' is ambiguous" errors

-- Drop and recreate the function with unambiguous parameter names
DROP FUNCTION IF EXISTS code_insights.update_vector_processing_status(UUID, TEXT, INT, TEXT);

CREATE OR REPLACE FUNCTION code_insights.update_vector_processing_status(
    job_id_param UUID,
    new_status TEXT,
    chunks_count INTEGER DEFAULT NULL,
    error_details_param TEXT DEFAULT NULL
) 
RETURNS VOID AS $$
BEGIN
    UPDATE code_insights.processing_jobs
    SET 
        vector_status = new_status,
        vector_chunks_count = COALESCE(chunks_count, vector_chunks_count),
        vector_error_details = error_details_param,
        vector_processed_at = CASE WHEN new_status = 'completed' THEN now() ELSE vector_processed_at END,
        updated_at = now()
    WHERE id = job_id_param;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION code_insights.update_vector_processing_status TO service_role;

-- Add comment explaining the fix
COMMENT ON FUNCTION code_insights.update_vector_processing_status IS 'Updates the vector processing status for a job. Fixed parameter naming to avoid ambiguity with column names.'; 