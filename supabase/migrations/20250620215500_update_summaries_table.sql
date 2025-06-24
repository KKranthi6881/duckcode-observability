-- supabase/migrations/20250620215500_update_summaries_table.sql

/*
ALTER TABLE code_insights.code_summaries
ADD COLUMN llm_provider VARCHAR(255),
ADD COLUMN llm_model_name VARCHAR(255);

COMMENT ON COLUMN code_insights.code_summaries.llm_provider IS 'The provider of the language model used for the summary (e.g., openai, google).';
COMMENT ON COLUMN code_insights.code_summaries.llm_model_name IS 'The specific model name used for the summary (e.g., gpt-4, gemini-pro).';
*/

-- Remove prompt_template_id from processing_jobs table since we now use embedded prompts
ALTER TABLE code_insights.processing_jobs 
DROP COLUMN IF EXISTS prompt_template_id;

-- Remove prompt_template_id from code_summaries table since we no longer use database prompts
ALTER TABLE code_insights.code_summaries 
DROP COLUMN IF EXISTS prompt_template_id;

-- Drop the prompt_templates table entirely since we use embedded prompts in the edge function
DROP TABLE IF EXISTS code_insights.prompt_templates;

-- Add comment to document the change
COMMENT ON TABLE code_insights.processing_jobs IS 'Queue for processing code files using embedded prompts in the edge function. No longer requires prompt templates from database.';
COMMENT ON TABLE code_insights.code_summaries IS 'Stores AI-generated summaries using embedded language-specific prompts.';
