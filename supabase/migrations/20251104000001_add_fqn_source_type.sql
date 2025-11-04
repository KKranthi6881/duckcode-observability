-- =====================================================
-- Add FQN and Source Type for Unified Metadata
-- Enables cross-source lineage (dbt + Snowflake)
-- =====================================================

BEGIN;

-- Add FQN (Fully Qualified Name) for cross-source matching
-- Format: DATABASE.SCHEMA.TABLE (uppercase normalized)
ALTER TABLE metadata.objects 
  ADD COLUMN IF NOT EXISTS fqn TEXT;

-- Add source type to distinguish dbt vs Snowflake vs other sources
ALTER TABLE metadata.objects 
  ADD COLUMN IF NOT EXISTS source_type TEXT 
  CHECK (source_type IN ('dbt', 'snowflake', 'bigquery', 'redshift', 'postgres', 'mysql'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_objects_fqn 
  ON metadata.objects(fqn) 
  WHERE fqn IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_objects_source_type 
  ON metadata.objects(source_type) 
  WHERE source_type IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_objects_org_source_type 
  ON metadata.objects(organization_id, source_type);

-- Backfill source_type for existing records
UPDATE metadata.objects 
SET source_type = CASE 
  WHEN connection_id IS NOT NULL THEN 'dbt'
  WHEN connector_id IS NOT NULL THEN 'snowflake'
  ELSE 'dbt'
END
WHERE source_type IS NULL;

-- Build FQN for existing records
-- Handles various combinations of database/schema/name
UPDATE metadata.objects 
SET fqn = UPPER(
  TRIM(
    COALESCE(database_name || '.', '') || 
    COALESCE(schema_name || '.', '') || 
    COALESCE(name, '')
  )
)
WHERE fqn IS NULL AND name IS NOT NULL;

-- Add unique constraint on FQN per organization
-- This prevents duplicate objects across sources
CREATE UNIQUE INDEX IF NOT EXISTS idx_objects_org_fqn_unique
  ON metadata.objects(organization_id, fqn)
  WHERE fqn IS NOT NULL;

COMMIT;
