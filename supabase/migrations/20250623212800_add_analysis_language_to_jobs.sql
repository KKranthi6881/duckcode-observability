-- Add analysis_language column to processing_jobs table
-- This will store the user's selected language from the frontend dropdown
-- to ensure language-specific prompts are used during batch processing

ALTER TABLE code_insights.processing_jobs 
ADD COLUMN analysis_language TEXT DEFAULT 'default';

COMMENT ON COLUMN code_insights.processing_jobs.analysis_language 
IS 'User-selected language for AI analysis (e.g., postgres, dbt, python, etc.). Determines which specialized prompt to use in the edge function.';

-- Update existing jobs to have default language
UPDATE code_insights.processing_jobs 
SET analysis_language = 'default' 
WHERE analysis_language IS NULL;
