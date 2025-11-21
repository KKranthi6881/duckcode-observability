-- =====================================================
-- ENHANCE METADATA SCHEMA FOR MANIFEST SUPPORT
-- Add fields to support dbt manifest.json parsing
-- =====================================================

-- Add manifest support to connections
ALTER TABLE enterprise.github_connections 
ADD COLUMN IF NOT EXISTS manifest_uploaded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS manifest_version TEXT,
ADD COLUMN IF NOT EXISTS manifest_dbt_version TEXT,
ADD COLUMN IF NOT EXISTS extraction_tier TEXT DEFAULT 'BRONZE'; -- GOLD, SILVER, BRONZE

-- Add compiled SQL support to objects
ALTER TABLE metadata.objects
ADD COLUMN IF NOT EXISTS compiled_definition TEXT, -- Compiled SQL from manifest
ADD COLUMN IF NOT EXISTS extracted_from TEXT DEFAULT 'sql_parsing', -- 'manifest', 'sql_parsing', 'local_analysis'
ADD COLUMN IF NOT EXISTS extraction_tier TEXT; -- GOLD, SILVER, BRONZE

-- Update confidence to support manifest accuracy
COMMENT ON COLUMN metadata.objects.confidence IS 'Extraction confidence: 1.0 (manifest), 0.9 (compiled), 0.7 (sql parsing)';

-- Add transformation tracking to column lineage
ALTER TABLE metadata.columns_lineage
ADD COLUMN IF NOT EXISTS extracted_from TEXT DEFAULT 'sql_parsing'; -- 'manifest_parsing', 'compiled_code_parsing', 'sql_parsing'

-- Add workspaces table for IDE sync
CREATE TABLE IF NOT EXISTS metadata.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES enterprise.github_connections(id) ON DELETE SET NULL,
    
    -- Project info
    project_name TEXT NOT NULL,
    project_path_hash TEXT, -- Hash of local path
    
    -- Sync metadata
    last_local_sync TIMESTAMPTZ,
    ide_version TEXT,
    sync_enabled BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, project_path_hash)
);

-- Add workspace_id to objects for IDE sync tracking
ALTER TABLE metadata.objects
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES metadata.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_objects_workspace ON metadata.objects(workspace_id);

-- Enable RLS for workspaces
ALTER TABLE metadata.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY metadata_workspaces_org_isolation ON metadata.workspaces
    FOR ALL USING (organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    ));

-- Grant permissions
GRANT ALL ON metadata.workspaces TO authenticated;

-- Update triggers
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON metadata.workspaces
    FOR EACH ROW EXECUTE FUNCTION update_metadata_updated_at();

-- =====================================================
-- MANIFEST-SPECIFIC VIEWS
-- =====================================================

-- View for manifest-extracted models (GOLD tier)
CREATE OR REPLACE VIEW metadata.manifest_models AS
SELECT 
    o.*,
    f.relative_path,
    f.file_type
FROM metadata.objects o
JOIN metadata.files f ON o.file_id = f.id
WHERE o.extracted_from = 'manifest'
  AND o.extraction_tier = 'GOLD';

-- View for complete column lineage with confidence
CREATE OR REPLACE VIEW metadata.column_lineage_complete AS
SELECT 
    cl.id,
    cl.organization_id,
    so.name AS source_object_name,
    so.full_name AS source_object_full_name,
    cl.source_column,
    to_.name AS target_object_name,
    to_.full_name AS target_object_full_name,
    cl.target_column,
    cl.expression,
    cl.transformation_type,
    cl.confidence,
    cl.extracted_from,
    cl.created_at
FROM metadata.columns_lineage cl
JOIN metadata.objects so ON cl.source_object_id = so.id
JOIN metadata.objects to_ ON cl.target_object_id = to_.id;

GRANT SELECT ON metadata.manifest_models TO authenticated;
GRANT SELECT ON metadata.column_lineage_complete TO authenticated;

-- =====================================================
-- HELPER FUNCTIONS FOR MANIFEST PROCESSING
-- =====================================================

-- Function to mark connection as manifest-uploaded
CREATE OR REPLACE FUNCTION metadata.mark_manifest_uploaded(
    p_connection_id UUID,
    p_manifest_version TEXT,
    p_dbt_version TEXT
)
RETURNS VOID AS $$
BEGIN
    UPDATE enterprise.github_connections
    SET 
        manifest_uploaded = TRUE,
        manifest_version = p_manifest_version,
        manifest_dbt_version = p_dbt_version,
        extraction_tier = 'GOLD',
        updated_at = NOW()
    WHERE id = p_connection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get extraction statistics
CREATE OR REPLACE FUNCTION metadata.get_extraction_stats(p_connection_id UUID)
RETURNS TABLE (
    extraction_tier TEXT,
    total_objects BIGINT,
    total_columns BIGINT,
    total_dependencies BIGINT,
    total_column_lineage BIGINT,
    avg_confidence NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(o.extraction_tier, 'BRONZE') AS extraction_tier,
        COUNT(DISTINCT o.id) AS total_objects,
        COUNT(DISTINCT c.id) AS total_columns,
        COUNT(DISTINCT d.id) AS total_dependencies,
        COUNT(DISTINCT cl.id) AS total_column_lineage,
        ROUND(AVG(o.confidence)::numeric, 2) AS avg_confidence
    FROM metadata.objects o
    LEFT JOIN metadata.columns c ON o.id = c.object_id
    LEFT JOIN metadata.dependencies d ON o.id = d.source_object_id
    LEFT JOIN metadata.columns_lineage cl ON o.id = cl.source_object_id
    WHERE o.connection_id = p_connection_id
    GROUP BY o.extraction_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION metadata.mark_manifest_uploaded IS 'Mark connection as having manifest uploaded with GOLD tier extraction';
COMMENT ON FUNCTION metadata.get_extraction_stats IS 'Get extraction statistics for a connection including tier breakdown';
