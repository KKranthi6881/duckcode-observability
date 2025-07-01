-- Add lineage status tracking to processing_jobs table
ALTER TABLE code_insights.processing_jobs 
ADD COLUMN IF NOT EXISTS lineage_status TEXT DEFAULT 'pending' CHECK (lineage_status IN ('pending', 'processing', 'completed', 'failed'));

-- Create index for lineage status queries
CREATE INDEX IF NOT EXISTS idx_processing_jobs_lineage_status ON code_insights.processing_jobs(lineage_status); 