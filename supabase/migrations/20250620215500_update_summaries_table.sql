-- supabase/migrations/20250620215500_update_summaries_table.sql

ALTER TABLE code_insights.code_summaries
ADD COLUMN llm_provider VARCHAR(255),
ADD COLUMN llm_model_name VARCHAR(255),
ADD COLUMN prompt_template_id UUID REFERENCES code_insights.prompt_templates(id);

COMMENT ON COLUMN code_insights.code_summaries.llm_provider IS 'The provider of the language model used for the summary (e.g., openai, google).';
COMMENT ON COLUMN code_insights.code_summaries.llm_model_name IS 'The specific model name used for the summary (e.g., gpt-4, gemini-pro).';
COMMENT ON COLUMN code_insights.code_summaries.prompt_template_id IS 'Foreign key to the prompt template used for this summary.';
