-- =====================================================
-- Enforce Row Level Security on additional metadata tables
-- =====================================================
-- This migration enables RLS and adds org-based policies for
-- AI documentation and webhook/auto-update tables.

BEGIN;

-- =====================================================
-- AI DOCUMENTATION TABLES
-- =====================================================

ALTER TABLE metadata.object_documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.documentation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.documentation_generation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obj_doc_org_members_read ON metadata.object_documentation;
DROP POLICY IF EXISTS obj_doc_service_all ON metadata.object_documentation;

DROP POLICY IF EXISTS doc_jobs_org_members_read ON metadata.documentation_jobs;
DROP POLICY IF EXISTS doc_jobs_service_all ON metadata.documentation_jobs;

DROP POLICY IF EXISTS doc_logs_org_members_read ON metadata.documentation_generation_logs;
DROP POLICY IF EXISTS doc_logs_service_all ON metadata.documentation_generation_logs;

-- Org members can read documentation for their organization
CREATE POLICY obj_doc_org_members_read
  ON metadata.object_documentation
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role has full access to object documentation
CREATE POLICY obj_doc_service_all
  ON metadata.object_documentation
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Org members can read documentation jobs for their organization
CREATE POLICY doc_jobs_org_members_read
  ON metadata.documentation_jobs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role has full access to documentation jobs
CREATE POLICY doc_jobs_service_all
  ON metadata.documentation_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Generation logs: infer org via the associated job
CREATE POLICY doc_logs_org_members_read
  ON metadata.documentation_generation_logs
  FOR SELECT
  USING (
    job_id IN (
      SELECT id
      FROM metadata.documentation_jobs
      WHERE organization_id IN (
        SELECT organization_id
        FROM enterprise.user_organization_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- Service role has full access to generation logs
CREATE POLICY doc_logs_service_all
  ON metadata.documentation_generation_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- WEBHOOK / AUTO-UPDATE TABLES
-- =====================================================

ALTER TABLE metadata.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE metadata.documentation_update_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_org_members_read ON metadata.webhook_events;
DROP POLICY IF EXISTS webhook_events_service_all ON metadata.webhook_events;

DROP POLICY IF EXISTS doc_updates_org_members_read ON metadata.documentation_update_events;
DROP POLICY IF EXISTS doc_updates_service_all ON metadata.documentation_update_events;

-- Org members can read webhook events for their organization
CREATE POLICY webhook_events_org_members_read
  ON metadata.webhook_events
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role has full access to webhook events
CREATE POLICY webhook_events_service_all
  ON metadata.webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Org members can read documentation update events for their organization
CREATE POLICY doc_updates_org_members_read
  ON metadata.documentation_update_events
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role has full access to documentation update events
CREATE POLICY doc_updates_service_all
  ON metadata.documentation_update_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
