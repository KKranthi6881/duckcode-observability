-- Create comprehensive security audit log for enterprise compliance
-- Tracks all security-related events for monitoring and forensics

CREATE TABLE IF NOT EXISTS duckcode.security_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    username VARCHAR(255),
    email VARCHAR(255),
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT,
    location VARCHAR(255), -- Geographic location
    device_id VARCHAR(255), -- Device fingerprint
    session_id VARCHAR(255),
    resource VARCHAR(255), -- Resource being accessed
    action VARCHAR(100), -- Action being performed
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
    message TEXT NOT NULL,
    metadata JSONB, -- Additional event-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_log_user_id ON duckcode.security_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_security_log_event_type ON duckcode.security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_log_severity ON duckcode.security_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_security_log_created_at ON duckcode.security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_log_ip_address ON duckcode.security_audit_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_log_status ON duckcode.security_audit_log(status);
CREATE INDEX IF NOT EXISTS idx_security_log_session_id ON duckcode.security_audit_log(session_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_log_user_created ON duckcode.security_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_log_type_created ON duckcode.security_audit_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_log_severity_created ON duckcode.security_audit_log(severity, created_at DESC);

-- Create GIN index for JSONB metadata searches
CREATE INDEX IF NOT EXISTS idx_security_log_metadata ON duckcode.security_audit_log USING GIN (metadata);

-- Enable RLS
ALTER TABLE duckcode.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role can access all logs
CREATE POLICY "Service role can access all audit logs" ON duckcode.security_audit_log
    FOR ALL USING (true);

-- Users can only view their own audit logs
CREATE POLICY "Users can view own audit logs" ON duckcode.security_audit_log
    FOR SELECT USING (auth.uid() = user_id);

-- Function to automatically cleanup old audit logs (retention policy)
CREATE OR REPLACE FUNCTION duckcode.cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM duckcode.security_audit_log 
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get security event statistics
CREATE OR REPLACE FUNCTION duckcode.get_security_stats(time_range_hours INTEGER DEFAULT 24)
RETURNS TABLE (
    total_events BIGINT,
    critical_events BIGINT,
    error_events BIGINT,
    warning_events BIGINT,
    info_events BIGINT,
    failed_logins BIGINT,
    account_lockouts BIGINT,
    suspicious_activities BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
        COUNT(*) FILTER (WHERE severity = 'error') as error_events,
        COUNT(*) FILTER (WHERE severity = 'warning') as warning_events,
        COUNT(*) FILTER (WHERE severity = 'info') as info_events,
        COUNT(*) FILTER (WHERE event_type = 'login_failed') as failed_logins,
        COUNT(*) FILTER (WHERE event_type = 'account_locked') as account_lockouts,
        COUNT(*) FILTER (WHERE event_type = 'suspicious_activity') as suspicious_activities
    FROM duckcode.security_audit_log
    WHERE created_at >= NOW() - (time_range_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function to detect suspicious patterns
CREATE OR REPLACE FUNCTION duckcode.detect_suspicious_activity(
    check_user_id UUID DEFAULT NULL,
    time_window_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
    user_id UUID,
    ip_address VARCHAR,
    event_count BIGINT,
    failed_login_count BIGINT,
    is_suspicious BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sal.user_id,
        sal.ip_address,
        COUNT(*) as event_count,
        COUNT(*) FILTER (WHERE sal.event_type = 'login_failed') as failed_login_count,
        CASE 
            WHEN COUNT(*) FILTER (WHERE sal.event_type = 'login_failed') >= 5 THEN true
            WHEN COUNT(DISTINCT sal.ip_address) >= 5 THEN true
            ELSE false
        END as is_suspicious
    FROM duckcode.security_audit_log sal
    WHERE sal.created_at >= NOW() - (time_window_minutes || ' minutes')::INTERVAL
        AND (check_user_id IS NULL OR sal.user_id = check_user_id)
    GROUP BY sal.user_id, sal.ip_address
    HAVING COUNT(*) FILTER (WHERE sal.event_type = 'login_failed') >= 3
        OR COUNT(DISTINCT sal.ip_address) >= 5;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON duckcode.security_audit_log TO service_role;
GRANT SELECT ON duckcode.security_audit_log TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE duckcode.security_audit_log IS 'Comprehensive security audit log for enterprise compliance and monitoring';
COMMENT ON COLUMN duckcode.security_audit_log.event_type IS 'Type of security event (login_success, login_failed, etc.)';
COMMENT ON COLUMN duckcode.security_audit_log.severity IS 'Event severity level (info, warning, error, critical)';
COMMENT ON COLUMN duckcode.security_audit_log.metadata IS 'Additional event-specific data in JSON format';
COMMENT ON FUNCTION duckcode.cleanup_old_audit_logs IS 'Removes audit logs older than specified retention period';
COMMENT ON FUNCTION duckcode.get_security_stats IS 'Returns security event statistics for monitoring dashboard';
COMMENT ON FUNCTION duckcode.detect_suspicious_activity IS 'Detects suspicious patterns in security events';
