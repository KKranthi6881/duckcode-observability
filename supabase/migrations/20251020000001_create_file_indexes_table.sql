-- Migration: Create file_indexes table for code file indexing
-- This stores metadata about Tantivy file indexes (code search)
-- Separate from tantivy_indexes (metadata search)

CREATE TABLE IF NOT EXISTS metadata.file_indexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL,
    repository_name TEXT NOT NULL,
    
    -- Index metadata
    version INTEGER NOT NULL DEFAULT 1,
    document_count INTEGER NOT NULL DEFAULT 0,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    index_path TEXT NOT NULL, -- Storage path: "tantivy-indexes/{org-id}/files"
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rebuilding', 'error', 'archived')),
    error_message TEXT,
    
    -- Timestamps
    last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_org_repo_file_index UNIQUE(organization_id, repository_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_indexes_org ON metadata.file_indexes(organization_id);
CREATE INDEX IF NOT EXISTS idx_file_indexes_repo ON metadata.file_indexes(repository_id);
CREATE INDEX IF NOT EXISTS idx_file_indexes_status ON metadata.file_indexes(status);
CREATE INDEX IF NOT EXISTS idx_file_indexes_last_indexed ON metadata.file_indexes(last_indexed_at DESC);

-- RLS Policies (Row Level Security)
ALTER TABLE metadata.file_indexes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view file indexes for their organization
CREATE POLICY "Users can view file indexes for their org"
    ON metadata.file_indexes
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM duckcode.user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy: Users can manage file indexes for their organization
CREATE POLICY "Users can manage file indexes for their org"
    ON metadata.file_indexes
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM duckcode.user_profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy: Service role has full access (for backend operations)
CREATE POLICY "Service role full access"
    ON metadata.file_indexes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION metadata.update_file_indexes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS file_indexes_updated_at ON metadata.file_indexes;
CREATE TRIGGER file_indexes_updated_at
    BEFORE UPDATE ON metadata.file_indexes
    FOR EACH ROW
    EXECUTE FUNCTION metadata.update_file_indexes_updated_at();

-- Add comments for documentation
COMMENT ON TABLE metadata.file_indexes IS 'Stores metadata about Tantivy file indexes for code search (separate from metadata.tantivy_indexes)';
COMMENT ON COLUMN metadata.file_indexes.organization_id IS 'Organization that owns this file index';
COMMENT ON COLUMN metadata.file_indexes.repository_id IS 'Repository that was indexed';
COMMENT ON COLUMN metadata.file_indexes.repository_name IS 'Name of the repository';
COMMENT ON COLUMN metadata.file_indexes.document_count IS 'Number of files indexed';
COMMENT ON COLUMN metadata.file_indexes.size_bytes IS 'Size of the index in bytes';
COMMENT ON COLUMN metadata.file_indexes.index_path IS 'Path in Supabase Storage where index is stored';
COMMENT ON COLUMN metadata.file_indexes.status IS 'Current status of the index (active, rebuilding, error, archived)';
COMMENT ON COLUMN metadata.file_indexes.last_indexed_at IS 'When the index was last built/updated';

-- Grant necessary permissions
GRANT SELECT ON metadata.file_indexes TO authenticated;
GRANT ALL ON metadata.file_indexes TO service_role;
