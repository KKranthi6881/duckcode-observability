-- Enhance conversation analytics to include total tokens and cache efficiency-related fields
-- and propagate them into daily/weekly/monthly aggregates.

-- 1) Add new columns to conversation_analytics
ALTER TABLE duckcode.conversation_analytics
  ADD COLUMN IF NOT EXISTS total_tokens BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_tokens BIGINT DEFAULT 0;

-- 2) Add new columns to aggregated stats tables
ALTER TABLE duckcode.daily_conversation_stats
  ADD COLUMN IF NOT EXISTS total_tokens BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_tokens BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_cost DECIMAL(12,6) DEFAULT 0.000000,
  ADD COLUMN IF NOT EXISTS output_cost DECIMAL(12,6) DEFAULT 0.000000,
  ADD COLUMN IF NOT EXISTS cache_cost DECIMAL(12,6) DEFAULT 0.000000;

ALTER TABLE duckcode.weekly_conversation_stats
  ADD COLUMN IF NOT EXISTS total_tokens BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_tokens BIGINT DEFAULT 0;

ALTER TABLE duckcode.monthly_conversation_stats
  ADD COLUMN IF NOT EXISTS total_tokens BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_tokens BIGINT DEFAULT 0;

-- 3) Update trigger function to accumulate new fields
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
BEGIN
    target_date := DATE(COALESCE(NEW.started_at, NOW()));
    year_num := EXTRACT(YEAR FROM target_date);
    month_num := EXTRACT(MONTH FROM target_date);
    week_num := EXTRACT(WEEK FROM target_date);
    week_start := target_date - EXTRACT(DOW FROM target_date)::INTEGER + 1; -- Monday of the week
    month_start := DATE_TRUNC('month', target_date)::DATE;

    -- Derive totals for convenience
    v_total_tokens := COALESCE(NEW.total_tokens_in, 0) + COALESCE(NEW.total_tokens_out, 0);
    v_cache_tokens := COALESCE(NEW.total_cache_writes, 0) + COALESCE(NEW.total_cache_reads, 0);
    v_cache_cost := COALESCE(NEW.cache_write_cost, 0) + COALESCE(NEW.cache_read_cost, 0);

    IF NEW.user_id IS NULL OR NEW.model_name IS NULL OR NEW.model_name = '' THEN
        RETURN NEW;
    END IF;

    -- Daily stats
    INSERT INTO duckcode.daily_conversation_stats (
        user_id, usage_date,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_tokens,
        total_cache_writes, total_cache_reads, cache_tokens,
        total_cost, input_cost, output_cost, cache_cost,
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
        COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0),
            'tokens_total', v_total_tokens,
            'cost', COALESCE(NEW.total_cost, 0)
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
        total_messages = duckcode.daily_conversation_stats.total_messages + COALESCE(NEW.message_count, 0),
        total_tool_calls = duckcode.daily_conversation_stats.total_tool_calls + COALESCE(NEW.tool_call_count, 0),
        model_usage = COALESCE(duckcode.daily_conversation_stats.model_usage, '{}'::jsonb) || jsonb_build_object(
            NEW.model_name,
            COALESCE(duckcode.daily_conversation_stats.model_usage->NEW.model_name, '{}'::jsonb) || jsonb_build_object(
                'conversations', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'conversations')::integer, 0) + 1,
                'tokens_in', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_in')::bigint, 0) + COALESCE(NEW.total_tokens_in, 0),
                'tokens_out', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_out')::bigint, 0) + COALESCE(NEW.total_tokens_out, 0),
                'tokens_total', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_total')::bigint, 0) + v_total_tokens,
                'cost', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'cost')::decimal, 0) + COALESCE(NEW.total_cost, 0)
            )
        ),
        updated_at = NOW();

    -- Weekly stats
    INSERT INTO duckcode.weekly_conversation_stats (
        user_id, week_start_date, year, week_number,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_tokens,
        total_cache_writes, total_cache_reads, cache_tokens,
        total_cost, total_messages, total_tool_calls,
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
        COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0),
            'tokens_total', v_total_tokens,
            'cost', COALESCE(NEW.total_cost, 0)
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
        updated_at = NOW();

    -- Monthly stats
    INSERT INTO duckcode.monthly_conversation_stats (
        user_id, month_start_date, year, month,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_tokens,
        total_cache_writes, total_cache_reads, cache_tokens,
        total_cost, total_messages, total_tool_calls,
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
        COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0),
            'tokens_total', v_total_tokens,
            'cost', COALESCE(NEW.total_cost, 0)
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
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
