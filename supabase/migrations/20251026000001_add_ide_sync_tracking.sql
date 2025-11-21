-- =====================================================
-- IDE SYNC TRACKING
-- Track IDE sync sessions and metadata synchronization
-- Date: 2025-10-26
-- =====================================================

-- Track IDE sync sessions
CREATE TABLE IF NOT EXISTS metadata.ide_sync_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    workspace_identifier TEXT NOT NULL,
    workspace_hash TEXT,
    ide_version TEXT,
    sync_mode TEXT DEFAULT 'workspace-aware', -- workspace-aware, manual, sync-all
    connection_ids UUID[], -- Array of connection IDs that were synced
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status TEXT DEFAULT 'active', -- active, inactive, error
    total_objects_synced INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for IDE sync sessions
CREATE INDEX IF NOT EXISTS idx_ide_sessions_org ON metadata.ide_sync_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ide_sessions_workspace ON metadata.ide_sync_sessions(workspace_identifier);
CREATE INDEX IF NOT EXISTS idx_ide_sessions_last_sync ON metadata.ide_sync_sessions(last_sync_at);

-- Enable RLS for IDE sync sessions
ALTER TABLE metadata.ide_sync_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access sync sessions for their organization
CREATE POLICY metadata_ide_sync_sessions_org_isolation ON metadata.ide_sync_sessions
    FOR ALL USING (organization_id IN (
        SELECT organization_id 
        FROM enterprise.user_organization_roles 
        WHERE user_id = auth.uid()
    ));

-- Grant permissions
GRANT ALL ON metadata.ide_sync_sessions TO authenticated;

-- Update trigger for ide_sync_sessions
CREATE OR REPLACE TRIGGER update_ide_sync_sessions_updated_at
    BEFORE UPDATE ON metadata.ide_sync_sessions
    FOR EACH ROW 
    EXECUTE FUNCTION update_metadata_updated_at();

-- Helper function to register or update IDE sync session
CREATE OR REPLACE FUNCTION metadata.upsert_ide_sync_session(
    p_organization_id UUID,
    p_workspace_identifier TEXT,
    p_workspace_hash TEXT,
    p_ide_version TEXT,
    p_sync_mode TEXT,
    p_connection_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Try to find existing session
    SELECT id INTO v_session_id
    FROM metadata.ide_sync_sessions
    WHERE organization_id = p_organization_id
      AND workspace_identifier = p_workspace_identifier;
    
    IF v_session_id IS NULL THEN
        -- Create new session
        INSERT INTO metadata.ide_sync_sessions (
            organization_id,
            workspace_identifier,
            workspace_hash,
            ide_version,
            sync_mode,
            connection_ids,
            last_sync_at
        ) VALUES (
            p_organization_id,
            p_workspace_identifier,
            p_workspace_hash,
            p_ide_version,
            p_sync_mode,
            p_connection_ids,
            NOW()
        )
        RETURNING id INTO v_session_id;
    ELSE
        -- Update existing session
        UPDATE metadata.ide_sync_sessions
        SET 
            workspace_hash = p_workspace_hash,
            ide_version = p_ide_version,
            sync_mode = p_sync_mode,
            connection_ids = p_connection_ids,
            last_sync_at = NOW(),
            sync_status = 'active'
        WHERE id = v_session_id;
    END IF;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to update sync statistics
CREATE OR REPLACE FUNCTION metadata.update_sync_statistics(
    p_session_id UUID,
    p_objects_synced INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE metadata.ide_sync_sessions
    SET 
        total_objects_synced = p_objects_synced,
        last_sync_at = NOW(),
        updated_at = NOW()
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get sync status for workspace
CREATE OR REPLACE FUNCTION metadata.get_workspace_sync_status(
    p_organization_id UUID,
    p_workspace_identifier TEXT
)
RETURNS TABLE (
    session_id UUID,
    last_sync_at TIMESTAMPTZ,
    total_objects_synced INTEGER,
    connection_ids UUID[],
    sync_mode TEXT,
    sync_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.last_sync_at,
        s.total_objects_synced,
        s.connection_ids,
        s.sync_mode,
        s.sync_status
    FROM metadata.ide_sync_sessions s
    WHERE s.organization_id = p_organization_id
      AND s.workspace_identifier = p_workspace_identifier
    ORDER BY s.last_sync_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE metadata.ide_sync_sessions IS 'Tracks IDE sync sessions for workspace metadata synchronization';
COMMENT ON FUNCTION metadata.upsert_ide_sync_session IS 'Register or update an IDE sync session for a workspace';
COMMENT ON FUNCTION metadata.update_sync_statistics IS 'Update sync statistics after a sync operation completes';
COMMENT ON FUNCTION metadata.get_workspace_sync_status IS 'Get the current sync status for a workspace';
