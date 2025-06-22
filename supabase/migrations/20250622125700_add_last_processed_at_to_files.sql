-- Add the last_processed_at column to the files table
ALTER TABLE code_insights.files
ADD COLUMN last_processed_at TIMESTAMPTZ;

COMMENT ON COLUMN code_insights.files.last_processed_at IS 'Timestamp of when the file was last successfully processed by the code-processor.';
