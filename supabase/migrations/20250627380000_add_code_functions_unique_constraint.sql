-- Migration: Add unique constraint to code_functions table
-- Description: Add unique constraint on (file_id, function_name) to support upsert operations

-- Add unique constraint to prevent duplicate functions per file
ALTER TABLE code_insights.code_functions 
ADD CONSTRAINT code_functions_file_function_unique 
UNIQUE (file_id, function_name);

-- Create index to support efficient lookups
CREATE INDEX IF NOT EXISTS idx_code_functions_file_function 
ON code_insights.code_functions(file_id, function_name);

-- Comment the constraint
COMMENT ON CONSTRAINT code_functions_file_function_unique ON code_insights.code_functions 
IS 'Ensures unique function names within each file for proper lineage tracking'; 