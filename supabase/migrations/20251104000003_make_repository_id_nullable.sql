-- =====================================================
-- Make repository_id nullable for Snowflake objects
-- Snowflake objects don't have repositories
-- =====================================================

BEGIN;

-- Make repository_id nullable
ALTER TABLE metadata.objects 
  ALTER COLUMN repository_id DROP NOT NULL;

-- Clear repository_id for Snowflake objects
UPDATE metadata.objects 
SET repository_id = NULL 
WHERE source_type = 'snowflake' AND repository_id IS NOT NULL;

COMMIT;
