-- supabase/migrations/20250620181500_add_github_installations.sql

-- Create a table to store GitHub App installation IDs linked to users.
CREATE TABLE code_insights.github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    installation_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_id UNIQUE (user_id)
);

-- Add comments for clarity
COMMENT ON TABLE code_insights.github_installations IS 'Stores GitHub App installation details for each user.';
COMMENT ON COLUMN code_insights.github_installations.user_id IS 'Foreign key to the authenticated user.';
COMMENT ON COLUMN code_insights.github_installations.installation_id IS 'The ID of the GitHub App installation.';

-- Enable Row-Level Security
ALTER TABLE code_insights.github_installations ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE code_insights.github_installations TO service_role;
GRANT ALL ON TABLE code_insights.github_installations TO postgres;

-- Policies for service access
CREATE POLICY "Allow service_role to access all installations"
ON code_insights.github_installations FOR ALL
TO service_role
USING (true);


-- supabase/migrations/20250620195400_add_retry_count_to_jobs.sql

ALTER TABLE code_insights.processing_jobs
ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN code_insights.processing_jobs.retry_count IS 'The number of times this job has been attempted.';

ALTER TABLE code_insights.processing_jobs
ADD COLUMN IF NOT EXISTS leased_at TIMESTAMPTZ;

COMMENT ON COLUMN code_insights.processing_jobs.leased_at IS 'Timestamp when the job was leased by a worker.';


/*
curl -i -X POST http://localhost:54321/functions/v1/code-processor \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Content-Type: application/json" \
  -d '{}'

  curl -X POST http://localhost:3001/api/insights/process-repository \
-H "Content-Type: application/json" \
-H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwOi8vMTI3LjAuMC4xOjU0MzIxL2F1dGgvdjEiLCJzdWIiOiI4MzM2NGZhMS1hNjViLTRlMDItYTY1NS01NzA5YWYxZDBjZWUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzUwNTMyOTIwLCJpYXQiOjE3NTA1MjkzMjAsImVtYWlsIjoia29uZGFwYWthLmFpQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJrb25kYXBha2EuYWlAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiODMzNjRmYTEtYTY1Yi00ZTAyLWE2NTUtNTcwOWFmMWQwY2VlIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NTA1MjkzMjB9XSwic2Vzc2lvbl9pZCI6IjI1MzVmYzgzLTEwOWItNGI1Zi1iNGI5LTkzNDYwNGFjODNjOSIsImlzX2Fub255bW91cyI6ZmFsc2V9.SegCg88BdXEKvBCnjFYaiovZyGVY9OPeWnZblpx9z-A" \
-d '{
  "repositoryFullName": "KKranthi6881/AIGents-dbt-snowflake"
}' */

