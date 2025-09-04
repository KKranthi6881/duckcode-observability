-- Add IDE authentication flow tables
-- This enables OAuth-style authorization code flow for seamless IDE authentication

-- Create authorization codes table for IDE authentication in duckcode schema
CREATE TABLE IF NOT EXISTS duckcode.ide_authorization_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    state VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ide_auth_codes_code ON duckcode.ide_authorization_codes(code);
CREATE INDEX IF NOT EXISTS idx_ide_auth_codes_expires ON duckcode.ide_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_ide_auth_codes_user_state ON duckcode.ide_authorization_codes(user_id, state);

-- Create IDE sessions table for managing active IDE authentication sessions
CREATE TABLE IF NOT EXISTS duckcode.ide_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for IDE sessions
CREATE INDEX IF NOT EXISTS idx_ide_sessions_user_id ON duckcode.ide_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ide_sessions_token ON duckcode.ide_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_ide_sessions_expires ON duckcode.ide_sessions(expires_at);

-- Add RLS policies for authorization codes
ALTER TABLE duckcode.ide_authorization_codes ENABLE ROW LEVEL SECURITY;

-- Users can only access their own authorization codes
CREATE POLICY "Users can access own auth codes" ON duckcode.ide_authorization_codes
    FOR ALL USING (auth.uid() = user_id);

-- Add RLS policies for IDE sessions
ALTER TABLE duckcode.ide_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own IDE sessions
CREATE POLICY "Users can access own IDE sessions" ON duckcode.ide_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Function to clean up expired authorization codes
CREATE OR REPLACE FUNCTION duckcode.cleanup_expired_auth_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM duckcode.ide_authorization_codes 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired IDE sessions
CREATE OR REPLACE FUNCTION duckcode.cleanup_expired_ide_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM duckcode.ide_sessions 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION duckcode.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_ide_auth_codes_updated_at
    BEFORE UPDATE ON duckcode.ide_authorization_codes
    FOR EACH ROW EXECUTE FUNCTION duckcode.update_updated_at_column();

CREATE TRIGGER update_ide_sessions_updated_at
    BEFORE UPDATE ON duckcode.ide_sessions
    FOR EACH ROW EXECUTE FUNCTION duckcode.update_updated_at_column();

-- Grant permissions to service role and authenticated users
GRANT ALL ON duckcode.ide_authorization_codes TO service_role;
GRANT ALL ON duckcode.ide_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON duckcode.ide_authorization_codes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON duckcode.ide_sessions TO authenticated;
