-- Fix permissions for chat analytics tables to allow service role access
-- This ensures the backend can write analytics data properly

-- Grant full access to service_role (bypasses RLS)
GRANT ALL ON duckcode.chat_sessions TO service_role;
GRANT ALL ON duckcode.chat_messages TO service_role;
GRANT ALL ON duckcode.ide_usage_sessions TO service_role;
GRANT ALL ON duckcode.feature_usage TO service_role;
GRANT ALL ON duckcode.daily_usage_stats TO service_role;
GRANT ALL ON duckcode.model_usage_stats TO service_role;

-- Grant usage on schema to service_role
GRANT USAGE ON SCHEMA duckcode TO service_role;

-- Grant sequence permissions for auto-generated IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA duckcode TO service_role;

-- Create a policy that allows service_role to bypass RLS
CREATE POLICY "Service role can access all chat sessions" ON duckcode.chat_sessions
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can access all chat messages" ON duckcode.chat_messages
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can access all IDE sessions" ON duckcode.ide_usage_sessions
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can access all feature usage" ON duckcode.feature_usage
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can access all daily stats" ON duckcode.daily_usage_stats
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can access all model stats" ON duckcode.model_usage_stats
    FOR ALL TO service_role USING (true);
