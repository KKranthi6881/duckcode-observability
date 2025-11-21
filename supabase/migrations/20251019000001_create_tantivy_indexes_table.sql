-- Create tantivy_indexes table to track search index metadata
CREATE TABLE IF NOT EXISTS metadata.tantivy_indexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    document_count INTEGER NOT NULL DEFAULT 0,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    index_path TEXT NOT NULL, -- Supabase Storage path
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'building', 'failed')),
    last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tantivy_indexes_org_id ON metadata.tantivy_indexes(organization_id);
CREATE INDEX IF NOT EXISTS idx_tantivy_indexes_status ON metadata.tantivy_indexes(status);

-- Ensure only one active index per organization (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tantivy_indexes_org_active 
    ON metadata.tantivy_indexes(organization_id) 
    WHERE status = 'active';

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION metadata.update_tantivy_indexes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tantivy_indexes_updated_at
    BEFORE UPDATE ON metadata.tantivy_indexes
    FOR EACH ROW
    EXECUTE FUNCTION metadata.update_tantivy_indexes_updated_at();

-- Add comments
COMMENT ON TABLE metadata.tantivy_indexes IS 'Tracks Tantivy search index metadata for each organization';
COMMENT ON COLUMN metadata.tantivy_indexes.organization_id IS 'Organization that owns this index';
COMMENT ON COLUMN metadata.tantivy_indexes.version IS 'Index version number (increments on rebuild)';
COMMENT ON COLUMN metadata.tantivy_indexes.document_count IS 'Number of documents in the index';
COMMENT ON COLUMN metadata.tantivy_indexes.size_bytes IS 'Total size of index in bytes';
COMMENT ON COLUMN metadata.tantivy_indexes.index_path IS 'Path in Supabase Storage (e.g., tantivy-indexes/{org-id}/)';
COMMENT ON COLUMN metadata.tantivy_indexes.status IS 'Index status: active, building, or failed';
COMMENT ON COLUMN metadata.tantivy_indexes.last_indexed_at IS 'When the index was last successfully built';
