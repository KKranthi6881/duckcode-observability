-- =====================================================
-- Enforce Row Level Security on metadata.object_mappings
-- =====================================================
-- This migration enables RLS on the object_mappings table used by the
-- unified lineage system and adds org-based policies plus service_role
-- access for backend processing.

BEGIN;

-- Enable RLS on object_mappings
ALTER TABLE metadata.object_mappings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS object_mappings_org_members_read ON metadata.object_mappings;
DROP POLICY IF EXISTS object_mappings_service_all ON metadata.object_mappings;

-- Org members can read mappings for their organization
CREATE POLICY object_mappings_org_members_read
  ON metadata.object_mappings
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Backend service_role can fully manage mappings
CREATE POLICY object_mappings_service_all
  ON metadata.object_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
