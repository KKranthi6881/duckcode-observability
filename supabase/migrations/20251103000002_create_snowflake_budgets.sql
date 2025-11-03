-- ===============================================
-- Snowflake Budgets & Alerts (Enterprise)
-- ===============================================

BEGIN;

CREATE TABLE IF NOT EXISTS enterprise.snowflake_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('overall','warehouse','tag','user')),
  warehouse_name TEXT,
  tag_name TEXT,
  tag_value TEXT,
  user_name TEXT,
  threshold_credits NUMERIC NOT NULL CHECK (threshold_credits >= 0),
  period TEXT NOT NULL DEFAULT '30d' CHECK (period IN ('7d','30d','90d','custom')),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  notify_slack_webhook TEXT,
  notify_email TEXT[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enterprise.snowflake_budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES enterprise.snowflake_budgets(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_credits NUMERIC NOT NULL,
  message TEXT,
  sent_targets JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budgets_org ON enterprise.snowflake_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budgets_connector ON enterprise.snowflake_budgets(connector_id);
CREATE INDEX IF NOT EXISTS idx_alerts_budget ON enterprise.snowflake_budget_alerts(budget_id);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON enterprise.snowflake_budget_alerts(organization_id);

-- RLS
ALTER TABLE enterprise.snowflake_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY snowflake_budgets_org_isolation ON enterprise.snowflake_budgets
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_budget_alerts_org_isolation ON enterprise.snowflake_budget_alerts
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION enterprise.update_snowflake_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_snowflake_budgets_updated_at ON enterprise.snowflake_budgets;
CREATE TRIGGER trg_snowflake_budgets_updated_at
BEFORE UPDATE ON enterprise.snowflake_budgets
FOR EACH ROW EXECUTE FUNCTION enterprise.update_snowflake_budgets_updated_at();

COMMIT;
