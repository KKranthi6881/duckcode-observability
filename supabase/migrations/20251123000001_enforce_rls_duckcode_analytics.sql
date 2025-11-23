-- =====================================================
-- Enforce Row Level Security on duckcode analytics tables
-- =====================================================
-- This migration re-enables RLS on the core analytics tables and
-- restores per-user policies plus service_role access for backend.

BEGIN;

-- Re-enable RLS on analytics tables
ALTER TABLE duckcode.conversation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.daily_conversation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.weekly_conversation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.monthly_conversation_stats ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies to make migration idempotent
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

-- Recreate user-scoped policies based on user_id (TEXT) matching auth.uid()
CREATE POLICY "Users can view their own conversation analytics"
  ON duckcode.conversation_analytics
  FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own conversation analytics"
  ON duckcode.conversation_analytics
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own conversation analytics"
  ON duckcode.conversation_analytics
  FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can view their own daily stats"
  ON duckcode.daily_conversation_stats
  FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own daily stats"
  ON duckcode.daily_conversation_stats
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own daily stats"
  ON duckcode.daily_conversation_stats
  FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can view their own weekly stats"
  ON duckcode.weekly_conversation_stats
  FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own weekly stats"
  ON duckcode.weekly_conversation_stats
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own weekly stats"
  ON duckcode.weekly_conversation_stats
  FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can view their own monthly stats"
  ON duckcode.monthly_conversation_stats
  FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own monthly stats"
  ON duckcode.monthly_conversation_stats
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own monthly stats"
  ON duckcode.monthly_conversation_stats
  FOR UPDATE
  USING (user_id = auth.uid()::text);

-- Ensure backend service_role can fully access analytics tables
CREATE POLICY "Service role can access all conversation analytics"
  ON duckcode.conversation_analytics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can access all daily stats"
  ON duckcode.daily_conversation_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can access all weekly stats"
  ON duckcode.weekly_conversation_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can access all monthly stats"
  ON duckcode.monthly_conversation_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
