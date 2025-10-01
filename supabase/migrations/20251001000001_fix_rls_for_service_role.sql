-- Fix RLS policies to allow service_role full access for backend operations
-- The backend uses service_role key with custom JWT tokens, not Supabase auth
-- This migration ensures backend can insert/update analytics data

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own conversation analytics" ON duckcode.conversation_analytics;
DROP POLICY IF EXISTS "Users can insert their own conversation analytics" ON duckcode.conversation_analytics;
DROP POLICY IF EXISTS "Users can update their own conversation analytics" ON duckcode.conversation_analytics;
DROP POLICY IF EXISTS "Service role can access all conversation analytics" ON duckcode.conversation_analytics;

DROP POLICY IF EXISTS "Users can view their own daily stats" ON duckcode.daily_conversation_stats;
DROP POLICY IF EXISTS "Users can insert their own daily stats" ON duckcode.daily_conversation_stats;
DROP POLICY IF EXISTS "Users can update their own daily stats" ON duckcode.daily_conversation_stats;
DROP POLICY IF EXISTS "Service role can access all daily stats" ON duckcode.daily_conversation_stats;

DROP POLICY IF EXISTS "Users can view their own weekly stats" ON duckcode.weekly_conversation_stats;
DROP POLICY IF EXISTS "Users can insert their own weekly stats" ON duckcode.weekly_conversation_stats;
DROP POLICY IF EXISTS "Users can update their own weekly stats" ON duckcode.weekly_conversation_stats;
DROP POLICY IF EXISTS "Service role can access all weekly stats" ON duckcode.weekly_conversation_stats;

DROP POLICY IF EXISTS "Users can view their own monthly stats" ON duckcode.monthly_conversation_stats;
DROP POLICY IF EXISTS "Users can insert their own monthly stats" ON duckcode.monthly_conversation_stats;
DROP POLICY IF EXISTS "Users can update their own monthly stats" ON duckcode.monthly_conversation_stats;
DROP POLICY IF EXISTS "Service role can access all monthly stats" ON duckcode.monthly_conversation_stats;

-- Temporarily disable RLS to allow service_role full access
-- The backend uses service_role key which has bypass RLS privileges
ALTER TABLE duckcode.conversation_analytics DISABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.daily_conversation_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.weekly_conversation_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.monthly_conversation_stats DISABLE ROW LEVEL SECURITY;

-- Grant full permissions to service_role (which backend uses)
GRANT ALL ON duckcode.conversation_analytics TO service_role;
GRANT ALL ON duckcode.daily_conversation_stats TO service_role;
GRANT ALL ON duckcode.weekly_conversation_stats TO service_role;
GRANT ALL ON duckcode.monthly_conversation_stats TO service_role;

-- Grant read access to authenticated users (for frontend)
GRANT SELECT ON duckcode.conversation_analytics TO authenticated;
GRANT SELECT ON duckcode.daily_conversation_stats TO authenticated;
GRANT SELECT ON duckcode.weekly_conversation_stats TO authenticated;
GRANT SELECT ON duckcode.monthly_conversation_stats TO authenticated;

-- Grant access to views
GRANT SELECT ON duckcode.conversation_analytics_enriched TO service_role;
GRANT SELECT ON duckcode.conversation_analytics_enriched TO authenticated;
GRANT SELECT ON duckcode.dashboard_summary TO service_role;
GRANT SELECT ON duckcode.dashboard_summary TO authenticated;

-- Ensure sequence permissions for auto-incrementing IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA duckcode TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA duckcode TO authenticated;

-- Comment for documentation
COMMENT ON TABLE duckcode.conversation_analytics IS 'Analytics data for chat conversations. RLS disabled to allow backend service_role access with custom JWT tokens.';
