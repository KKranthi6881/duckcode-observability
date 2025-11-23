-- =====================================================
-- Enforce Row Level Security on additional enterprise tables
-- =====================================================
-- This migration enables RLS and adds org-based policies for SSO,
-- organization settings, and subscription/billing tables.

BEGIN;

-- =====================================================
-- SSO CONFIGURATION TABLES
-- =====================================================

ALTER TABLE enterprise.sso_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.sso_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.scim_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS sso_connections_org_admin ON enterprise.sso_connections;
DROP POLICY IF EXISTS sso_connections_service_all ON enterprise.sso_connections;

DROP POLICY IF EXISTS sso_domains_org_admin ON enterprise.sso_domains;
DROP POLICY IF EXISTS sso_domains_service_all ON enterprise.sso_domains;

DROP POLICY IF EXISTS scim_tokens_service_all ON enterprise.scim_tokens;

-- Org admins can manage SSO connections
CREATE POLICY sso_connections_org_admin
  ON enterprise.sso_connections
  FOR ALL
  USING (enterprise.is_organization_admin(auth.uid(), organization_id));

-- Service role has full access to SSO connections
CREATE POLICY sso_connections_service_all
  ON enterprise.sso_connections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Org admins can manage SSO domains
CREATE POLICY sso_domains_org_admin
  ON enterprise.sso_domains
  FOR ALL
  USING (enterprise.is_organization_admin(auth.uid(), organization_id));

-- Service role has full access to SSO domains
CREATE POLICY sso_domains_service_all
  ON enterprise.sso_domains
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- SCIM tokens: service_role only (no direct user access)
CREATE POLICY scim_tokens_service_all
  ON enterprise.scim_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- ORGANIZATION SETTINGS
-- =====================================================

ALTER TABLE enterprise.organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_settings_members_read ON enterprise.organization_settings;
DROP POLICY IF EXISTS org_settings_admin_update ON enterprise.organization_settings;
DROP POLICY IF EXISTS org_settings_service_all ON enterprise.organization_settings;

-- Org members can read their organization settings
CREATE POLICY org_settings_members_read
  ON enterprise.organization_settings
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Org admins can update their organization settings
CREATE POLICY org_settings_admin_update
  ON enterprise.organization_settings
  FOR UPDATE
  USING (enterprise.is_organization_admin(auth.uid(), organization_id));

-- Service role has full access to organization settings
CREATE POLICY org_settings_service_all
  ON enterprise.organization_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- SUBSCRIPTIONS & BILLING TABLES
-- =====================================================

ALTER TABLE enterprise.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_subs_members_read ON enterprise.organization_subscriptions;
DROP POLICY IF EXISTS org_subs_service_all ON enterprise.organization_subscriptions;

DROP POLICY IF EXISTS sub_events_members_read ON enterprise.subscription_events;
DROP POLICY IF EXISTS sub_events_service_all ON enterprise.subscription_events;

DROP POLICY IF EXISTS payment_methods_members_read ON enterprise.payment_methods;
DROP POLICY IF EXISTS payment_methods_service_all ON enterprise.payment_methods;

DROP POLICY IF EXISTS invoices_members_read ON enterprise.invoices;
DROP POLICY IF EXISTS invoices_service_all ON enterprise.invoices;

-- Org members can read their own subscription record
CREATE POLICY org_subs_members_read
  ON enterprise.organization_subscriptions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role can fully manage subscriptions
CREATE POLICY org_subs_service_all
  ON enterprise.organization_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Org members can read subscription events for their org
CREATE POLICY sub_events_members_read
  ON enterprise.subscription_events
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role can fully manage subscription events
CREATE POLICY sub_events_service_all
  ON enterprise.subscription_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Org members can read their payment methods
CREATE POLICY payment_methods_members_read
  ON enterprise.payment_methods
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role can fully manage payment methods
CREATE POLICY payment_methods_service_all
  ON enterprise.payment_methods
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Org members can read their invoices
CREATE POLICY invoices_members_read
  ON enterprise.invoices
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id
      FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

-- Service role can fully manage invoices
CREATE POLICY invoices_service_all
  ON enterprise.invoices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
