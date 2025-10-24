-- Migration: Webhook and Auto-Update System (SaaS Edition)
-- Created: 2025-10-24
-- Description: Add webhook columns to existing github_connections table for automatic documentation updates

-- ============================================================================
-- 1. Add Webhook Columns to Existing github_connections Table
-- ============================================================================
-- This integrates webhook management into the existing GitHub connection flow
-- No new tables needed - everything uses existing infrastructure!

ALTER TABLE enterprise.github_connections
ADD COLUMN IF NOT EXISTS webhook_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS webhook_secret TEXT, -- Encrypted with ENCRYPTION_KEY
ADD COLUMN IF NOT EXISTS webhook_secret_iv TEXT,
ADD COLUMN IF NOT EXISTS webhook_configured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS webhook_configured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS webhook_last_delivery_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS webhook_last_error TEXT;

-- Add comments
COMMENT ON COLUMN enterprise.github_connections.webhook_id IS 'GitHub webhook ID (from GitHub API)';
COMMENT ON COLUMN enterprise.github_connections.webhook_secret IS 'Encrypted webhook secret for signature validation';
COMMENT ON COLUMN enterprise.github_connections.webhook_secret_iv IS 'Initialization vector for webhook_secret encryption';
COMMENT ON COLUMN enterprise.github_connections.webhook_configured IS 'Whether webhook was successfully configured via GitHub API';
COMMENT ON COLUMN enterprise.github_connections.webhook_last_delivery_at IS 'Last time we received a webhook from this repo';

-- Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS idx_github_connections_webhook 
ON enterprise.github_connections(webhook_configured, organization_id) 
WHERE webhook_configured = true;

CREATE INDEX IF NOT EXISTS idx_github_connections_webhook_delivery 
ON enterprise.github_connections(webhook_last_delivery_at DESC NULLS LAST);

-- ============================================================================
-- 2. Webhook Events Log Table (for audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metadata.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES enterprise.github_connections(id),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id),
  
  -- Webhook information
  provider VARCHAR(50) NOT NULL DEFAULT 'github',
  event_type VARCHAR(50) NOT NULL, -- 'push', 'pull_request', etc.
  branch VARCHAR(255),
  
  -- Commit information
  commit_count INTEGER DEFAULT 0,
  commit_sha VARCHAR(64),
  commit_message TEXT,
  pusher VARCHAR(255),
  
  -- Processing status
  processed BOOLEAN DEFAULT true,
  extraction_triggered BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for webhook events
CREATE INDEX idx_webhook_events_connection ON metadata.webhook_events(connection_id);
CREATE INDEX idx_webhook_events_org ON metadata.webhook_events(organization_id);
CREATE INDEX idx_webhook_events_created ON metadata.webhook_events(created_at DESC);

-- ============================================================================
-- 2. Organization Settings Table (for auto-update configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enterprise.organization_settings (
  organization_id UUID PRIMARY KEY REFERENCES enterprise.organizations(id),
  
  -- Auto-update settings
  auto_update_documentation BOOLEAN DEFAULT true,
  auto_update_on_push BOOLEAN DEFAULT true,
  auto_update_on_merge BOOLEAN DEFAULT true,
  
  -- Notification settings
  notify_on_update BOOLEAN DEFAULT true,
  notify_admins_only BOOLEAN DEFAULT true,
  
  -- Frequency control (to avoid too frequent updates)
  min_update_interval_minutes INTEGER DEFAULT 30,
  
  -- Cost control
  max_auto_updates_per_day INTEGER DEFAULT 100,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_organization_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_organization_settings_updated_at
  BEFORE UPDATE ON enterprise.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_organization_settings_updated_at();

-- ============================================================================
-- 3. Add content_hash to objects table (for change detection)
-- ============================================================================
ALTER TABLE metadata.objects 
ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_objects_content_hash 
ON metadata.objects(content_hash);

-- Function to calculate hash from SQL definition
CREATE OR REPLACE FUNCTION calculate_object_hash(sql_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(COALESCE(sql_text, ''), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing objects with hash (run once)
UPDATE metadata.objects
SET content_hash = calculate_object_hash(definition)
WHERE content_hash IS NULL AND definition IS NOT NULL;

-- Trigger to auto-calculate hash on insert/update
CREATE OR REPLACE FUNCTION auto_calculate_content_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_hash = calculate_object_hash(NEW.definition);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_content_hash
  BEFORE INSERT OR UPDATE OF definition ON metadata.objects
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_content_hash();

-- ============================================================================
-- 4. Documentation Update Events Table (for tracking auto-updates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS metadata.documentation_update_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id),
  repository_id UUID REFERENCES metadata.repositories(id),
  job_id UUID REFERENCES metadata.documentation_jobs(id),
  
  -- Change information
  objects_added INTEGER DEFAULT 0,
  objects_modified INTEGER DEFAULT 0,
  objects_deleted INTEGER DEFAULT 0,
  objects_unchanged INTEGER DEFAULT 0,
  
  -- Trigger information
  triggered_by VARCHAR(50), -- 'webhook', 'manual', 'scheduled'
  trigger_event VARCHAR(100), -- 'git_push', 'branch_merge', etc.
  webhook_event_id UUID REFERENCES metadata.webhook_events(id),
  commit_sha VARCHAR(64),
  commit_author VARCHAR(255),
  commit_message TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'skipped'
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for documentation update events
CREATE INDEX idx_doc_update_events_org 
ON metadata.documentation_update_events(organization_id);

CREATE INDEX idx_doc_update_events_repo 
ON metadata.documentation_update_events(repository_id);

CREATE INDEX idx_doc_update_events_job 
ON metadata.documentation_update_events(job_id);

CREATE INDEX idx_doc_update_events_status 
ON metadata.documentation_update_events(status);

CREATE INDEX idx_doc_update_events_created 
ON metadata.documentation_update_events(created_at DESC);

-- ============================================================================
-- 5. Add mode column to documentation_jobs table
-- ============================================================================
ALTER TABLE metadata.documentation_jobs
ADD COLUMN IF NOT EXISTS mode VARCHAR(50) DEFAULT 'manual';

COMMENT ON COLUMN metadata.documentation_jobs.mode IS 'Job mode: manual, auto-update, scheduled';

ALTER TABLE metadata.documentation_jobs
ADD COLUMN IF NOT EXISTS update_event_id UUID REFERENCES metadata.documentation_update_events(id);

COMMENT ON COLUMN metadata.documentation_jobs.update_event_id IS 'Link to the documentation update event that triggered this job';

-- ============================================================================
-- 6. Create default settings for existing organizations
-- ============================================================================
INSERT INTO enterprise.organization_settings (organization_id, auto_update_documentation)
SELECT id, true
FROM enterprise.organizations
WHERE NOT EXISTS (
  SELECT 1 FROM enterprise.organization_settings 
  WHERE organization_id = organizations.id
);

-- ============================================================================
-- 7. Helper function to check if auto-update is enabled
-- ============================================================================
CREATE OR REPLACE FUNCTION is_auto_update_enabled(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  enabled BOOLEAN;
BEGIN
  SELECT auto_update_documentation INTO enabled
  FROM enterprise.organization_settings
  WHERE organization_id = org_id;
  
  RETURN COALESCE(enabled, true); -- Default to true if not configured
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Function to log webhook event
-- ============================================================================
CREATE OR REPLACE FUNCTION log_webhook_event(
  p_organization_id UUID,
  p_provider VARCHAR,
  p_event_type VARCHAR,
  p_repository_url TEXT,
  p_branch VARCHAR,
  p_commit_count INTEGER,
  p_commit_sha VARCHAR,
  p_commit_message TEXT,
  p_pusher VARCHAR
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO metadata.webhook_events (
    organization_id,
    provider,
    event_type,
    repository_url,
    branch,
    commit_count,
    commit_sha,
    commit_message,
    pusher,
    processed,
    created_at
  ) VALUES (
    p_organization_id,
    p_provider,
    p_event_type,
    p_repository_url,
    p_branch,
    p_commit_count,
    p_commit_sha,
    p_commit_message,
    p_pusher,
    true,
    NOW()
  )
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE metadata.webhook_events IS 'Logs all webhook events received from GitHub, GitLab, etc.';
COMMENT ON TABLE enterprise.organization_settings IS 'Per-organization settings for documentation auto-updates';
COMMENT ON TABLE metadata.documentation_update_events IS 'Tracks documentation update events triggered by code changes';
COMMENT ON COLUMN metadata.objects.content_hash IS 'SHA-256 hash of SQL definition for change detection';

-- ============================================================================
-- GRANTS (if using RLS)
-- ============================================================================
-- Service role needs full access
GRANT ALL ON metadata.webhook_events TO service_role;
GRANT ALL ON enterprise.organization_settings TO service_role;
GRANT ALL ON metadata.documentation_update_events TO service_role;

-- Allow authenticated users to read their organization settings
GRANT SELECT ON enterprise.organization_settings TO authenticated;
GRANT UPDATE ON enterprise.organization_settings TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Webhook and Auto-Update System migration completed successfully!';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - metadata.webhook_events';
  RAISE NOTICE '  - enterprise.organization_settings';
  RAISE NOTICE '  - metadata.documentation_update_events';
  RAISE NOTICE 'Added columns:';
  RAISE NOTICE '  - metadata.objects.content_hash';
  RAISE NOTICE '  - metadata.documentation_jobs.mode';
  RAISE NOTICE '  - metadata.documentation_jobs.update_event_id';
END $$;
