-- Extend connector types to support Airflow and Power BI
-- and re-add explicit CHECK constraints for type and status

BEGIN;

-- Drop existing CHECK constraints on enterprise.connectors (type/status)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'enterprise.connectors'::regclass
    AND    contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE enterprise.connectors DROP CONSTRAINT %I', r.conname);
  END LOOP;
END$$;

-- Re-create CHECK constraint for connector type with new values
ALTER TABLE enterprise.connectors
  ADD CONSTRAINT connectors_type_check
  CHECK (type IN (
    'snowflake',
    'dbt_cloud',
    'github',
    'gitlab',
    'bigquery',
    'postgresql',
    'mysql',
    'redshift',
    'tableau',
    'looker',
    'databricks',
    'airflow',
    'power_bi'
  ));

-- Re-create CHECK constraint for connector status (unchanged semantics)
ALTER TABLE enterprise.connectors
  ADD CONSTRAINT connectors_status_check
  CHECK (status IN ('active','inactive','error'));

COMMIT;
