-- Migration: Add repository_impact_analysis table for storing Phase 5 impact analysis results

-- Create repository_impact_analysis table
CREATE TABLE IF NOT EXISTS code_insights.repository_impact_analysis (
  id BIGSERIAL PRIMARY KEY,
  repository_full_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_results JSONB NOT NULL DEFAULT '{}',
  analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(repository_full_name, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_repository_impact_analysis_repo_user 
ON code_insights.repository_impact_analysis(repository_full_name, user_id);

CREATE INDEX IF NOT EXISTS idx_repository_impact_analysis_status 
ON code_insights.repository_impact_analysis(status);

CREATE INDEX IF NOT EXISTS idx_repository_impact_analysis_created_at 
ON code_insights.repository_impact_analysis(created_at);

-- Enable RLS
ALTER TABLE code_insights.repository_impact_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own impact analysis" 
ON code_insights.repository_impact_analysis FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own impact analysis" 
ON code_insights.repository_impact_analysis FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own impact analysis" 
ON code_insights.repository_impact_analysis FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON code_insights.repository_impact_analysis TO authenticated;
GRANT ALL ON code_insights.repository_impact_analysis TO service_role;

-- Add comment
COMMENT ON TABLE code_insights.repository_impact_analysis IS 'Stores comprehensive impact analysis results including risk assessment, complexity analysis, and business impact for repositories'; 