-- ===============================================
-- Snowflake Cost Intelligence - Phase 1
-- Tables for cost metrics, storage tracking, and waste detection
-- ===============================================

BEGIN;

-- ============================================
-- 1. Cost Metrics Cache (for dashboard performance)
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_cost_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  
  -- Time period
  metric_date DATE NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'daily' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  
  -- Cost breakdown
  compute_credits NUMERIC(18,4) DEFAULT 0,
  storage_credits NUMERIC(18,4) DEFAULT 0,
  data_transfer_credits NUMERIC(18,4) DEFAULT 0,
  total_credits NUMERIC(18,4) DEFAULT 0,
  
  -- Cost in dollars (assuming $3 per credit, can be configured)
  cost_per_credit NUMERIC(10,4) DEFAULT 3.0,
  total_cost NUMERIC(18,2) GENERATED ALWAYS AS (total_credits * cost_per_credit) STORED,
  
  -- Metadata
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(connector_id, metric_date, period_type)
);

-- ============================================
-- 2. Storage Usage Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_storage_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  
  -- Storage hierarchy
  database_name TEXT NOT NULL,
  schema_name TEXT,
  table_name TEXT,
  
  -- Storage metrics
  storage_bytes BIGINT DEFAULT 0,
  storage_gb NUMERIC(18,4) GENERATED ALWAYS AS (storage_bytes / 1073741824.0) STORED,
  failsafe_bytes BIGINT DEFAULT 0,
  time_travel_bytes BIGINT DEFAULT 0,
  
  -- Table metadata
  row_count BIGINT,
  table_type TEXT, -- TABLE, VIEW, MATERIALIZED_VIEW
  is_transient BOOLEAN DEFAULT false,
  retention_days INTEGER DEFAULT 1,
  
  -- Last access tracking
  last_altered TIMESTAMPTZ,
  last_accessed TIMESTAMPTZ,
  days_since_access INTEGER,
  
  -- Cost calculation
  monthly_storage_cost NUMERIC(18,2),
  
  -- Metadata
  snapshot_date DATE NOT NULL,
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(connector_id, database_name, schema_name, table_name, snapshot_date)
);

-- ============================================
-- 3. Warehouse Performance Metrics
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_warehouse_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  
  warehouse_name TEXT NOT NULL,
  metric_date DATE NOT NULL,
  
  -- Usage metrics
  total_queries INTEGER DEFAULT 0,
  total_execution_time_ms BIGINT DEFAULT 0,
  avg_execution_time_ms NUMERIC(18,2),
  total_queue_time_ms BIGINT DEFAULT 0,
  avg_queue_time_ms NUMERIC(18,2),
  
  -- Credits and utilization
  credits_used NUMERIC(18,4) DEFAULT 0,
  uptime_hours NUMERIC(10,2),
  utilization_percent NUMERIC(5,2),
  
  -- Performance indicators
  queries_queued INTEGER DEFAULT 0,
  queries_failed INTEGER DEFAULT 0,
  spillage_events INTEGER DEFAULT 0,
  
  -- Warehouse config
  warehouse_size TEXT,
  auto_suspend_minutes INTEGER,
  auto_resume BOOLEAN,
  
  -- Metadata
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(connector_id, warehouse_name, metric_date)
);

-- ============================================
-- 4. Waste Detection Opportunities
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_waste_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  
  -- Opportunity details
  opportunity_type TEXT NOT NULL CHECK (opportunity_type IN (
    'unused_table',
    'idle_warehouse', 
    'oversized_warehouse',
    'underutilized_warehouse',
    'excessive_time_travel',
    'zombie_warehouse',
    'failed_query_waste',
    'clustering_waste',
    'forgotten_clone'
  )),
  
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'implementing', 'resolved', 'dismissed')),
  
  -- Resource identification
  resource_type TEXT, -- TABLE, WAREHOUSE, SCHEMA, etc.
  resource_name TEXT NOT NULL,
  database_name TEXT,
  schema_name TEXT,
  
  -- Impact analysis
  current_monthly_cost NUMERIC(18,2),
  potential_monthly_savings NUMERIC(18,2),
  savings_confidence NUMERIC(5,2) DEFAULT 85.0, -- percentage
  
  -- Details and context
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  evidence JSONB, -- Additional supporting data
  
  -- Tracking
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 5. Query Performance Cache
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_query_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  
  query_id TEXT NOT NULL,
  query_hash TEXT, -- Hash of normalized query for pattern detection
  
  -- Query details
  user_name TEXT,
  warehouse_name TEXT,
  database_name TEXT,
  schema_name TEXT,
  query_type TEXT, -- SELECT, INSERT, UPDATE, etc.
  
  -- Performance
  start_time TIMESTAMPTZ,
  execution_time_ms BIGINT,
  queue_time_ms BIGINT,
  bytes_scanned BIGINT,
  bytes_written BIGINT,
  bytes_spilled_to_local BIGINT,
  bytes_spilled_to_remote BIGINT,
  
  -- Cost
  credits_used NUMERIC(18,6),
  estimated_cost NUMERIC(18,6),
  
  -- Status
  execution_status TEXT, -- SUCCESS, FAILED, etc.
  error_code TEXT,
  error_message TEXT,
  
  -- Query text (optional, can be large)
  query_text TEXT,
  
  -- Metadata
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(connector_id, query_id)
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Cost metrics indexes
CREATE INDEX IF NOT EXISTS idx_cost_metrics_connector_date 
  ON enterprise.snowflake_cost_metrics(connector_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_cost_metrics_org 
  ON enterprise.snowflake_cost_metrics(organization_id);

-- Storage usage indexes
CREATE INDEX IF NOT EXISTS idx_storage_connector_date 
  ON enterprise.snowflake_storage_usage(connector_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_storage_database 
  ON enterprise.snowflake_storage_usage(database_name, schema_name, table_name);
CREATE INDEX IF NOT EXISTS idx_storage_last_access 
  ON enterprise.snowflake_storage_usage(connector_id, days_since_access DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_storage_cost 
  ON enterprise.snowflake_storage_usage(connector_id, monthly_storage_cost DESC NULLS LAST);

-- Warehouse metrics indexes
CREATE INDEX IF NOT EXISTS idx_warehouse_metrics_connector_date 
  ON enterprise.snowflake_warehouse_metrics(connector_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_metrics_name 
  ON enterprise.snowflake_warehouse_metrics(warehouse_name, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_utilization 
  ON enterprise.snowflake_warehouse_metrics(connector_id, utilization_percent);

-- Waste opportunities indexes
CREATE INDEX IF NOT EXISTS idx_waste_connector_status 
  ON enterprise.snowflake_waste_opportunities(connector_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_waste_type 
  ON enterprise.snowflake_waste_opportunities(opportunity_type, status);
CREATE INDEX IF NOT EXISTS idx_waste_savings 
  ON enterprise.snowflake_waste_opportunities(connector_id, potential_monthly_savings DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_waste_detected 
  ON enterprise.snowflake_waste_opportunities(detected_at DESC);

-- Query metrics indexes
CREATE INDEX IF NOT EXISTS idx_query_metrics_connector 
  ON enterprise.snowflake_query_metrics(connector_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_query_metrics_hash 
  ON enterprise.snowflake_query_metrics(query_hash, connector_id);
CREATE INDEX IF NOT EXISTS idx_query_metrics_cost 
  ON enterprise.snowflake_query_metrics(connector_id, estimated_cost DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_query_metrics_warehouse 
  ON enterprise.snowflake_query_metrics(warehouse_name, start_time DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE enterprise.snowflake_cost_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_warehouse_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_waste_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_query_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies (organization isolation)
CREATE POLICY snowflake_cost_metrics_org_isolation ON enterprise.snowflake_cost_metrics
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_storage_usage_org_isolation ON enterprise.snowflake_storage_usage
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_warehouse_metrics_org_isolation ON enterprise.snowflake_warehouse_metrics
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_waste_opportunities_org_isolation ON enterprise.snowflake_waste_opportunities
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_query_metrics_org_isolation ON enterprise.snowflake_query_metrics
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Update Triggers
-- ============================================

CREATE OR REPLACE FUNCTION enterprise.update_snowflake_waste_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_waste_opportunities_updated_at ON enterprise.snowflake_waste_opportunities;
CREATE TRIGGER trg_waste_opportunities_updated_at
BEFORE UPDATE ON enterprise.snowflake_waste_opportunities
FOR EACH ROW EXECUTE FUNCTION enterprise.update_snowflake_waste_opportunities_updated_at();

COMMIT;
