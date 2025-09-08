-- Make aggregation trigger delta-aware to avoid double counting on UPDATEs
-- and handle completed_conversations only when status flips to 'completed'.

CREATE OR REPLACE FUNCTION duckcode.update_conversation_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    week_start DATE;
    month_start DATE;
    week_num INTEGER;
    year_num INTEGER;
    month_num INTEGER;

    -- Deltas (for UPDATE) or initial values (for INSERT)
    d_tokens_in BIGINT;
    d_tokens_out BIGINT;
    d_cache_writes BIGINT;
    d_cache_reads BIGINT;
    d_total_tokens BIGINT;
    d_cache_tokens BIGINT;
    d_total_cost DECIMAL(12,6);
    d_input_cost DECIMAL(12,6);
    d_output_cost DECIMAL(12,6);
    d_cache_cost DECIMAL(12,6);
    d_messages INTEGER;
    d_tool_calls INTEGER;

    is_insert BOOLEAN := (TG_OP = 'INSERT');
    became_completed BOOLEAN := false;
BEGIN
    target_date := DATE(COALESCE(NEW.started_at, NOW()));
    year_num := EXTRACT(YEAR FROM target_date);
    month_num := EXTRACT(MONTH FROM target_date);
    week_num := EXTRACT(WEEK FROM target_date);
    week_start := target_date - EXTRACT(DOW FROM target_date)::INTEGER + 1; -- Monday of the week
    month_start := DATE_TRUNC('month', target_date)::DATE;

    IF NEW.user_id IS NULL OR NEW.model_name IS NULL OR NEW.model_name = '' THEN
        RETURN NEW;
    END IF;

    -- Determine deltas
    IF is_insert THEN
        d_tokens_in := COALESCE(NEW.total_tokens_in, 0);
        d_tokens_out := COALESCE(NEW.total_tokens_out, 0);
        d_cache_writes := COALESCE(NEW.total_cache_writes, 0);
        d_cache_reads := COALESCE(NEW.total_cache_reads, 0);
        d_total_tokens := COALESCE(NEW.total_tokens, COALESCE(NEW.total_tokens_in,0) + COALESCE(NEW.total_tokens_out,0));
        d_cache_tokens := COALESCE(NEW.cache_tokens, COALESCE(NEW.total_cache_writes,0) + COALESCE(NEW.total_cache_reads,0));
        d_total_cost := COALESCE(NEW.total_cost, 0);
        d_input_cost := COALESCE(NEW.input_cost, 0);
        d_output_cost := COALESCE(NEW.output_cost, 0);
        d_cache_cost := COALESCE(NEW.cache_write_cost, 0) + COALESCE(NEW.cache_read_cost, 0);
        d_messages := COALESCE(NEW.message_count, 0);
        d_tool_calls := COALESCE(NEW.tool_call_count, 0);
        became_completed := (NEW.status = 'completed');
    ELSE
        d_tokens_in := COALESCE(NEW.total_tokens_in, 0) - COALESCE(OLD.total_tokens_in, 0);
        d_tokens_out := COALESCE(NEW.total_tokens_out, 0) - COALESCE(OLD.total_tokens_out, 0);
        d_cache_writes := COALESCE(NEW.total_cache_writes, 0) - COALESCE(OLD.total_cache_writes, 0);
        d_cache_reads := COALESCE(NEW.total_cache_reads, 0) - COALESCE(OLD.total_cache_reads, 0);
        d_total_tokens := (COALESCE(NEW.total_tokens, COALESCE(NEW.total_tokens_in,0) + COALESCE(NEW.total_tokens_out,0)))
                          - (COALESCE(OLD.total_tokens, COALESCE(OLD.total_tokens_in,0) + COALESCE(OLD.total_tokens_out,0)));
        d_cache_tokens := (COALESCE(NEW.cache_tokens, COALESCE(NEW.total_cache_writes,0) + COALESCE(NEW.total_cache_reads,0)))
                          - (COALESCE(OLD.cache_tokens, COALESCE(OLD.total_cache_writes,0) + COALESCE(OLD.total_cache_reads,0)));
        d_total_cost := COALESCE(NEW.total_cost, 0) - COALESCE(OLD.total_cost, 0);
        d_input_cost := COALESCE(NEW.input_cost, 0) - COALESCE(OLD.input_cost, 0);
        d_output_cost := COALESCE(NEW.output_cost, 0) - COALESCE(OLD.output_cost, 0);
        d_cache_cost := (COALESCE(NEW.cache_write_cost, 0) + COALESCE(NEW.cache_read_cost, 0))
                        - (COALESCE(OLD.cache_write_cost, 0) + COALESCE(OLD.cache_read_cost, 0));
        d_messages := COALESCE(NEW.message_count, 0) - COALESCE(OLD.message_count, 0);
        d_tool_calls := COALESCE(NEW.tool_call_count, 0) - COALESCE(OLD.tool_call_count, 0);
        became_completed := (OLD.status IS DISTINCT FROM 'completed') AND (NEW.status = 'completed');
    END IF;

    -- DAILY
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
        CASE WHEN is_insert THEN 1 ELSE 0 END,
        CASE WHEN became_completed THEN 1 ELSE 0 END,
        GREATEST(d_tokens_in, 0),
        GREATEST(d_tokens_out, 0),
        GREATEST(d_total_tokens, 0),
        GREATEST(d_cache_writes, 0),
        GREATEST(d_cache_reads, 0),
        GREATEST(d_cache_tokens, 0),
        GREATEST(d_total_cost, 0),
        GREATEST(d_input_cost, 0),
        GREATEST(d_output_cost, 0),
        GREATEST(d_cache_cost, 0),
        GREATEST(d_messages, 0),
        GREATEST(d_tool_calls, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', CASE WHEN is_insert THEN 1 ELSE 0 END,
            'tokens_in', GREATEST(d_tokens_in, 0),
            'tokens_out', GREATEST(d_tokens_out, 0),
            'tokens_total', GREATEST(d_total_tokens, 0),
            'cost', GREATEST(d_total_cost, 0)
        )), NOW()
    ) ON CONFLICT (user_id, usage_date) DO UPDATE SET
        total_conversations = duckcode.daily_conversation_stats.total_conversations + CASE WHEN is_insert THEN 1 ELSE 0 END,
        completed_conversations = duckcode.daily_conversation_stats.completed_conversations + CASE WHEN became_completed THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.daily_conversation_stats.total_tokens_in + GREATEST(d_tokens_in, 0),
        total_tokens_out = duckcode.daily_conversation_stats.total_tokens_out + GREATEST(d_tokens_out, 0),
        total_tokens = duckcode.daily_conversation_stats.total_tokens + GREATEST(d_total_tokens, 0),
        total_cache_writes = duckcode.daily_conversation_stats.total_cache_writes + GREATEST(d_cache_writes, 0),
        total_cache_reads = duckcode.daily_conversation_stats.total_cache_reads + GREATEST(d_cache_reads, 0),
        cache_tokens = duckcode.daily_conversation_stats.cache_tokens + GREATEST(d_cache_tokens, 0),
        total_cost = duckcode.daily_conversation_stats.total_cost + GREATEST(d_total_cost, 0),
        input_cost = duckcode.daily_conversation_stats.input_cost + GREATEST(d_input_cost, 0),
        output_cost = duckcode.daily_conversation_stats.output_cost + GREATEST(d_output_cost, 0),
        cache_cost = duckcode.daily_conversation_stats.cache_cost + GREATEST(d_cache_cost, 0),
        total_messages = duckcode.daily_conversation_stats.total_messages + GREATEST(d_messages, 0),
        total_tool_calls = duckcode.daily_conversation_stats.total_tool_calls + GREATEST(d_tool_calls, 0),
        model_usage = COALESCE(duckcode.daily_conversation_stats.model_usage, '{}'::jsonb) || jsonb_build_object(
            NEW.model_name,
            COALESCE(duckcode.daily_conversation_stats.model_usage->NEW.model_name, '{}'::jsonb) || jsonb_build_object(
                'conversations', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'conversations')::integer, 0) + CASE WHEN is_insert THEN 1 ELSE 0 END,
                'tokens_in', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_in')::bigint, 0) + GREATEST(d_tokens_in, 0),
                'tokens_out', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_out')::bigint, 0) + GREATEST(d_tokens_out, 0),
                'tokens_total', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_total')::bigint, 0) + GREATEST(d_total_tokens, 0),
                'cost', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'cost')::decimal, 0) + GREATEST(d_total_cost, 0)
            )
        ),
        updated_at = NOW();

    -- WEEKLY
    INSERT INTO duckcode.weekly_conversation_stats (
        user_id, week_start_date, year, week_number,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_tokens,
        total_cache_writes, total_cache_reads, cache_tokens,
        total_cost, total_messages, total_tool_calls,
        model_usage, updated_at
    ) VALUES (
        NEW.user_id, week_start, year_num, week_num,
        CASE WHEN is_insert THEN 1 ELSE 0 END,
        CASE WHEN became_completed THEN 1 ELSE 0 END,
        GREATEST(d_tokens_in, 0),
        GREATEST(d_tokens_out, 0),
        GREATEST(d_total_tokens, 0),
        GREATEST(d_cache_writes, 0),
        GREATEST(d_cache_reads, 0),
        GREATEST(d_cache_tokens, 0),
        GREATEST(d_total_cost, 0),
        GREATEST(d_messages, 0),
        GREATEST(d_tool_calls, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', CASE WHEN is_insert THEN 1 ELSE 0 END,
            'tokens_in', GREATEST(d_tokens_in, 0),
            'tokens_out', GREATEST(d_tokens_out, 0),
            'tokens_total', GREATEST(d_total_tokens, 0),
            'cost', GREATEST(d_total_cost, 0)
        )),
        NOW()
    ) ON CONFLICT (user_id, year, week_number) DO UPDATE SET
        total_conversations = duckcode.weekly_conversation_stats.total_conversations + CASE WHEN is_insert THEN 1 ELSE 0 END,
        completed_conversations = duckcode.weekly_conversation_stats.completed_conversations + CASE WHEN became_completed THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.weekly_conversation_stats.total_tokens_in + GREATEST(d_tokens_in, 0),
        total_tokens_out = duckcode.weekly_conversation_stats.total_tokens_out + GREATEST(d_tokens_out, 0),
        total_tokens = duckcode.weekly_conversation_stats.total_tokens + GREATEST(d_total_tokens, 0),
        total_cache_writes = duckcode.weekly_conversation_stats.total_cache_writes + GREATEST(d_cache_writes, 0),
        total_cache_reads = duckcode.weekly_conversation_stats.total_cache_reads + GREATEST(d_cache_reads, 0),
        cache_tokens = duckcode.weekly_conversation_stats.cache_tokens + GREATEST(d_cache_tokens, 0),
        total_cost = duckcode.weekly_conversation_stats.total_cost + GREATEST(d_total_cost, 0),
        updated_at = NOW();

    -- MONTHLY
    INSERT INTO duckcode.monthly_conversation_stats (
        user_id, month_start_date, year, month,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_tokens,
        total_cache_writes, total_cache_reads, cache_tokens,
        total_cost, total_messages, total_tool_calls,
        model_usage, updated_at
    ) VALUES (
        NEW.user_id, month_start, year_num, month_num,
        CASE WHEN is_insert THEN 1 ELSE 0 END,
        CASE WHEN became_completed THEN 1 ELSE 0 END,
        GREATEST(d_tokens_in, 0),
        GREATEST(d_tokens_out, 0),
        GREATEST(d_total_tokens, 0),
        GREATEST(d_cache_writes, 0),
        GREATEST(d_cache_reads, 0),
        GREATEST(d_cache_tokens, 0),
        GREATEST(d_total_cost, 0),
        GREATEST(d_messages, 0),
        GREATEST(d_tool_calls, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', CASE WHEN is_insert THEN 1 ELSE 0 END,
            'tokens_in', GREATEST(d_tokens_in, 0),
            'tokens_out', GREATEST(d_tokens_out, 0),
            'tokens_total', GREATEST(d_total_tokens, 0),
            'cost', GREATEST(d_total_cost, 0)
        )),
        NOW()
    ) ON CONFLICT (user_id, year, month) DO UPDATE SET
        total_conversations = duckcode.monthly_conversation_stats.total_conversations + CASE WHEN is_insert THEN 1 ELSE 0 END,
        completed_conversations = duckcode.monthly_conversation_stats.completed_conversations + CASE WHEN became_completed THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.monthly_conversation_stats.total_tokens_in + GREATEST(d_tokens_in, 0),
        total_tokens_out = duckcode.monthly_conversation_stats.total_tokens_out + GREATEST(d_tokens_out, 0),
        total_tokens = duckcode.monthly_conversation_stats.total_tokens + GREATEST(d_total_tokens, 0),
        total_cache_writes = duckcode.monthly_conversation_stats.total_cache_writes + GREATEST(d_cache_writes, 0),
        total_cache_reads = duckcode.monthly_conversation_stats.total_cache_reads + GREATEST(d_cache_reads, 0),
        cache_tokens = duckcode.monthly_conversation_stats.cache_tokens + GREATEST(d_cache_tokens, 0),
        total_cost = duckcode.monthly_conversation_stats.total_cost + GREATEST(d_total_cost, 0),
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
