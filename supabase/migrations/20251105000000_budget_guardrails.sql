-- Budget Guardrails Schema
-- Allows setting budgets at organization, connector, or warehouse level

-- Budget definitions table
CREATE TABLE IF NOT EXISTS enterprise.snowflake_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connector_id UUID REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    
    -- Budget scope
    budget_type TEXT NOT NULL CHECK (budget_type IN ('organization', 'connector', 'warehouse')),
    warehouse_name TEXT, -- Only for warehouse-level budgets
    
    -- Budget details
    budget_name TEXT NOT NULL,
    budget_amount NUMERIC NOT NULL CHECK (budget_amount > 0),
    budget_period TEXT NOT NULL CHECK (budget_period IN ('monthly', 'quarterly', 'annually')),
    currency TEXT NOT NULL DEFAULT 'USD',
    
    -- Alert thresholds (percentages)
    alert_threshold_1 INTEGER DEFAULT 75 CHECK (alert_threshold_1 > 0 AND alert_threshold_1 <= 100),
    alert_threshold_2 INTEGER DEFAULT 90 CHECK (alert_threshold_2 > 0 AND alert_threshold_2 <= 100),
    alert_threshold_3 INTEGER DEFAULT 100 CHECK (alert_threshold_3 > 0 AND alert_threshold_3 <= 100),
    
    -- Alert channels
    email_alerts BOOLEAN DEFAULT true,
    slack_webhook_url TEXT,
    
    -- Auto-actions
    auto_suspend_at_limit BOOLEAN DEFAULT false,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    
    -- Period tracking
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_budget_scope UNIQUE NULLS NOT DISTINCT (organization_id, connector_id, warehouse_name, budget_period)
);

-- Budget alerts history
CREATE TABLE IF NOT EXISTS enterprise.snowflake_budget_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES enterprise.snowflake_budgets(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold_1', 'threshold_2', 'threshold_3', 'exceeded')),
    threshold_percentage INTEGER NOT NULL,
    current_spend NUMERIC NOT NULL,
    budget_amount NUMERIC NOT NULL,
    percentage_used NUMERIC NOT NULL,
    
    -- Alert status
    alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES auth.users(id),
    
    -- Notification channels used
    email_sent BOOLEAN DEFAULT false,
    slack_sent BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budget spending snapshots (for tracking over time)
CREATE TABLE IF NOT EXISTS enterprise.snowflake_budget_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES enterprise.snowflake_budgets(id) ON DELETE CASCADE,
    
    -- Snapshot details
    snapshot_date DATE NOT NULL,
    current_spend NUMERIC NOT NULL,
    budget_amount NUMERIC NOT NULL,
    percentage_used NUMERIC NOT NULL,
    remaining_budget NUMERIC NOT NULL,
    
    -- Forecasting
    projected_end_of_period_spend NUMERIC,
    projected_overage NUMERIC,
    days_until_limit DATE, -- Estimated date when budget will be exceeded
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint: one snapshot per budget per day
    CONSTRAINT unique_budget_snapshot UNIQUE (budget_id, snapshot_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_budgets_org ON enterprise.snowflake_budgets(organization_id);
CREATE INDEX IF NOT EXISTS idx_budgets_connector ON enterprise.snowflake_budgets(connector_id);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON enterprise.snowflake_budgets(status);
CREATE INDEX IF NOT EXISTS idx_budget_alerts_budget ON enterprise.snowflake_budget_alerts(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_budget ON enterprise.snowflake_budget_snapshots(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_snapshots_date ON enterprise.snowflake_budget_snapshots(snapshot_date);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION enterprise.update_budgets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budgets_updated_at
    BEFORE UPDATE ON enterprise.snowflake_budgets
    FOR EACH ROW
    EXECUTE FUNCTION enterprise.update_budgets_updated_at();

-- Function to calculate current budget spend
CREATE OR REPLACE FUNCTION enterprise.get_budget_current_spend(
    p_budget_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
    v_budget RECORD;
    v_current_spend NUMERIC := 0;
BEGIN
    -- Get budget details
    SELECT * INTO v_budget
    FROM enterprise.snowflake_budgets
    WHERE id = p_budget_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Calculate spend based on budget type
    IF v_budget.budget_type = 'organization' THEN
        -- Sum all connector costs in organization for current period
        SELECT COALESCE(SUM(total_cost), 0) INTO v_current_spend
        FROM enterprise.snowflake_daily_costs
        WHERE organization_id = v_budget.organization_id
          AND usage_date >= v_budget.current_period_start
          AND usage_date <= v_budget.current_period_end;
          
    ELSIF v_budget.budget_type = 'connector' THEN
        -- Sum connector costs for current period
        SELECT COALESCE(SUM(total_cost), 0) INTO v_current_spend
        FROM enterprise.snowflake_daily_costs
        WHERE connector_id = v_budget.connector_id
          AND usage_date >= v_budget.current_period_start
          AND usage_date <= v_budget.current_period_end;
          
    ELSIF v_budget.budget_type = 'warehouse' THEN
        -- Sum warehouse-specific costs
        SELECT COALESCE(SUM(credits_used * 3), 0) INTO v_current_spend
        FROM enterprise.snowflake_warehouse_metrics
        WHERE connector_id = v_budget.connector_id
          AND warehouse_name = v_budget.warehouse_name
          AND measurement_time >= v_budget.current_period_start::TIMESTAMPTZ
          AND measurement_time <= v_budget.current_period_end::TIMESTAMPTZ;
    END IF;
    
    RETURN v_current_spend;
END;
$$ LANGUAGE plpgsql;

-- Function to check budget and create alerts
CREATE OR REPLACE FUNCTION enterprise.check_budget_alerts(
    p_budget_id UUID
)
RETURNS TABLE (
    alert_created BOOLEAN,
    alert_type TEXT,
    percentage_used NUMERIC
) AS $$
DECLARE
    v_budget RECORD;
    v_current_spend NUMERIC;
    v_percentage_used NUMERIC;
    v_alert_type TEXT;
    v_last_alert RECORD;
BEGIN
    -- Get budget
    SELECT * INTO v_budget
    FROM enterprise.snowflake_budgets
    WHERE id = p_budget_id AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Calculate current spend
    v_current_spend := enterprise.get_budget_current_spend(p_budget_id);
    v_percentage_used := (v_current_spend / v_budget.budget_amount) * 100;
    
    -- Determine alert type needed
    IF v_percentage_used >= 100 THEN
        v_alert_type := 'exceeded';
    ELSIF v_percentage_used >= v_budget.alert_threshold_3 THEN
        v_alert_type := 'threshold_3';
    ELSIF v_percentage_used >= v_budget.alert_threshold_2 THEN
        v_alert_type := 'threshold_2';
    ELSIF v_percentage_used >= v_budget.alert_threshold_1 THEN
        v_alert_type := 'threshold_1';
    ELSE
        -- No alert needed
        RETURN QUERY SELECT false, NULL::TEXT, v_percentage_used;
        RETURN;
    END IF;
    
    -- Check if this alert was already sent
    SELECT * INTO v_last_alert
    FROM enterprise.snowflake_budget_alerts
    WHERE budget_id = p_budget_id
      AND alert_type = v_alert_type
      AND alerted_at >= v_budget.current_period_start::TIMESTAMPTZ
    ORDER BY alerted_at DESC
    LIMIT 1;
    
    -- If alert already exists for this threshold in this period, don't create new one
    IF FOUND THEN
        RETURN QUERY SELECT false, v_alert_type, v_percentage_used;
        RETURN;
    END IF;
    
    -- Create new alert
    INSERT INTO enterprise.snowflake_budget_alerts (
        budget_id,
        alert_type,
        threshold_percentage,
        current_spend,
        budget_amount,
        percentage_used
    ) VALUES (
        p_budget_id,
        v_alert_type,
        CASE 
            WHEN v_alert_type = 'threshold_1' THEN v_budget.alert_threshold_1
            WHEN v_alert_type = 'threshold_2' THEN v_budget.alert_threshold_2
            WHEN v_alert_type = 'threshold_3' THEN v_budget.alert_threshold_3
            ELSE 100
        END,
        v_current_spend,
        v_budget.budget_amount,
        v_percentage_used
    );
    
    RETURN QUERY SELECT true, v_alert_type, v_percentage_used;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE enterprise.snowflake_budgets IS 'Budget definitions for organizations, connectors, or warehouses';
COMMENT ON TABLE enterprise.snowflake_budget_alerts IS 'History of budget threshold alerts';
COMMENT ON TABLE enterprise.snowflake_budget_snapshots IS 'Daily snapshots of budget spending for tracking and forecasting';
COMMENT ON FUNCTION enterprise.get_budget_current_spend IS 'Calculate current spend for a budget';
COMMENT ON FUNCTION enterprise.check_budget_alerts IS 'Check if budget thresholds are exceeded and create alerts';
