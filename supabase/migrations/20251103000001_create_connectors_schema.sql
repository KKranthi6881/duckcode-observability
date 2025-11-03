-- =====================================================
-- CONNECTORS FRAMEWORK (Enterprise)
-- Generic connectors and job tracking for databases/BI tools
-- =====================================================

BEGIN;

-- Connectors table
CREATE TABLE IF NOT EXISTS enterprise.connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('snowflake','dbt_cloud','github','gitlab','bigquery','postgresql','mysql','redshift','tableau','looker','databricks')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','error')),
  config_encrypted TEXT NOT NULL,
  config_iv TEXT NOT NULL,
  config_auth_tag TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(organization_id, name)
);

-- Sync history per connector
CREATE TABLE IF NOT EXISTS enterprise.connector_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  objects_extracted INTEGER DEFAULT 0,
  columns_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB
);

-- Job tracking for connector-based extractions
CREATE TABLE IF NOT EXISTS enterprise.connector_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('full','incremental','revalidation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  phase TEXT,
  progress INTEGER DEFAULT 0,
  objects_extracted INTEGER DEFAULT 0,
  columns_extracted INTEGER DEFAULT 0,
  config JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Link metadata tables to connectors (optional for file-based extractions)
ALTER TABLE metadata.repositories ADD COLUMN IF NOT EXISTS connector_id UUID REFERENCES enterprise.connectors(id) ON DELETE SET NULL;
ALTER TABLE metadata.files ADD COLUMN IF NOT EXISTS connector_id UUID REFERENCES enterprise.connectors(id) ON DELETE SET NULL;
ALTER TABLE metadata.objects ADD COLUMN IF NOT EXISTS connector_id UUID REFERENCES enterprise.connectors(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connectors_org ON enterprise.connectors(organization_id);
CREATE INDEX IF NOT EXISTS idx_connectors_type ON enterprise.connectors(type);
CREATE INDEX IF NOT EXISTS idx_connector_jobs_connector ON enterprise.connector_extraction_jobs(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_jobs_org ON enterprise.connector_extraction_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_connector_jobs_status ON enterprise.connector_extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_metadata_repositories_connector ON metadata.repositories(connector_id);
CREATE INDEX IF NOT EXISTS idx_metadata_files_connector ON metadata.files(connector_id);
CREATE INDEX IF NOT EXISTS idx_metadata_objects_connector ON metadata.objects(connector_id);

-- RLS
ALTER TABLE enterprise.connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.connector_sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.connector_extraction_jobs ENABLE ROW LEVEL SECURITY;

-- Policies: organization isolation via membership
CREATE POLICY connectors_org_isolation ON enterprise.connectors
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY connector_history_org_isolation ON enterprise.connector_sync_history
  FOR ALL USING (
    connector_id IN (
      SELECT id FROM enterprise.connectors
      WHERE organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY connector_jobs_org_isolation ON enterprise.connector_extraction_jobs
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

-- Update triggers
CREATE OR REPLACE FUNCTION enterprise.update_connectors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_connectors_updated_at ON enterprise.connectors;
CREATE TRIGGER trg_update_connectors_updated_at
  BEFORE UPDATE ON enterprise.connectors
  FOR EACH ROW EXECUTE FUNCTION enterprise.update_connectors_updated_at();

COMMIT;
