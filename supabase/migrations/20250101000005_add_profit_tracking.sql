-- Add profit tracking and enhanced metrics to conversation analytics
-- This enables enterprise cost analysis and profitability insights

-- Ensure schema exists before proceeding
CREATE SCHEMA IF NOT EXISTS duckcode;

-- Add profit tracking columns to conversation_analytics (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'duckcode' AND tablename = 'conversation_analytics') THEN
        ALTER TABLE duckcode.conversation_analytics
          ADD COLUMN IF NOT EXISTS actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS charged_cost DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(5,2) DEFAULT 0.00,
          ADD COLUMN IF NOT EXISTS session_duration_seconds INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add profit tracking to daily stats (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'duckcode' AND tablename = 'daily_conversation_stats') THEN
        ALTER TABLE duckcode.daily_conversation_stats
          ADD COLUMN IF NOT EXISTS actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS charged_cost DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS avg_profit_margin DECIMAL(5,2) DEFAULT 0.00;
    END IF;
END $$;

-- Add profit tracking to weekly stats (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'duckcode' AND tablename = 'weekly_conversation_stats') THEN
        ALTER TABLE duckcode.weekly_conversation_stats
          ADD COLUMN IF NOT EXISTS actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS charged_cost DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS avg_profit_margin DECIMAL(5,2) DEFAULT 0.00;
    END IF;
END $$;

-- Add profit tracking to monthly stats (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'duckcode' AND tablename = 'monthly_conversation_stats') THEN
        ALTER TABLE duckcode.monthly_conversation_stats
          ADD COLUMN IF NOT EXISTS actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS charged_cost DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,6) DEFAULT 0.000000,
          ADD COLUMN IF NOT EXISTS avg_profit_margin DECIMAL(5,2) DEFAULT 0.00;
    END IF;
END $$;

-- Create index for faster queries on completed conversations (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'duckcode' AND tablename = 'conversation_analytics') THEN
        CREATE INDEX IF NOT EXISTS idx_conversation_analytics_completed_at 
          ON duckcode.conversation_analytics(user_id, completed_at DESC) 
          WHERE completed_at IS NOT NULL;
        
        CREATE INDEX IF NOT EXISTS idx_conversation_analytics_costs 
          ON duckcode.conversation_analytics(user_id, actual_api_cost, charged_cost, profit_amount);
    END IF;
END $$;

-- Update the trigger function to include profit calculations
CREATE OR REPLACE FUNCTION duckcode.update_conversation_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    week_start DATE;
    month_start DATE;
    week_num INTEGER;
    year_num INTEGER;
    month_num INTEGER;
    v_total_tokens BIGINT;
    v_cache_tokens BIGINT;
    v_cache_cost DECIMAL(12,6);
    v_actual_api_cost DECIMAL(12,6);
    v_charged_cost DECIMAL(12,6);
    v_profit_amount DECIMAL(12,6);
BEGIN
    target_date := DATE(COALESCE(NEW.started_at, NOW()));
    year_num := EXTRACT(YEAR FROM target_date);
    month_num := EXTRACT(MONTH FROM target_date);
    week_num := EXTRACT(WEEK FROM target_date);
    week_start := target_date - EXTRACT(DOW FROM target_date)::INTEGER + 1;
    month_start := DATE_TRUNC('month', target_date)::DATE;

    -- Calculate derived metrics
    v_total_tokens := COALESCE(NEW.total_tokens_in, 0) + COALESCE(NEW.total_tokens_out, 0);
    v_cache_tokens := COALESCE(NEW.total_cache_writes, 0) + COALESCE(NEW.total_cache_reads, 0);
    v_cache_cost := COALESCE(NEW.cache_write_cost, 0) + COALESCE(NEW.cache_read_cost, 0);
    v_actual_api_cost := COALESCE(NEW.actual_api_cost, 0);
    v_charged_cost := COALESCE(NEW.charged_cost, COALESCE(NEW.total_cost, 0));
    v_profit_amount := COALESCE(NEW.profit_amount, 0);

    IF NEW.user_id IS NULL OR NEW.model_name IS NULL OR NEW.model_name = '' THEN
        RETURN NEW;
    END IF;

    -- Daily stats with profit tracking
    INSERT INTO duckcode.daily_conversation_stats (
        user_id, usage_date,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_tokens,
        total_cache_writes, total_cache_reads, cache_tokens,
        total_cost, input_cost, output_cost, cache_cost,
        actual_api_cost, charged_cost, profit_amount,
        total_messages, total_tool_calls,
        model_usage, updated_at
    ) VALUES (
        NEW.user_id, target_date,
        1,
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        COALESCE(NEW.total_tokens_in, 0),
        COALESCE(NEW.total_tokens_out, 0),
        v_total_tokens,
        COALESCE(NEW.total_cache_writes, 0),
        COALESCE(NEW.total_cache_reads, 0),
        v_cache_tokens,
        COALESCE(NEW.total_cost, 0),
        COALESCE(NEW.input_cost, 0),
        COALESCE(NEW.output_cost, 0),
        v_cache_cost,
        v_actual_api_cost,
        v_charged_cost,
        v_profit_amount,
        COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0),
            'tokens_total', v_total_tokens,
            'cost', COALESCE(NEW.total_cost, 0),
            'actual_cost', v_actual_api_cost,
            'charged_cost', v_charged_cost,
            'profit', v_profit_amount
        )),
        NOW()
    ) ON CONFLICT (user_id, usage_date) DO UPDATE SET
        total_conversations = duckcode.daily_conversation_stats.total_conversations + 1,
        completed_conversations = duckcode.daily_conversation_stats.completed_conversations + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.daily_conversation_stats.total_tokens_in + COALESCE(NEW.total_tokens_in, 0),
        total_tokens_out = duckcode.daily_conversation_stats.total_tokens_out + COALESCE(NEW.total_tokens_out, 0),
        total_tokens = duckcode.daily_conversation_stats.total_tokens + v_total_tokens,
        total_cache_writes = duckcode.daily_conversation_stats.total_cache_writes + COALESCE(NEW.total_cache_writes, 0),
        total_cache_reads = duckcode.daily_conversation_stats.total_cache_reads + COALESCE(NEW.total_cache_reads, 0),
        cache_tokens = duckcode.daily_conversation_stats.cache_tokens + v_cache_tokens,
        total_cost = duckcode.daily_conversation_stats.total_cost + COALESCE(NEW.total_cost, 0),
        input_cost = duckcode.daily_conversation_stats.input_cost + COALESCE(NEW.input_cost, 0),
        output_cost = duckcode.daily_conversation_stats.output_cost + COALESCE(NEW.output_cost, 0),
        cache_cost = duckcode.daily_conversation_stats.cache_cost + v_cache_cost,
        actual_api_cost = duckcode.daily_conversation_stats.actual_api_cost + v_actual_api_cost,
        charged_cost = duckcode.daily_conversation_stats.charged_cost + v_charged_cost,
        profit_amount = duckcode.daily_conversation_stats.profit_amount + v_profit_amount,
        total_messages = duckcode.daily_conversation_stats.total_messages + COALESCE(NEW.message_count, 0),
        total_tool_calls = duckcode.daily_conversation_stats.total_tool_calls + COALESCE(NEW.tool_call_count, 0),
        model_usage = COALESCE(duckcode.daily_conversation_stats.model_usage, '{}'::jsonb) || jsonb_build_object(
            NEW.model_name,
            COALESCE(duckcode.daily_conversation_stats.model_usage->NEW.model_name, '{}'::jsonb) || jsonb_build_object(
                'conversations', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'conversations')::integer, 0) + 1,
                'tokens_in', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_in')::bigint, 0) + COALESCE(NEW.total_tokens_in, 0),
                'tokens_out', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_out')::bigint, 0) + COALESCE(NEW.total_tokens_out, 0),
                'tokens_total', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_total')::bigint, 0) + v_total_tokens,
                'cost', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'cost')::decimal, 0) + COALESCE(NEW.total_cost, 0),
                'actual_cost', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'actual_cost')::decimal, 0) + v_actual_api_cost,
                'charged_cost', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'charged_cost')::decimal, 0) + v_charged_cost,
                'profit', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'profit')::decimal, 0) + v_profit_amount
            )
        ),
        updated_at = NOW();

    -- Weekly stats with profit tracking
    INSERT INTO duckcode.weekly_conversation_stats (
        user_id, week_start_date, year, week_number,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_tokens,
        total_cache_writes, total_cache_reads, cache_tokens,
        total_cost, actual_api_cost, charged_cost, profit_amount,
        total_messages, total_tool_calls,
        model_usage, updated_at
    ) VALUES (
        NEW.user_id, week_start, year_num, week_num,
        1,
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        COALESCE(NEW.total_tokens_in, 0),
        COALESCE(NEW.total_tokens_out, 0),
        v_total_tokens,
        COALESCE(NEW.total_cache_writes, 0),
        COALESCE(NEW.total_cache_reads, 0),
        v_cache_tokens,
        COALESCE(NEW.total_cost, 0),
        v_actual_api_cost,
        v_charged_cost,
        v_profit_amount,
        COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0),
            'tokens_total', v_total_tokens,
            'cost', COALESCE(NEW.total_cost, 0),
            'profit', v_profit_amount
        )),
        NOW()
    ) ON CONFLICT (user_id, year, week_number) DO UPDATE SET
        total_conversations = duckcode.weekly_conversation_stats.total_conversations + 1,
        completed_conversations = duckcode.weekly_conversation_stats.completed_conversations + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.weekly_conversation_stats.total_tokens_in + COALESCE(NEW.total_tokens_in, 0),
        total_tokens_out = duckcode.weekly_conversation_stats.total_tokens_out + COALESCE(NEW.total_tokens_out, 0),
        total_tokens = duckcode.weekly_conversation_stats.total_tokens + v_total_tokens,
        total_cache_writes = duckcode.weekly_conversation_stats.total_cache_writes + COALESCE(NEW.total_cache_writes, 0),
        total_cache_reads = duckcode.weekly_conversation_stats.total_cache_reads + COALESCE(NEW.total_cache_reads, 0),
        cache_tokens = duckcode.weekly_conversation_stats.cache_tokens + v_cache_tokens,
        total_cost = duckcode.weekly_conversation_stats.total_cost + COALESCE(NEW.total_cost, 0),
        actual_api_cost = duckcode.weekly_conversation_stats.actual_api_cost + v_actual_api_cost,
        charged_cost = duckcode.weekly_conversation_stats.charged_cost + v_charged_cost,
        profit_amount = duckcode.weekly_conversation_stats.profit_amount + v_profit_amount,
        updated_at = NOW();

    -- Monthly stats with profit tracking
    INSERT INTO duckcode.monthly_conversation_stats (
        user_id, month_start_date, year, month,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_tokens,
        total_cache_writes, total_cache_reads, cache_tokens,
        total_cost, actual_api_cost, charged_cost, profit_amount,
        total_messages, total_tool_calls,
        model_usage, updated_at
    ) VALUES (
        NEW.user_id, month_start, year_num, month_num,
        1,
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        COALESCE(NEW.total_tokens_in, 0),
        COALESCE(NEW.total_tokens_out, 0),
        v_total_tokens,
        COALESCE(NEW.total_cache_writes, 0),
        COALESCE(NEW.total_cache_reads, 0),
        v_cache_tokens,
        COALESCE(NEW.total_cost, 0),
        v_actual_api_cost,
        v_charged_cost,
        v_profit_amount,
        COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0),
            'tokens_total', v_total_tokens,
            'cost', COALESCE(NEW.total_cost, 0),
            'profit', v_profit_amount
        )),
        NOW()
    ) ON CONFLICT (user_id, year, month) DO UPDATE SET
        total_conversations = duckcode.monthly_conversation_stats.total_conversations + 1,
        completed_conversations = duckcode.monthly_conversation_stats.completed_conversations + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.monthly_conversation_stats.total_tokens_in + COALESCE(NEW.total_tokens_in, 0),
        total_tokens_out = duckcode.monthly_conversation_stats.total_tokens_out + COALESCE(NEW.total_tokens_out, 0),
        total_tokens = duckcode.monthly_conversation_stats.total_tokens + v_total_tokens,
        total_cache_writes = duckcode.monthly_conversation_stats.total_cache_writes + COALESCE(NEW.total_cache_writes, 0),
        total_cache_reads = duckcode.monthly_conversation_stats.total_cache_reads + COALESCE(NEW.total_cache_reads, 0),
        cache_tokens = duckcode.monthly_conversation_stats.cache_tokens + v_cache_tokens,
        total_cost = duckcode.monthly_conversation_stats.total_cost + COALESCE(NEW.total_cost, 0),
        actual_api_cost = duckcode.monthly_conversation_stats.actual_api_cost + v_actual_api_cost,
        charged_cost = duckcode.monthly_conversation_stats.charged_cost + v_charged_cost,
        profit_amount = duckcode.monthly_conversation_stats.profit_amount + v_profit_amount,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'duckcode' AND tablename = 'conversation_analytics') THEN
        DROP TRIGGER IF EXISTS tr_update_conversation_stats ON duckcode.conversation_analytics;
        CREATE TRIGGER tr_update_conversation_stats
            AFTER INSERT OR UPDATE ON duckcode.conversation_analytics
            FOR EACH ROW
            EXECUTE FUNCTION duckcode.update_conversation_stats();
        
        COMMENT ON COLUMN duckcode.conversation_analytics.actual_api_cost IS 'Actual cost charged by AI provider (before markup)';
        COMMENT ON COLUMN duckcode.conversation_analytics.charged_cost IS 'Cost charged to user (with profit margin)';
        COMMENT ON COLUMN duckcode.conversation_analytics.profit_amount IS 'Profit amount (charged_cost - actual_api_cost)';
        COMMENT ON COLUMN duckcode.conversation_analytics.profit_margin IS 'Profit margin percentage';
        COMMENT ON COLUMN duckcode.conversation_analytics.session_duration_seconds IS 'Duration of conversation session in seconds';
    END IF;
END $$;
