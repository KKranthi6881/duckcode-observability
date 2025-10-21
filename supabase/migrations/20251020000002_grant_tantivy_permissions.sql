-- Grant permissions on metadata.tantivy_indexes table to service_role
-- This allows the Tantivy service to insert/update index metadata

-- Grant all permissions to service_role
GRANT ALL ON TABLE metadata.tantivy_indexes TO service_role;
GRANT ALL ON TABLE metadata.tantivy_indexes TO postgres;

-- Grant usage on the schema
GRANT USAGE ON SCHEMA metadata TO service_role;

-- Grant permissions on sequences (for auto-incrementing columns if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA metadata TO service_role;

-- Ensure RLS is disabled for service_role (service_role bypasses RLS by default)
ALTER TABLE metadata.tantivy_indexes FORCE ROW LEVEL SECURITY;
ALTER TABLE metadata.tantivy_indexes ENABLE ROW LEVEL SECURITY;

-- Create policy allowing service_role to do everything
CREATE POLICY service_role_all_access ON metadata.tantivy_indexes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Also grant to authenticated users for read access (if needed for frontend)
CREATE POLICY authenticated_read_access ON metadata.tantivy_indexes
    FOR SELECT
    TO authenticated
    USING (true);

COMMENT ON POLICY service_role_all_access ON metadata.tantivy_indexes 
    IS 'Allow service_role full access to tantivy_indexes table';
COMMENT ON POLICY authenticated_read_access ON metadata.tantivy_indexes 
    IS 'Allow authenticated users to read tantivy_indexes table';
