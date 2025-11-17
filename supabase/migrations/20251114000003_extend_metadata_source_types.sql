-- Extend metadata.objects.source_type to support new connector sources
-- such as airflow, tableau, power_bi, while preserving existing values

BEGIN;

-- Drop existing CHECK constraint(s) on metadata.objects.source_type only
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM   pg_constraint c
    JOIN   pg_attribute a
           ON a.attrelid = c.conrelid
          AND a.attnum = ANY (c.conkey)
    WHERE  c.conrelid = 'metadata.objects'::regclass
    AND    c.contype = 'c'
    AND    a.attname = 'source_type'
  LOOP
    EXECUTE format('ALTER TABLE metadata.objects DROP CONSTRAINT %I', r.conname);
  END LOOP;
END$$;

-- Re-add a permissive CHECK constraint for source_type
ALTER TABLE metadata.objects
  ADD CONSTRAINT objects_source_type_check
  CHECK (source_type IS NULL OR source_type IN (
    'dbt',
    'snowflake',
    'bigquery',
    'redshift',
    'postgres',
    'mysql',
    'airflow',
    'tableau',
    'power_bi',
    'github'
  ));

COMMIT;
