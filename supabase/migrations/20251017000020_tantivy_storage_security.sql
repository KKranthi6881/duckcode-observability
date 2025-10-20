-- ============================================================================
-- Tantivy V2: Enterprise-Grade Search with Per-Org Isolation
-- ============================================================================
-- 
-- This migration creates:
-- 1. Storage bucket for Tantivy indexes
-- 2. RLS policies for organization-level isolation
-- 3. Audit logging tables
-- 4. Security monitoring functions
--
-- Author: DuckCode Team
-- Date: 2025-10-17
-- ============================================================================

-- ============================================================================
-- 1. Create Storage Bucket for Tantivy Indexes
-- ============================================================================

-- Create bucket (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tantivy-indexes',
  'tantivy-indexes',
  false,  -- Private bucket
  104857600,  -- 100MB per file limit
  ARRAY['application/octet-stream', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. RLS Policies for Organization Isolation
-- ============================================================================

-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "org_isolation_read" ON storage.objects;
DROP POLICY IF EXISTS "org_isolation_write" ON storage.objects;
DROP POLICY IF EXISTS "org_isolation_delete" ON storage.objects;
DROP POLICY IF EXISTS "service_role_full_access" ON storage.objects;

-- Policy 1: Organizations can READ only their own index files
CREATE POLICY "org_isolation_read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'tantivy-indexes' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text 
    FROM duckcode.user_profiles 
    WHERE id = auth.uid()
  )
);

-- Policy 2: Organizations can WRITE only to their own folder
CREATE POLICY "org_isolation_write"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tantivy-indexes' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text 
    FROM duckcode.user_profiles 
    WHERE id = auth.uid()
  )
);

-- Policy 3: Organizations can DELETE only their own files
CREATE POLICY "org_isolation_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tantivy-indexes' AND
  (storage.foldername(name))[1] = (
    SELECT organization_id::text 
    FROM duckcode.user_profiles 
    WHERE id = auth.uid()
  )
);

-- Policy 4: Service role has full access (for indexing service)
CREATE POLICY "service_role_full_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'tantivy-indexes' AND
  auth.jwt() ->> 'role' = 'service_role'
);

-- ============================================================================
-- 3. Create Security Schema (if not exists)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS security;

-- ============================================================================
-- 4. Audit Logging Tables
-- ============================================================================

-- Table: Search access logs
CREATE TABLE IF NOT EXISTS security.search_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES duckcode.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('search', 'index', 'delete', 'download')),
  query TEXT,
  results_count INTEGER,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_search_logs_org_time 
  ON security.search_access_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_time 
  ON security.search_access_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_failed 
  ON security.search_access_logs(organization_id, success, created_at DESC) 
  WHERE success = false;

-- RLS on audit logs
ALTER TABLE security.search_access_logs ENABLE ROW LEVEL SECURITY;

-- Users can see their own org's logs (admin/owner only)
CREATE POLICY "view_own_org_logs"
ON security.search_access_logs FOR SELECT
USING (
  organization_id = (
    SELECT organization_id FROM duckcode.user_profiles WHERE id = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM duckcode.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Service role can insert logs
CREATE POLICY "service_insert_logs"
ON security.search_access_logs FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 5. Security Incidents Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS security.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES duckcode.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  incident_type TEXT NOT NULL CHECK (incident_type IN (
    'unauthorized_access',
    'rate_limit_exceeded',
    'suspicious_query',
    'data_breach_attempt',
    'org_locked'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  details JSONB,
  action_taken TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for incident tracking
CREATE INDEX IF NOT EXISTS idx_incidents_org_time 
  ON security.security_incidents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_unresolved 
  ON security.security_incidents(created_at DESC) 
  WHERE resolved = false;

-- RLS on incidents
ALTER TABLE security.security_incidents ENABLE ROW LEVEL SECURITY;

-- Admins/owners can see their org's incidents
CREATE POLICY "view_own_org_incidents"
ON security.security_incidents FOR SELECT
USING (
  organization_id = (
    SELECT organization_id FROM duckcode.user_profiles WHERE id = auth.uid()
  ) AND
  EXISTS (
    SELECT 1 FROM duckcode.user_profiles
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Service role can insert incidents
CREATE POLICY "service_insert_incidents"
ON security.security_incidents FOR INSERT
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 6. Index Metadata Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS metadata.tantivy_indexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES duckcode.organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  document_count INTEGER DEFAULT 0,
  size_bytes BIGINT DEFAULT 0,
  last_indexed_at TIMESTAMPTZ DEFAULT NOW(),
  index_path TEXT NOT NULL,  -- e.g., "org-A/v1/"
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'building', 'failed', 'archived')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, version)
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_tantivy_indexes_org 
  ON metadata.tantivy_indexes(organization_id, status, version DESC);

-- RLS on index metadata
ALTER TABLE metadata.tantivy_indexes ENABLE ROW LEVEL SECURITY;

-- Users can view their org's index metadata
CREATE POLICY "view_own_org_indexes"
ON metadata.tantivy_indexes FOR SELECT
USING (
  organization_id = (
    SELECT organization_id FROM duckcode.user_profiles WHERE id = auth.uid()
  )
);

-- Service role can manage indexes
CREATE POLICY "service_manage_indexes"
ON metadata.tantivy_indexes FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 7. Helper Functions
-- ============================================================================

-- Function: Log search access
CREATE OR REPLACE FUNCTION security.log_search_access(
  p_organization_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_query TEXT DEFAULT NULL,
  p_results_count INTEGER DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO security.search_access_logs (
    organization_id,
    user_id,
    action,
    query,
    results_count,
    response_time_ms,
    success,
    error_message
  ) VALUES (
    p_organization_id,
    p_user_id,
    p_action,
    p_query,
    p_results_count,
    p_response_time_ms,
    p_success,
    p_error_message
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get organization's index status
CREATE OR REPLACE FUNCTION metadata.get_org_index_status(p_organization_id UUID)
RETURNS TABLE (
  version INTEGER,
  document_count INTEGER,
  size_mb NUMERIC,
  last_indexed_at TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.version,
    ti.document_count,
    ROUND(ti.size_bytes::NUMERIC / 1048576, 2) as size_mb,
    ti.last_indexed_at,
    ti.status
  FROM metadata.tantivy_indexes ti
  WHERE ti.organization_id = p_organization_id
  ORDER BY ti.version DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cleanup old audit logs (GDPR compliance)
CREATE OR REPLACE FUNCTION security.cleanup_old_logs(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM security.search_access_logs
  WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Security Monitoring View
-- ============================================================================

CREATE OR REPLACE VIEW security.suspicious_activity AS
SELECT 
  organization_id,
  user_id,
  COUNT(*) as failed_attempts,
  MAX(created_at) as last_attempt,
  ARRAY_AGG(DISTINCT error_message) as error_types
FROM security.search_access_logs
WHERE 
  success = false AND
  created_at > NOW() - INTERVAL '5 minutes'
GROUP BY organization_id, user_id
HAVING COUNT(*) >= 10;

-- ============================================================================
-- 9. Grant Permissions
-- ============================================================================

-- Grant access to security schema
GRANT USAGE ON SCHEMA security TO authenticated, service_role;
GRANT USAGE ON SCHEMA metadata TO authenticated, service_role;

-- Grant function execution
GRANT EXECUTE ON FUNCTION security.log_search_access TO service_role;
GRANT EXECUTE ON FUNCTION metadata.get_org_index_status TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION security.cleanup_old_logs TO service_role;

-- Grant view access
GRANT SELECT ON security.suspicious_activity TO service_role;

-- ============================================================================
-- 10. Schedule Automatic Cleanup (pg_cron)
-- ============================================================================

-- Cleanup old logs daily at 2 AM
SELECT cron.schedule(
  'cleanup-old-search-logs',
  '0 2 * * *',
  'SELECT security.cleanup_old_logs(90);'
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries:
-- SELECT * FROM storage.buckets WHERE id = 'tantivy-indexes';
-- SELECT * FROM metadata.tantivy_indexes;
-- SELECT * FROM security.search_access_logs ORDER BY created_at DESC LIMIT 10;
