-- supabase/migrations/YYYYMMDDHHMMSS_setup_code_processor.sql

-- 1. Add github_installation_id to files table
ALTER TABLE code_insights.files
ADD COLUMN IF NOT EXISTS github_installation_id BIGINT;

COMMENT ON COLUMN code_insights.files.github_installation_id IS 'The GitHub App installation ID associated with this repository/file.';

/*
-- 2. Add LLM configuration columns to prompt_templates table
ALTER TABLE code_insights.prompt_templates
ADD COLUMN IF NOT EXISTS llm_provider TEXT,
ADD COLUMN IF NOT EXISTS llm_model_name TEXT,
ADD COLUMN IF NOT EXISTS llm_parameters JSONB;

COMMENT ON COLUMN code_insights.prompt_templates.llm_provider IS 'The LLM provider to use (e.g., openai, google, anthropic).';
COMMENT ON COLUMN code_insights.prompt_templates.llm_model_name IS 'The specific model name for the LLM provider.';
COMMENT ON COLUMN code_insights.prompt_templates.llm_parameters IS 'Additional JSON parameters for the LLM API call.';
*/

-- 3. Create lease_processing_job() function
CREATE OR REPLACE FUNCTION code_insights.lease_processing_job()
RETURNS SETOF code_insights.processing_jobs
LANGUAGE plpgsql
AS $$
DECLARE
    job_row code_insights.processing_jobs%ROWTYPE;
BEGIN
    UPDATE code_insights.processing_jobs
    SET 
        status = 'processing', 
        leased_at = NOW(),
        updated_at = NOW()
    WHERE id = (
        SELECT pj.id
        FROM code_insights.processing_jobs pj
        WHERE pj.status = 'pending'
        ORDER BY pj.retry_count ASC, pj.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    RETURNING * INTO job_row;

    IF FOUND THEN
        RETURN NEXT job_row;
    END IF;

    RETURN;
END;
$$;

COMMENT ON FUNCTION code_insights.lease_processing_job() IS 'Atomically leases a pending job from the processing_jobs table, sets its status to ''processing'', and returns the job. Returns empty if no pending job is available.';

GRANT EXECUTE ON FUNCTION code_insights.lease_processing_job() TO service_role;


-- 4. (Optional but recommended) Create increment_job_retry_count function
CREATE OR REPLACE FUNCTION code_insights.increment_job_retry_count(job_id_param uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    new_retry_count integer;
BEGIN
    UPDATE code_insights.processing_jobs
    SET 
        retry_count = retry_count + 1,
        status = 'pending', 
        leased_at = NULL, 
        updated_at = NOW()
    WHERE id = job_id_param
    RETURNING retry_count INTO new_retry_count;
    
    RETURN new_retry_count;
END;
$$;

COMMENT ON FUNCTION code_insights.increment_job_retry_count(uuid) IS 'Increments the retry_count for a given job_id and resets its status to pending.';

GRANT EXECUTE ON FUNCTION code_insights.increment_job_retry_count(uuid) TO service_role;

-- Permissions
GRANT USAGE ON SCHEMA code_insights TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA code_insights TO service_role;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA code_insights TO service_role;

-- Revoke from anon to be safe
REVOKE EXECUTE ON FUNCTION code_insights.lease_processing_job() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION code_insights.increment_job_retry_count(uuid) FROM anon, authenticated;
