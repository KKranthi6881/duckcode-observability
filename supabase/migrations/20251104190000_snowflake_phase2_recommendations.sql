-- ============================================
-- PHASE 2: Smart Recommendations - Database Schema
-- Migration: 20251104190000
-- ============================================

-- ============================================
-- 1. Warehouse Utilization Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_warehouse_utilization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  warehouse_name TEXT NOT NULL,
  warehouse_size TEXT,
  measurement_time TIMESTAMPTZ NOT NULL,
  avg_running DECIMAL(10,4),
  avg_queued_load DECIMAL(10,4),
  avg_queued_provisioning DECIMAL(10,4),
  avg_blocked DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_utilization_connector 
  ON enterprise.snowflake_warehouse_utilization(connector_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_utilization_time 
  ON enterprise.snowflake_warehouse_utilization(measurement_time);
CREATE INDEX IF NOT EXISTS idx_warehouse_utilization_warehouse 
  ON enterprise.snowflake_warehouse_utilization(warehouse_name);

COMMENT ON TABLE enterprise.snowflake_warehouse_utilization IS 
  'Tracks warehouse utilization metrics from WAREHOUSE_LOAD_HISTORY for right-sizing recommendations';

-- ============================================
-- 2. Query Repetition Patterns
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_query_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  query_text TEXT,
  database_name TEXT,
  schema_name TEXT,
  warehouse_name TEXT,
  user_name TEXT,
  execution_count INTEGER NOT NULL DEFAULT 0,
  total_execution_time_ms BIGINT DEFAULT 0,
  avg_execution_time_ms DECIMAL(12,2) DEFAULT 0,
  total_bytes_scanned BIGINT DEFAULT 0,
  first_execution TIMESTAMPTZ,
  last_execution TIMESTAMPTZ,
  analysis_period_start TIMESTAMPTZ NOT NULL,
  analysis_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_patterns_connector 
  ON enterprise.snowflake_query_patterns(connector_id);
CREATE INDEX IF NOT EXISTS idx_query_patterns_exec_count 
  ON enterprise.snowflake_query_patterns(execution_count DESC);
CREATE INDEX IF NOT EXISTS idx_query_patterns_hash 
  ON enterprise.snowflake_query_patterns(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_patterns_period 
  ON enterprise.snowflake_query_patterns(analysis_period_start, analysis_period_end);

COMMENT ON TABLE enterprise.snowflake_query_patterns IS 
  'Tracks repeated query patterns for result caching recommendations';

-- ============================================
-- 3. Clustering Cost History
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_clustering_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  database_name TEXT,
  schema_name TEXT,
  table_name TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  credits_used DECIMAL(12,6),
  bytes_reclustered BIGINT,
  rows_reclustered BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clustering_history_connector 
  ON enterprise.snowflake_clustering_history(connector_id);
CREATE INDEX IF NOT EXISTS idx_clustering_history_table 
  ON enterprise.snowflake_clustering_history(table_name);
CREATE INDEX IF NOT EXISTS idx_clustering_history_time 
  ON enterprise.snowflake_clustering_history(start_time);
CREATE INDEX IF NOT EXISTS idx_clustering_history_credits 
  ON enterprise.snowflake_clustering_history(credits_used DESC);

COMMENT ON TABLE enterprise.snowflake_clustering_history IS 
  'Tracks automatic clustering costs for clustering waste detection';

-- ============================================
-- 4. Materialized View Refresh History
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_mv_refresh_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  database_name TEXT,
  schema_name TEXT,
  view_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  credits_used DECIMAL(12,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mv_refresh_connector 
  ON enterprise.snowflake_mv_refresh_history(connector_id);
CREATE INDEX IF NOT EXISTS idx_mv_refresh_view 
  ON enterprise.snowflake_mv_refresh_history(view_name);
CREATE INDEX IF NOT EXISTS idx_mv_refresh_time 
  ON enterprise.snowflake_mv_refresh_history(start_time);

COMMENT ON TABLE enterprise.snowflake_mv_refresh_history IS 
  'Tracks materialized view refresh costs';

-- ============================================
-- 5. Task Execution History
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  database_name TEXT,
  schema_name TEXT,
  task_name TEXT NOT NULL,
  state TEXT,
  scheduled_time TIMESTAMPTZ,
  completed_time TIMESTAMPTZ,
  query_id TEXT,
  warehouse_name TEXT,
  execution_time_ms BIGINT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_history_connector 
  ON enterprise.snowflake_task_history(connector_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task 
  ON enterprise.snowflake_task_history(task_name);
CREATE INDEX IF NOT EXISTS idx_task_history_time 
  ON enterprise.snowflake_task_history(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_task_history_state 
  ON enterprise.snowflake_task_history(state);

COMMENT ON TABLE enterprise.snowflake_task_history IS 
  'Tracks scheduled task execution and costs';

-- ============================================
-- 6. Recommendations Core Table
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
  
  -- Recommendation details
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Target object
  warehouse_name TEXT,
  database_name TEXT,
  schema_name TEXT,
  table_name TEXT,
  query_hash TEXT,
  
  -- Recommendation specifics
  title TEXT NOT NULL,
  description TEXT,
  current_value TEXT,
  recommended_value TEXT,
  
  -- Impact metrics
  estimated_monthly_savings_usd DECIMAL(12,2),
  confidence_score DECIMAL(5,2) DEFAULT 0,
  effort_level TEXT DEFAULT 'medium',
  
  -- Implementation
  sql_commands TEXT[],
  implementation_notes TEXT,
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id),
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  dismissed_at TIMESTAMPTZ,
  dismissed_by UUID REFERENCES auth.users(id),
  dismissal_reason TEXT,
  
  CONSTRAINT valid_priority CHECK (priority IN ('high', 'medium', 'low')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'applied', 'dismissed', 'failed', 'expired')),
  CONSTRAINT valid_effort CHECK (effort_level IN ('easy', 'medium', 'hard')),
  CONSTRAINT valid_type CHECK (type IN (
    'warehouse_resize', 
    'auto_suspend', 
    'enable_cache', 
    'archive_table', 
    'disable_clustering',
    'optimize_query',
    'disable_task',
    'optimize_mv_refresh'
  ))
);

CREATE INDEX IF NOT EXISTS idx_recommendations_connector 
  ON enterprise.snowflake_recommendations(connector_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_org 
  ON enterprise.snowflake_recommendations(organization_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status 
  ON enterprise.snowflake_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority 
  ON enterprise.snowflake_recommendations(priority);
CREATE INDEX IF NOT EXISTS idx_recommendations_type 
  ON enterprise.snowflake_recommendations(type);
CREATE INDEX IF NOT EXISTS idx_recommendations_savings 
  ON enterprise.snowflake_recommendations(estimated_monthly_savings_usd DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_created 
  ON enterprise.snowflake_recommendations(created_at DESC);

COMMENT ON TABLE enterprise.snowflake_recommendations IS 
  'Stores AI-generated cost optimization recommendations for Snowflake';

-- ============================================
-- 7. ROI Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_roi_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES enterprise.snowflake_recommendations(id) ON DELETE SET NULL,
  
  -- Baseline metrics (before)
  baseline_period_start TIMESTAMPTZ NOT NULL,
  baseline_period_end TIMESTAMPTZ NOT NULL,
  baseline_monthly_cost_usd DECIMAL(12,2),
  baseline_compute_credits DECIMAL(12,2),
  baseline_storage_gb DECIMAL(12,2),
  
  -- Post-implementation metrics (after)
  measurement_period_start TIMESTAMPTZ,
  measurement_period_end TIMESTAMPTZ,
  actual_monthly_cost_usd DECIMAL(12,2),
  actual_compute_credits DECIMAL(12,2),
  actual_storage_gb DECIMAL(12,2),
  
  -- Calculated savings
  projected_savings_usd DECIMAL(12,2),
  actual_savings_usd DECIMAL(12,2),
  variance_percent DECIMAL(5,2),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roi_tracking_connector 
  ON enterprise.snowflake_roi_tracking(connector_id);
CREATE INDEX IF NOT EXISTS idx_roi_tracking_recommendation 
  ON enterprise.snowflake_roi_tracking(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_roi_tracking_baseline_period 
  ON enterprise.snowflake_roi_tracking(baseline_period_start, baseline_period_end);

COMMENT ON TABLE enterprise.snowflake_roi_tracking IS 
  'Tracks actual vs projected savings for applied recommendations';

-- ============================================
-- 8. Recommendation Actions Log
-- ============================================
CREATE TABLE IF NOT EXISTS enterprise.snowflake_recommendation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES enterprise.snowflake_recommendations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'applied', 'dismissed', 'failed', 'expired'
  user_id UUID REFERENCES auth.users(id),
  action_details JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_action_type CHECK (action_type IN ('applied', 'dismissed', 'failed', 'expired', 'scheduled'))
);

CREATE INDEX IF NOT EXISTS idx_recommendation_actions_recommendation 
  ON enterprise.snowflake_recommendation_actions(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_actions_user 
  ON enterprise.snowflake_recommendation_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendation_actions_created 
  ON enterprise.snowflake_recommendation_actions(created_at DESC);

COMMENT ON TABLE enterprise.snowflake_recommendation_actions IS 
  'Audit log for all recommendation actions';

-- ============================================
-- 9. Update existing waste_opportunities with priority
-- ============================================
ALTER TABLE enterprise.snowflake_waste_opportunities 
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';

ALTER TABLE enterprise.snowflake_waste_opportunities 
  ADD COLUMN IF NOT EXISTS estimated_monthly_savings_usd DECIMAL(12,2);

UPDATE enterprise.snowflake_waste_opportunities 
SET priority = CASE 
  WHEN potential_monthly_savings > 1000 THEN 'high'
  WHEN potential_monthly_savings > 500 THEN 'medium'
  ELSE 'low'
END
WHERE priority IS NULL;

-- ============================================
-- 10. Row Level Security (RLS) for new tables
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE enterprise.snowflake_warehouse_utilization ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_query_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_clustering_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_mv_refresh_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_roi_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_recommendation_actions ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see data for their organization's connectors
CREATE POLICY snowflake_warehouse_utilization_org_policy ON enterprise.snowflake_warehouse_utilization
  FOR ALL
  USING (
    connector_id IN (
      SELECT c.id FROM enterprise.connectors c
      JOIN enterprise.user_organization_roles uor ON c.organization_id = uor.organization_id
      WHERE uor.user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_query_patterns_org_policy ON enterprise.snowflake_query_patterns
  FOR ALL
  USING (
    connector_id IN (
      SELECT c.id FROM enterprise.connectors c
      JOIN enterprise.user_organization_roles uor ON c.organization_id = uor.organization_id
      WHERE uor.user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_clustering_history_org_policy ON enterprise.snowflake_clustering_history
  FOR ALL
  USING (
    connector_id IN (
      SELECT c.id FROM enterprise.connectors c
      JOIN enterprise.user_organization_roles uor ON c.organization_id = uor.organization_id
      WHERE uor.user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_mv_refresh_org_policy ON enterprise.snowflake_mv_refresh_history
  FOR ALL
  USING (
    connector_id IN (
      SELECT c.id FROM enterprise.connectors c
      JOIN enterprise.user_organization_roles uor ON c.organization_id = uor.organization_id
      WHERE uor.user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_task_history_org_policy ON enterprise.snowflake_task_history
  FOR ALL
  USING (
    connector_id IN (
      SELECT c.id FROM enterprise.connectors c
      JOIN enterprise.user_organization_roles uor ON c.organization_id = uor.organization_id
      WHERE uor.user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_recommendations_org_policy ON enterprise.snowflake_recommendations
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM enterprise.user_organization_roles
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_roi_tracking_org_policy ON enterprise.snowflake_roi_tracking
  FOR ALL
  USING (
    connector_id IN (
      SELECT c.id FROM enterprise.connectors c
      JOIN enterprise.user_organization_roles uor ON c.organization_id = uor.organization_id
      WHERE uor.user_id = auth.uid()
    )
  );

CREATE POLICY snowflake_recommendation_actions_org_policy ON enterprise.snowflake_recommendation_actions
  FOR ALL
  USING (
    recommendation_id IN (
      SELECT id FROM enterprise.snowflake_recommendations
      WHERE organization_id IN (
        SELECT organization_id FROM enterprise.user_organization_roles
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================
-- 11. Functions for recommendation management
-- ============================================

-- Function to expire old recommendations
CREATE OR REPLACE FUNCTION duckcode.expire_old_recommendations()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE enterprise.snowflake_recommendations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$;

-- Function to calculate ROI variance
CREATE OR REPLACE FUNCTION duckcode.calculate_roi_variance()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE enterprise.snowflake_roi_tracking
  SET 
    variance_percent = CASE 
      WHEN projected_savings_usd > 0 
      THEN ((actual_savings_usd - projected_savings_usd) / projected_savings_usd) * 100
      ELSE 0
    END,
    updated_at = NOW()
  WHERE actual_savings_usd IS NOT NULL
    AND variance_percent IS NULL;
END;
$$;

-- ============================================
-- 12. Triggers for updated_at timestamps
-- ============================================

CREATE OR REPLACE FUNCTION duckcode.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_query_patterns_updated_at
  BEFORE UPDATE ON enterprise.snowflake_query_patterns
  FOR EACH ROW
  EXECUTE FUNCTION duckcode.update_updated_at_column();

CREATE TRIGGER update_recommendations_updated_at
  BEFORE UPDATE ON enterprise.snowflake_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION duckcode.update_updated_at_column();

CREATE TRIGGER update_roi_tracking_updated_at
  BEFORE UPDATE ON enterprise.snowflake_roi_tracking
  FOR EACH ROW
  EXECUTE FUNCTION duckcode.update_updated_at_column();

-- ============================================
-- 13. Grant permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON enterprise.snowflake_warehouse_utilization TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON enterprise.snowflake_query_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON enterprise.snowflake_clustering_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON enterprise.snowflake_mv_refresh_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON enterprise.snowflake_task_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON enterprise.snowflake_recommendations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON enterprise.snowflake_roi_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON enterprise.snowflake_recommendation_actions TO authenticated;

-- ============================================
-- Migration Complete
-- ============================================

COMMENT ON SCHEMA duckcode IS 
  'Phase 2 migration completed: Smart Recommendations tables created';
