-- Create sequential processing jobs table in code_insights schema
CREATE TABLE IF NOT EXISTS code_insights.sequential_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_full_name TEXT NOT NULL,
    user_id UUID NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'sequential_metadata',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    current_phase TEXT DEFAULT 'documentation' CHECK (current_phase IN ('documentation', 'vectors', 'lineage', 'dependencies', 'analysis', 'completed')),
    phases JSONB NOT NULL DEFAULT '{
        "documentation": {"status": "pending", "progress": 0},
        "vectors": {"status": "pending", "progress": 0},
        "lineage": {"status": "pending", "progress": 0},
        "dependencies": {"status": "pending", "progress": 0},
        "analysis": {"status": "pending", "progress": 0}
    }',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sequential_jobs_repo_user ON code_insights.sequential_processing_jobs(repository_full_name, user_id);
CREATE INDEX IF NOT EXISTS idx_sequential_jobs_status ON code_insights.sequential_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sequential_jobs_current_phase ON code_insights.sequential_processing_jobs(current_phase);
CREATE INDEX IF NOT EXISTS idx_sequential_jobs_created_at ON code_insights.sequential_processing_jobs(created_at DESC);

-- Add RLS policies
ALTER TABLE code_insights.sequential_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own processing jobs
CREATE POLICY "Users can view their own sequential processing jobs" ON code_insights.sequential_processing_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own processing jobs
CREATE POLICY "Users can create their own sequential processing jobs" ON code_insights.sequential_processing_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own processing jobs
CREATE POLICY "Users can update their own sequential processing jobs" ON code_insights.sequential_processing_jobs
    FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sequential_processing_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_sequential_processing_jobs_updated_at
    BEFORE UPDATE ON code_insights.sequential_processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_sequential_processing_jobs_updated_at();

-- Grant permissions to service_role and authenticated users
GRANT SELECT, INSERT, UPDATE ON code_insights.sequential_processing_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE ON code_insights.sequential_processing_jobs TO authenticated; 