-- Add account lockout and failed login tracking for enterprise security
-- This prevents brute force attacks by locking accounts after failed attempts

-- Create failed login attempts table
CREATE TABLE IF NOT EXISTS duckcode.failed_login_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL, -- email or user_id
    ip_address VARCHAR(45), -- IPv4 or IPv6
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_failed_attempts_identifier ON duckcode.failed_login_attempts(identifier);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_attempted_at ON duckcode.failed_login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_ip ON duckcode.failed_login_attempts(ip_address);

-- Create account lockouts table
CREATE TABLE IF NOT EXISTS duckcode.account_lockouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    identifier VARCHAR(255) UNIQUE NOT NULL, -- email or user_id
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    locked_until TIMESTAMP WITH TIME ZONE NOT NULL,
    reason VARCHAR(100) DEFAULT 'too_many_failed_attempts',
    attempt_count INTEGER DEFAULT 0,
    unlocked_by UUID REFERENCES auth.users(id), -- admin who manually unlocked
    unlocked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for lockouts
CREATE INDEX IF NOT EXISTS idx_lockouts_identifier ON duckcode.account_lockouts(identifier);
CREATE INDEX IF NOT EXISTS idx_lockouts_locked_until ON duckcode.account_lockouts(locked_until);
CREATE INDEX IF NOT EXISTS idx_lockouts_locked_at ON duckcode.account_lockouts(locked_at);

-- Add RLS policies
ALTER TABLE duckcode.failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.account_lockouts ENABLE ROW LEVEL SECURITY;

-- Service role can access all records
CREATE POLICY "Service role can access all failed attempts" ON duckcode.failed_login_attempts
    FOR ALL USING (true);

CREATE POLICY "Service role can access all lockouts" ON duckcode.account_lockouts
    FOR ALL USING (true);

-- Function to automatically cleanup old records
CREATE OR REPLACE FUNCTION duckcode.cleanup_lockout_records()
RETURNS void AS $$
BEGIN
    -- Delete expired lockouts (older than locked_until)
    DELETE FROM duckcode.account_lockouts 
    WHERE locked_until < NOW();
    
    -- Delete old failed attempts (older than 7 days)
    DELETE FROM duckcode.failed_login_attempts 
    WHERE attempted_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_account_lockouts_updated_at
    BEFORE UPDATE ON duckcode.account_lockouts
    FOR EACH ROW EXECUTE FUNCTION duckcode.update_updated_at_column();

-- Grant permissions
GRANT ALL ON duckcode.failed_login_attempts TO service_role;
GRANT ALL ON duckcode.account_lockouts TO service_role;

-- Add comment for documentation
COMMENT ON TABLE duckcode.failed_login_attempts IS 'Tracks failed login attempts for brute force protection';
COMMENT ON TABLE duckcode.account_lockouts IS 'Stores account lockout information after too many failed attempts';
