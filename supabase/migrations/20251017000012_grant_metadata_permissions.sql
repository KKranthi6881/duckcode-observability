-- Grant permissions on metadata schema
GRANT USAGE ON SCHEMA metadata TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA metadata TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA metadata TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA metadata TO service_role, authenticated;

-- Grant permissions on enterprise schema
GRANT USAGE ON SCHEMA enterprise TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA enterprise TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA enterprise TO service_role;

-- Grant permissions on metadata_extraction_jobs (public schema)
GRANT INSERT, UPDATE, DELETE ON metadata_extraction_jobs TO service_role, authenticated;

-- Ensure future objects also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA metadata GRANT SELECT ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA metadata GRANT INSERT, UPDATE, DELETE ON TABLES TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA metadata GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA enterprise GRANT SELECT ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA enterprise GRANT INSERT, UPDATE, DELETE ON TABLES TO service_role;
