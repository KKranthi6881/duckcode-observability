-- Fix RLS policies for analytics tables to work with backend JWT authentication
-- The backend uses custom JWT tokens, not Supabase auth, so auth.uid() is NULL
-- We need to allow service_role to bypass RLS for backend operations

-- Grant service_role access to analytics tables
GRANT ALL ON duckcode.conversation_analytics TO service_role;
GRANT ALL ON duckcode.daily_conversation_stats TO service_role;
GRANT ALL ON duckcode.weekly_conversation_stats TO service_role;
GRANT ALL ON duckcode.monthly_conversation_stats TO service_role;
GRANT ALL ON duckcode.dashboard_summary TO service_role;
GRANT ALL ON duckcode.conversation_analytics_enriched TO service_role;

-- Create policies that allow service_role to bypass RLS
CREATE POLICY "Service role can access all conversation analytics" ON duckcode.conversation_analytics
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can access all daily stats" ON duckcode.daily_conversation_stats
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can access all weekly stats" ON duckcode.weekly_conversation_stats
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can access all monthly stats" ON duckcode.monthly_conversation_stats
    FOR ALL TO service_role USING (true);

-- Grant permissions for helper functions
GRANT EXECUTE ON FUNCTION duckcode.get_model_breakdown TO service_role;
GRANT EXECUTE ON FUNCTION duckcode.calculate_profit_metrics TO service_role;
GRANT EXECUTE ON FUNCTION duckcode.calculate_cache_efficiency TO service_role;

-- Grant access to materialized view
GRANT SELECT ON duckcode.dashboard_summary TO service_role;
GRANT SELECT ON duckcode.conversation_analytics_enriched TO service_role;

-- Also grant to authenticated role for direct API access
GRANT SELECT ON duckcode.dashboard_summary TO authenticated;
GRANT SELECT ON duckcode.conversation_analytics_enriched TO authenticated;
