-- ============================================================================
-- Snowflake Security Monitoring Tables
-- Stores security audit data extracted from SNOWFLAKE.ACCOUNT_USAGE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Login History - Track authentication and access patterns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise.snowflake_login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- Event details
    event_id TEXT NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    event_type TEXT,
    
    -- User information
    user_name TEXT NOT NULL,
    client_ip TEXT,
    reported_client_type TEXT,
    reported_client_version TEXT,
    
    -- Authentication
    first_authentication_factor TEXT, -- PASSWORD, OAUTH, etc.
    second_authentication_factor TEXT, -- MFA details
    is_success BOOLEAN NOT NULL,
    error_code TEXT,
    error_message TEXT,
    
    -- Connection details
    connection TEXT,
    related_event_id TEXT,
    
    -- Metadata
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Indexes
    CONSTRAINT unique_login_event UNIQUE (connector_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_login_history_connector ON enterprise.snowflake_login_history(connector_id);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON enterprise.snowflake_login_history(connector_id, user_name);
CREATE INDEX IF NOT EXISTS idx_login_history_timestamp ON enterprise.snowflake_login_history(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_failed ON enterprise.snowflake_login_history(connector_id, is_success) WHERE is_success = FALSE;
CREATE INDEX IF NOT EXISTS idx_login_history_mfa ON enterprise.snowflake_login_history(connector_id, first_authentication_factor);

-- ----------------------------------------------------------------------------
-- 2. User Role Grants - Track role assignments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise.snowflake_user_role_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- Grant details
    created_on TIMESTAMPTZ,
    role_name TEXT NOT NULL,
    role_owner TEXT,
    grantee_name TEXT NOT NULL, -- User who has the role
    granted_by TEXT,
    granted_on TIMESTAMPTZ,
    
    -- Metadata
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_user_role_grant UNIQUE (connector_id, role_name, grantee_name)
);

CREATE INDEX IF NOT EXISTS idx_user_role_grants_connector ON enterprise.snowflake_user_role_grants(connector_id);
CREATE INDEX IF NOT EXISTS idx_user_role_grants_user ON enterprise.snowflake_user_role_grants(connector_id, grantee_name);
CREATE INDEX IF NOT EXISTS idx_user_role_grants_role ON enterprise.snowflake_user_role_grants(connector_id, role_name);
CREATE INDEX IF NOT EXISTS idx_user_role_grants_admin ON enterprise.snowflake_user_role_grants(connector_id, role_name) 
    WHERE role_name IN ('ACCOUNTADMIN', 'SECURITYADMIN');

-- ----------------------------------------------------------------------------
-- 3. Role Privilege Grants - Track role permissions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise.snowflake_role_privilege_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- Grant details
    created_on TIMESTAMPTZ,
    role_name TEXT NOT NULL,
    privilege TEXT NOT NULL, -- SELECT, INSERT, DELETE, etc.
    granted_on TEXT NOT NULL, -- Object name
    granted_on_type TEXT, -- TABLE, VIEW, DATABASE, etc.
    granted_by TEXT,
    grant_option BOOLEAN,
    
    -- Metadata
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_role_privilege_grant UNIQUE (connector_id, role_name, privilege, granted_on)
);

CREATE INDEX IF NOT EXISTS idx_role_privilege_grants_connector ON enterprise.snowflake_role_privilege_grants(connector_id);
CREATE INDEX IF NOT EXISTS idx_role_privilege_grants_role ON enterprise.snowflake_role_privilege_grants(connector_id, role_name);
CREATE INDEX IF NOT EXISTS idx_role_privilege_grants_type ON enterprise.snowflake_role_privilege_grants(connector_id, granted_on_type);

-- ----------------------------------------------------------------------------
-- 4. Network Policies - Track network security configurations
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise.snowflake_network_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- Policy details
    name TEXT NOT NULL,
    created_on TIMESTAMPTZ,
    owner TEXT,
    comment TEXT,
    
    -- IP allowlists
    allowed_ip_list TEXT[], -- Array of allowed IP ranges
    blocked_ip_list TEXT[], -- Array of blocked IP ranges
    
    -- Metadata
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_network_policy UNIQUE (connector_id, name)
);

CREATE INDEX IF NOT EXISTS idx_network_policies_connector ON enterprise.snowflake_network_policies(connector_id);

-- ----------------------------------------------------------------------------
-- 5. Access History - Track data access patterns
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise.snowflake_access_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- Access details
    query_id TEXT NOT NULL,
    query_start_time TIMESTAMPTZ NOT NULL,
    user_name TEXT NOT NULL,
    
    -- Object accessed
    object_name TEXT NOT NULL,
    object_type TEXT, -- TABLE, VIEW, etc.
    object_domain TEXT, -- Schema
    
    -- Access type
    direct_objects_accessed JSONB, -- Array of objects
    base_objects_accessed JSONB, -- Array of underlying objects
    objects_modified JSONB, -- Array of modified objects
    
    -- Metadata
    extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_access_event UNIQUE (connector_id, query_id, object_name)
);

CREATE INDEX IF NOT EXISTS idx_access_history_connector ON enterprise.snowflake_access_history(connector_id);
CREATE INDEX IF NOT EXISTS idx_access_history_user ON enterprise.snowflake_access_history(connector_id, user_name);
CREATE INDEX IF NOT EXISTS idx_access_history_object ON enterprise.snowflake_access_history(connector_id, object_name);
CREATE INDEX IF NOT EXISTS idx_access_history_time ON enterprise.snowflake_access_history(query_start_time DESC);

-- ----------------------------------------------------------------------------
-- 6. Security Alerts - Detected security issues
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise.snowflake_security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type TEXT NOT NULL, -- STALE_USER, NO_MFA, FAILED_LOGINS, OVERPRIVILEGED_ROLE, etc.
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Related data
    user_name TEXT,
    role_name TEXT,
    ip_address TEXT,
    event_count INTEGER,
    
    -- Evidence
    details JSONB, -- Additional context
    
    -- Status
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    
    -- Metadata
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_connector ON enterprise.snowflake_security_alerts(connector_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON enterprise.snowflake_security_alerts(connector_id, alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON enterprise.snowflake_security_alerts(connector_id, severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON enterprise.snowflake_security_alerts(connector_id, status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON enterprise.snowflake_security_alerts(connector_id, user_name);

-- ----------------------------------------------------------------------------
-- 7. Stale Users - Users who haven't logged in recently
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enterprise.snowflake_stale_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES enterprise.connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id) ON DELETE CASCADE,
    
    -- User details
    user_name TEXT NOT NULL,
    last_login_date TIMESTAMPTZ,
    days_since_login INTEGER,
    
    -- User roles
    assigned_roles TEXT[], -- Array of roles
    has_admin_role BOOLEAN DEFAULT FALSE,
    
    -- Recommendation
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
    recommended_action TEXT, -- 'monitor', 'disable', 'remove'
    
    -- Metadata
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_stale_user UNIQUE (connector_id, user_name)
);

CREATE INDEX IF NOT EXISTS idx_stale_users_connector ON enterprise.snowflake_stale_users(connector_id);
CREATE INDEX IF NOT EXISTS idx_stale_users_risk ON enterprise.snowflake_stale_users(connector_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_stale_users_admin ON enterprise.snowflake_stale_users(connector_id, has_admin_role) WHERE has_admin_role = TRUE;

-- ----------------------------------------------------------------------------
-- Enable RLS (Row Level Security)
-- ----------------------------------------------------------------------------
ALTER TABLE enterprise.snowflake_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_user_role_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_role_privilege_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_network_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_access_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise.snowflake_stale_users ENABLE ROW LEVEL SECURITY;

-- Grant access to service role
GRANT ALL ON enterprise.snowflake_login_history TO service_role;
GRANT ALL ON enterprise.snowflake_user_role_grants TO service_role;
GRANT ALL ON enterprise.snowflake_role_privilege_grants TO service_role;
GRANT ALL ON enterprise.snowflake_network_policies TO service_role;
GRANT ALL ON enterprise.snowflake_access_history TO service_role;
GRANT ALL ON enterprise.snowflake_security_alerts TO service_role;
GRANT ALL ON enterprise.snowflake_stale_users TO service_role;

-- Comments
COMMENT ON TABLE enterprise.snowflake_login_history IS 'Stores Snowflake login events from ACCOUNT_USAGE.LOGIN_HISTORY';
COMMENT ON TABLE enterprise.snowflake_user_role_grants IS 'Stores user role assignments from ACCOUNT_USAGE.GRANTS_TO_USERS';
COMMENT ON TABLE enterprise.snowflake_role_privilege_grants IS 'Stores role privileges from ACCOUNT_USAGE.GRANTS_TO_ROLES';
COMMENT ON TABLE enterprise.snowflake_network_policies IS 'Stores network security policies from ACCOUNT_USAGE.NETWORK_POLICIES';
COMMENT ON TABLE enterprise.snowflake_access_history IS 'Stores data access patterns from ACCOUNT_USAGE.ACCESS_HISTORY';
COMMENT ON TABLE enterprise.snowflake_security_alerts IS 'Auto-detected security issues and anomalies';
COMMENT ON TABLE enterprise.snowflake_stale_users IS 'Users who haven''t logged in recently and should be reviewed';
