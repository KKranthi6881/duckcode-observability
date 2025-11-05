-- Security & Access Monitoring Schema
-- Track user access patterns, permissions, and cost attribution

-- User cost attribution (aggregated from query history)
CREATE TABLE IF NOT EXISTS enterprise.snowflake_user_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- User details
    user_name TEXT NOT NULL,
    
    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Cost metrics
    total_queries INTEGER NOT NULL DEFAULT 0,
    total_cost_usd NUMERIC NOT NULL DEFAULT 0,
    compute_cost_usd NUMERIC NOT NULL DEFAULT 0,
    storage_accessed_bytes BIGINT NOT NULL DEFAULT 0,
    
    -- Performance metrics
    avg_execution_time_ms NUMERIC,
    total_execution_time_ms BIGINT DEFAULT 0,
    failed_queries INTEGER DEFAULT 0,
    
    -- Top warehouses used
    top_warehouse_name TEXT,
    top_warehouse_queries INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT unique_user_cost_period UNIQUE (connector_id, user_name, period_start)
);

-- Access patterns and anomalies
CREATE TABLE IF NOT EXISTS enterprise.snowflake_access_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- Access details
    user_name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('login', 'query', 'unusual_access', 'bulk_download', 'permission_change')),
    
    -- Context
    source_ip TEXT,
    client_type TEXT, -- 'UI', 'API', 'JDBC', 'ODBC', etc.
    database_name TEXT,
    schema_name TEXT,
    object_name TEXT,
    object_type TEXT, -- 'TABLE', 'VIEW', 'FUNCTION', etc.
    
    -- Anomaly detection
    is_anomaly BOOLEAN DEFAULT false,
    anomaly_reason TEXT,
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100), -- 0-100
    
    -- Details
    event_details JSONB,
    
    -- Timestamp
    event_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role and permission audit
CREATE TABLE IF NOT EXISTS enterprise.snowflake_role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- Role details
    role_name TEXT NOT NULL,
    grantee_type TEXT NOT NULL CHECK (grantee_type IN ('USER', 'ROLE')),
    grantee_name TEXT NOT NULL,
    
    -- Permission details
    privilege TEXT NOT NULL, -- 'SELECT', 'INSERT', 'DELETE', 'OWNERSHIP', etc.
    granted_on TEXT NOT NULL, -- 'TABLE', 'VIEW', 'SCHEMA', 'DATABASE', 'WAREHOUSE', etc.
    object_name TEXT NOT NULL,
    
    -- Metadata
    granted_by TEXT,
    granted_at TIMESTAMPTZ,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    revoked_at TIMESTAMPTZ,
    
    -- Audit flags
    is_excessive BOOLEAN DEFAULT false, -- Flagged as over-permissioned
    is_unused BOOLEAN DEFAULT false, -- Never used in last 90 days
    
    -- Timestamps
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    CONSTRAINT unique_permission UNIQUE (connector_id, role_name, grantee_name, privilege, granted_on, object_name)
);

-- Top expensive users summary view
CREATE OR REPLACE VIEW enterprise.v_top_expensive_users AS
SELECT 
    uc.connector_id,
    uc.organization_id,
    uc.user_name,
    uc.period_start,
    uc.period_end,
    uc.total_queries,
    uc.total_cost_usd,
    uc.compute_cost_usd,
    uc.failed_queries,
    uc.avg_execution_time_ms,
    uc.top_warehouse_name,
    -- Calculate cost per query
    CASE 
        WHEN uc.total_queries > 0 THEN uc.total_cost_usd / uc.total_queries
        ELSE 0
    END AS cost_per_query,
    -- Calculate failure rate
    CASE 
        WHEN uc.total_queries > 0 THEN (uc.failed_queries::NUMERIC / uc.total_queries) * 100
        ELSE 0
    END AS failure_rate_pct,
    -- Rank by cost
    RANK() OVER (PARTITION BY uc.connector_id, uc.period_start ORDER BY uc.total_cost_usd DESC) AS cost_rank
FROM enterprise.snowflake_user_costs uc;

-- Security issues summary view
CREATE OR REPLACE VIEW enterprise.v_security_issues AS
SELECT 
    connector_id,
    organization_id,
    'over_permissioned_role' AS issue_type,
    role_name AS affected_entity,
    COUNT(*) AS issue_count,
    'high' AS severity,
    'Role has excessive permissions that are not being used' AS description
FROM enterprise.snowflake_role_permissions
WHERE is_excessive = true
GROUP BY connector_id, organization_id, role_name

UNION ALL

SELECT 
    connector_id,
    organization_id,
    'unused_permission' AS issue_type,
    role_name AS affected_entity,
    COUNT(*) AS issue_count,
    'medium' AS severity,
    'Permission granted but never used in 90+ days' AS description
FROM enterprise.snowflake_role_permissions
WHERE is_unused = true
GROUP BY connector_id, organization_id, role_name

UNION ALL

SELECT 
    connector_id,
    organization_id,
    'anomalous_access' AS issue_type,
    user_name AS affected_entity,
    COUNT(*) AS issue_count,
    CASE 
        WHEN MAX(risk_score) >= 80 THEN 'critical'
        WHEN MAX(risk_score) >= 60 THEN 'high'
        ELSE 'medium'
    END AS severity,
    'Unusual access pattern detected' AS description
FROM enterprise.snowflake_access_patterns
WHERE is_anomaly = true
  AND event_timestamp >= NOW() - INTERVAL '30 days'
GROUP BY connector_id, organization_id, user_name;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_costs_connector ON enterprise.snowflake_user_costs(connector_id);
CREATE INDEX IF NOT EXISTS idx_user_costs_period ON enterprise.snowflake_user_costs(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_user_costs_user ON enterprise.snowflake_user_costs(user_name);
CREATE INDEX IF NOT EXISTS idx_access_patterns_connector ON enterprise.snowflake_access_patterns(connector_id);
CREATE INDEX IF NOT EXISTS idx_access_patterns_user ON enterprise.snowflake_access_patterns(user_name);
CREATE INDEX IF NOT EXISTS idx_access_patterns_timestamp ON enterprise.snowflake_access_patterns(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_access_patterns_anomaly ON enterprise.snowflake_access_patterns(is_anomaly) WHERE is_anomaly = true;
CREATE INDEX IF NOT EXISTS idx_role_permissions_connector ON enterprise.snowflake_role_permissions(connector_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON enterprise.snowflake_role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_grantee ON enterprise.snowflake_role_permissions(grantee_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_issues ON enterprise.snowflake_role_permissions(is_excessive, is_unused);

-- Updated_at triggers
CREATE TRIGGER user_costs_updated_at
    BEFORE UPDATE ON enterprise.snowflake_user_costs
    FOR EACH ROW
    EXECUTE FUNCTION enterprise.update_budgets_updated_at();

CREATE TRIGGER role_permissions_updated_at
    BEFORE UPDATE ON enterprise.snowflake_role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION enterprise.update_budgets_updated_at();

-- Function to detect anomalous access patterns
CREATE OR REPLACE FUNCTION enterprise.detect_access_anomalies(
    p_connector_id UUID,
    p_lookback_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    user_name TEXT,
    anomaly_type TEXT,
    risk_score INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Detect users accessing unusual number of tables
    RETURN QUERY
    SELECT 
        ap.user_name,
        'excessive_table_access' AS anomaly_type,
        CASE 
            WHEN COUNT(DISTINCT ap.object_name) > 100 THEN 80
            WHEN COUNT(DISTINCT ap.object_name) > 50 THEN 60
            ELSE 40
        END AS risk_score,
        'User accessed ' || COUNT(DISTINCT ap.object_name)::TEXT || ' different tables in one session' AS description
    FROM enterprise.snowflake_access_patterns ap
    WHERE ap.connector_id = p_connector_id
      AND ap.event_timestamp >= NOW() - INTERVAL '1 day' * p_lookback_days
      AND ap.object_type = 'TABLE'
    GROUP BY ap.user_name, DATE(ap.event_timestamp)
    HAVING COUNT(DISTINCT ap.object_name) > 50;
    
    -- Detect access from new IPs
    RETURN QUERY
    SELECT 
        ap.user_name,
        'new_ip_access' AS anomaly_type,
        70 AS risk_score,
        'User accessed from new IP: ' || ap.source_ip AS description
    FROM enterprise.snowflake_access_patterns ap
    WHERE ap.connector_id = p_connector_id
      AND ap.event_timestamp >= NOW() - INTERVAL '1 day'
      AND ap.source_ip NOT IN (
          SELECT DISTINCT source_ip
          FROM enterprise.snowflake_access_patterns
          WHERE connector_id = p_connector_id
            AND user_name = ap.user_name
            AND event_timestamp < NOW() - INTERVAL '1 day'
            AND event_timestamp >= NOW() - INTERVAL '30 days'
      );
    
    -- Detect unusual query volume
    RETURN QUERY
    SELECT 
        uc.user_name,
        'query_volume_spike' AS anomaly_type,
        90 AS risk_score,
        'Query volume ' || (uc.total_queries / avg_queries.avg)::INTEGER || 'x higher than normal' AS description
    FROM enterprise.snowflake_user_costs uc
    CROSS JOIN (
        SELECT AVG(total_queries) AS avg
        FROM enterprise.snowflake_user_costs
        WHERE connector_id = p_connector_id
          AND user_name = uc.user_name
          AND period_start < uc.period_start
          AND period_start >= NOW() - INTERVAL '90 days'
    ) avg_queries
    WHERE uc.connector_id = p_connector_id
      AND uc.period_start >= CURRENT_DATE - p_lookback_days
      AND avg_queries.avg > 0
      AND uc.total_queries > avg_queries.avg * 3; -- 3x normal volume
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE enterprise.snowflake_user_costs IS 'User-level cost attribution and query metrics';
COMMENT ON TABLE enterprise.snowflake_access_patterns IS 'Detailed access logs with anomaly detection';
COMMENT ON TABLE enterprise.snowflake_role_permissions IS 'Role and permission audit trail';
COMMENT ON VIEW enterprise.v_top_expensive_users IS 'Summary of most expensive users by cost';
COMMENT ON VIEW enterprise.v_security_issues IS 'Aggregated security issues across connectors';
COMMENT ON FUNCTION enterprise.detect_access_anomalies IS 'Detect anomalous access patterns for a connector';
