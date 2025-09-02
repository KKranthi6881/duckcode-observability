-- Migration: Add repository_dependency_analysis table for storing comprehensive dependency and impact analysis
-- Description: Table to store cross-file dependencies and impact analysis for advanced processing phases

CREATE TABLE IF NOT EXISTS code_insights.repository_dependency_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_full_name TEXT NOT NULL,
    user_id UUID NOT NULL,
    analysis_type TEXT NOT NULL, -- 'cross_file_dependencies' or 'impact_analysis'
    dependency_graph JSONB NOT NULL, -- Comprehensive dependency graph and analysis data
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(repository_full_name, user_id, analysis_type)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_repo_dependency_analysis_repo_user 
ON code_insights.repository_dependency_analysis(repository_full_name, user_id);

CREATE INDEX IF NOT EXISTS idx_repo_dependency_analysis_type 
ON code_insights.repository_dependency_analysis(analysis_type);

CREATE INDEX IF NOT EXISTS idx_repo_dependency_analysis_created 
ON code_insights.repository_dependency_analysis(created_at);

-- Add RLS policies
ALTER TABLE code_insights.repository_dependency_analysis ENABLE ROW LEVEL SECURITY;

-- Users can only access their own repository analysis
CREATE POLICY "Users can view their own repository dependency analysis" 
ON code_insights.repository_dependency_analysis FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own repository dependency analysis" 
ON code_insights.repository_dependency_analysis FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own repository dependency analysis" 
ON code_insights.repository_dependency_analysis FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON code_insights.repository_dependency_analysis TO authenticated;
GRANT ALL ON code_insights.repository_dependency_analysis TO service_role;

-- Add comment
COMMENT ON TABLE code_insights.repository_dependency_analysis IS 'Stores comprehensive dependency graphs and impact analysis for repositories'; 