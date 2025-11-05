-- Budget Cost Tracking Tables
-- Tables to store actual Snowflake cost data for budget tracking

-- Daily costs aggregation table
CREATE TABLE IF NOT EXISTS enterprise.snowflake_daily_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    
    -- Cost data
    usage_date DATE NOT NULL,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    total_credits NUMERIC NOT NULL DEFAULT 0,
    credit_price NUMERIC NOT NULL DEFAULT 3.0,
    
    -- Breakdown
    compute_cost NUMERIC DEFAULT 0,
    storage_cost NUMERIC DEFAULT 0,
    data_transfer_cost NUMERIC DEFAULT 0,
    
    -- Metrics
    total_queries INTEGER DEFAULT 0,
    successful_queries INTEGER DEFAULT 0,
    failed_queries INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT unique_daily_cost UNIQUE (connector_id, usage_date)
);

-- NOTE: snowflake_warehouse_metrics table already exists from 20251104120000_snowflake_cost_phase1.sql
-- That table uses metric_date DATE instead of measurement_time TIMESTAMPTZ
-- We'll use the existing table structure for warehouse metrics

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_costs_org ON enterprise.snowflake_daily_costs(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_costs_connector ON enterprise.snowflake_daily_costs(connector_id);
CREATE INDEX IF NOT EXISTS idx_daily_costs_date ON enterprise.snowflake_daily_costs(usage_date);
-- Warehouse metrics indexes already exist in 20251104120000_snowflake_cost_phase1.sql

-- RLS Policies
ALTER TABLE enterprise.snowflake_daily_costs ENABLE ROW LEVEL SECURITY;
-- Warehouse metrics RLS already exists in 20251104120000_snowflake_cost_phase1.sql

CREATE POLICY daily_costs_org_isolation ON enterprise.snowflake_daily_costs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
        )
    );

-- Updated_at trigger for daily_costs
CREATE OR REPLACE FUNCTION enterprise.update_daily_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_costs_updated_at
    BEFORE UPDATE ON enterprise.snowflake_daily_costs
    FOR EACH ROW
    EXECUTE FUNCTION enterprise.update_daily_costs_updated_at();

-- Function to manually add or update daily cost
CREATE OR REPLACE FUNCTION enterprise.upsert_daily_cost(
    p_connector_id UUID,
    p_usage_date DATE,
    p_total_cost NUMERIC,
    p_total_queries INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
    v_org_id UUID;
    v_result_id UUID;
BEGIN
    -- Get organization_id from connector
    SELECT organization_id INTO v_org_id
    FROM enterprise.connectors
    WHERE id = p_connector_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connector not found';
    END IF;
    
    -- Upsert cost record
    INSERT INTO enterprise.snowflake_daily_costs (
        organization_id,
        connector_id,
        usage_date,
        total_cost,
        total_credits,
        total_queries,
        successful_queries
    ) VALUES (
        v_org_id,
        p_connector_id,
        p_usage_date,
        p_total_cost,
        p_total_cost / 3.0, -- Assuming $3 per credit
        p_total_queries,
        p_total_queries
    )
    ON CONFLICT (connector_id, usage_date)
    DO UPDATE SET
        total_cost = EXCLUDED.total_cost,
        total_credits = EXCLUDED.total_credits,
        total_queries = EXCLUDED.total_queries,
        successful_queries = EXCLUDED.successful_queries,
        updated_at = NOW()
    RETURNING id INTO v_result_id;
    
    RETURN v_result_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
