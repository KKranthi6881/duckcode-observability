-- Add unique constraint to processing_jobs to prevent duplicate jobs for the same file
-- This ensures that each file can only have one processing job

-- Check if the table exists before proceeding
DO $$
BEGIN
    -- Only proceed if the processing_jobs table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'code_insights' 
        AND table_name = 'processing_jobs'
    ) THEN
        -- First, remove any existing duplicates (keep the oldest job for each file)
        WITH ranked_jobs AS (
          SELECT 
            id,
            file_id,
            ROW_NUMBER() OVER (PARTITION BY file_id ORDER BY created_at ASC) as rn
          FROM code_insights.processing_jobs
        ),
        jobs_to_delete AS (
          SELECT id
          FROM ranked_jobs
          WHERE rn > 1
        )
        DELETE FROM code_insights.processing_jobs
        WHERE id IN (SELECT id FROM jobs_to_delete);

        -- Add the unique constraint if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'code_insights' 
            AND table_name = 'processing_jobs' 
            AND constraint_name = 'unique_processing_job_per_file'
        ) THEN
            ALTER TABLE code_insights.processing_jobs 
            ADD CONSTRAINT unique_processing_job_per_file 
            UNIQUE (file_id);
            
            -- Add comment explaining the constraint
            COMMENT ON CONSTRAINT unique_processing_job_per_file ON code_insights.processing_jobs 
            IS 'Ensures each file can only have one processing job to prevent duplication';
            
            RAISE NOTICE 'Added unique constraint to processing_jobs table';
        ELSE
            RAISE NOTICE 'Unique constraint already exists on processing_jobs table';
        END IF;
    ELSE
        RAISE NOTICE 'processing_jobs table does not exist, skipping migration';
    END IF;
END $$; 