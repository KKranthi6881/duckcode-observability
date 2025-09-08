-- Redesign chat analytics to focus on high-level conversation metrics
-- This migration creates a simplified schema that matches what users see in the IDE

-- Drop existing chat analytics tables to start fresh
DROP TABLE IF EXISTS duckcode.chat_messages CASCADE;
DROP TABLE IF EXISTS duckcode.chat_sessions CASCADE;

-- Create conversation analytics table - this is the main table for tracking chat conversations
CREATE TABLE IF NOT EXISTS duckcode.conversation_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL, -- Use TEXT to match backend implementation
    
    -- Conversation identification
    conversation_id VARCHAR(255) NOT NULL, -- IDE-generated conversation ID
    topic_title TEXT NOT NULL, -- First user message or extracted topic
    
    -- Model and configuration
    model_name VARCHAR(100) NOT NULL,
    provider_name VARCHAR(50), -- anthropic, openai, etc.
    mode_name VARCHAR(100), -- coding, analysis, etc.
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER, -- Total conversation duration
    
    -- Token usage (matches IDE's TokenUsage interface)
    total_tokens_in BIGINT DEFAULT 0,
    total_tokens_out BIGINT DEFAULT 0,
    total_cache_writes BIGINT DEFAULT 0,
    total_cache_reads BIGINT DEFAULT 0,
    context_tokens BIGINT DEFAULT 0, -- Current context size
    
    -- Cost tracking
    total_cost DECIMAL(12,6) DEFAULT 0.000000, -- Higher precision for cost
    input_cost DECIMAL(12,6) DEFAULT 0.000000,
    output_cost DECIMAL(12,6) DEFAULT 0.000000,
    cache_write_cost DECIMAL(12,6) DEFAULT 0.000000,
    cache_read_cost DECIMAL(12,6) DEFAULT 0.000000,
    
    -- Conversation metrics
    message_count INTEGER DEFAULT 0, -- Total messages in conversation
    user_message_count INTEGER DEFAULT 0, -- User messages only
    assistant_message_count INTEGER DEFAULT 0, -- Assistant responses only
    
    -- Tool usage summary
    tools_used JSONB DEFAULT '[]', -- Array of tool names used
    tool_call_count INTEGER DEFAULT 0, -- Total tool calls
    
    -- Status and metadata
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'error')),
    error_message TEXT, -- If conversation ended with error
    workspace_path TEXT, -- Current workspace
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily conversation stats for quick analytics
CREATE TABLE IF NOT EXISTS duckcode.daily_conversation_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    usage_date DATE NOT NULL,
    
    -- Conversation counts
    total_conversations INTEGER DEFAULT 0,
    completed_conversations INTEGER DEFAULT 0,
    active_conversations INTEGER DEFAULT 0,
    
    -- Token aggregates
    total_tokens_in BIGINT DEFAULT 0,
    total_tokens_out BIGINT DEFAULT 0,
    total_cache_writes BIGINT DEFAULT 0,
    total_cache_reads BIGINT DEFAULT 0,
    
    -- Cost aggregates
    total_cost DECIMAL(12,6) DEFAULT 0.000000,
    input_cost DECIMAL(12,6) DEFAULT 0.000000,
    output_cost DECIMAL(12,6) DEFAULT 0.000000,
    cache_cost DECIMAL(12,6) DEFAULT 0.000000,
    
    -- Usage metrics
    total_messages INTEGER DEFAULT 0,
    total_tool_calls INTEGER DEFAULT 0,
    avg_conversation_duration_minutes DECIMAL(8,2) DEFAULT 0.00,
    
    -- Model breakdown (JSONB for flexibility)
    model_usage JSONB DEFAULT '{}', -- {"claude-3-5-sonnet": {"conversations": 5, "tokens": 1000, "cost": 0.05}}
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, usage_date)
);

-- Create weekly conversation stats
CREATE TABLE IF NOT EXISTS duckcode.weekly_conversation_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    week_start_date DATE NOT NULL, -- Monday of the week
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    
    -- Same structure as daily stats but for weekly aggregation
    total_conversations INTEGER DEFAULT 0,
    completed_conversations INTEGER DEFAULT 0,
    total_tokens_in BIGINT DEFAULT 0,
    total_tokens_out BIGINT DEFAULT 0,
    total_cache_writes BIGINT DEFAULT 0,
    total_cache_reads BIGINT DEFAULT 0,
    total_cost DECIMAL(12,6) DEFAULT 0.000000,
    total_messages INTEGER DEFAULT 0,
    total_tool_calls INTEGER DEFAULT 0,
    avg_conversation_duration_minutes DECIMAL(8,2) DEFAULT 0.00,
    model_usage JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, year, week_number)
);

-- Create monthly conversation stats
CREATE TABLE IF NOT EXISTS duckcode.monthly_conversation_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    month_start_date DATE NOT NULL, -- First day of the month
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    
    -- Same structure as daily/weekly stats
    total_conversations INTEGER DEFAULT 0,
    completed_conversations INTEGER DEFAULT 0,
    total_tokens_in BIGINT DEFAULT 0,
    total_tokens_out BIGINT DEFAULT 0,
    total_cache_writes BIGINT DEFAULT 0,
    total_cache_reads BIGINT DEFAULT 0,
    total_cost DECIMAL(12,6) DEFAULT 0.000000,
    total_messages INTEGER DEFAULT 0,
    total_tool_calls INTEGER DEFAULT 0,
    avg_conversation_duration_minutes DECIMAL(8,2) DEFAULT 0.00,
    model_usage JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, year, month)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_user_id ON duckcode.conversation_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_conversation_id ON duckcode.conversation_analytics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_started_at ON duckcode.conversation_analytics(started_at);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_model_name ON duckcode.conversation_analytics(model_name);
CREATE INDEX IF NOT EXISTS idx_conversation_analytics_status ON duckcode.conversation_analytics(status);

CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON duckcode.daily_conversation_stats(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_weekly_stats_user_week ON duckcode.weekly_conversation_stats(user_id, year, week_number);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_user_month ON duckcode.monthly_conversation_stats(user_id, year, month);

-- Create trigger function to update conversation analytics aggregates
CREATE OR REPLACE FUNCTION duckcode.update_conversation_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    week_start DATE;
    month_start DATE;
    week_num INTEGER;
    year_num INTEGER;
    month_num INTEGER;
BEGIN
    -- Use the conversation start date for aggregation
    target_date := DATE(COALESCE(NEW.started_at, NOW()));
    year_num := EXTRACT(YEAR FROM target_date);
    month_num := EXTRACT(MONTH FROM target_date);
    week_num := EXTRACT(WEEK FROM target_date);
    week_start := target_date - EXTRACT(DOW FROM target_date)::INTEGER + 1; -- Monday of the week
    month_start := DATE_TRUNC('month', target_date)::DATE;
    
    -- Skip if essential fields are missing
    IF NEW.user_id IS NULL OR NEW.model_name IS NULL OR NEW.model_name = '' THEN
        RETURN NEW;
    END IF;
    
    -- Update daily stats
    INSERT INTO duckcode.daily_conversation_stats (
        user_id, usage_date, total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_cache_writes, total_cache_reads,
        total_cost, total_messages, total_tool_calls,
        model_usage, updated_at
    ) VALUES (
        NEW.user_id, target_date, 1, 
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        COALESCE(NEW.total_tokens_in, 0),
        COALESCE(NEW.total_tokens_out, 0),
        COALESCE(NEW.total_cache_writes, 0),
        COALESCE(NEW.total_cache_reads, 0),
        COALESCE(NEW.total_cost, 0),
        COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0),
            'cost', COALESCE(NEW.total_cost, 0)
        )),
        NOW()
    ) ON CONFLICT (user_id, usage_date) DO UPDATE SET
        total_conversations = duckcode.daily_conversation_stats.total_conversations + 1,
        completed_conversations = duckcode.daily_conversation_stats.completed_conversations + 
            CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.daily_conversation_stats.total_tokens_in + COALESCE(NEW.total_tokens_in, 0),
        total_tokens_out = duckcode.daily_conversation_stats.total_tokens_out + COALESCE(NEW.total_tokens_out, 0),
        total_cache_writes = duckcode.daily_conversation_stats.total_cache_writes + COALESCE(NEW.total_cache_writes, 0),
        total_cache_reads = duckcode.daily_conversation_stats.total_cache_reads + COALESCE(NEW.total_cache_reads, 0),
        total_cost = duckcode.daily_conversation_stats.total_cost + COALESCE(NEW.total_cost, 0),
        total_messages = duckcode.daily_conversation_stats.total_messages + COALESCE(NEW.message_count, 0),
        total_tool_calls = duckcode.daily_conversation_stats.total_tool_calls + COALESCE(NEW.tool_call_count, 0),
        model_usage = COALESCE(duckcode.daily_conversation_stats.model_usage, '{}'::jsonb) || 
            jsonb_build_object(NEW.model_name, 
                COALESCE(duckcode.daily_conversation_stats.model_usage->NEW.model_name, '{}'::jsonb) || 
                jsonb_build_object(
                    'conversations', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'conversations')::integer, 0) + 1,
                    'tokens_in', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_in')::bigint, 0) + COALESCE(NEW.total_tokens_in, 0),
                    'tokens_out', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'tokens_out')::bigint, 0) + COALESCE(NEW.total_tokens_out, 0),
                    'cost', COALESCE((duckcode.daily_conversation_stats.model_usage->NEW.model_name->>'cost')::decimal, 0) + COALESCE(NEW.total_cost, 0)
                )
            ),
        updated_at = NOW();
    
    -- Update weekly stats (similar pattern)
    INSERT INTO duckcode.weekly_conversation_stats (
        user_id, week_start_date, year, week_number, total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_cache_writes, total_cache_reads,
        total_cost, total_messages, total_tool_calls, model_usage, updated_at
    ) VALUES (
        NEW.user_id, week_start, year_num, week_num, 1,
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        COALESCE(NEW.total_tokens_in, 0), COALESCE(NEW.total_tokens_out, 0),
        COALESCE(NEW.total_cache_writes, 0), COALESCE(NEW.total_cache_reads, 0),
        COALESCE(NEW.total_cost, 0), COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1, 'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0), 'cost', COALESCE(NEW.total_cost, 0)
        )), NOW()
    ) ON CONFLICT (user_id, year, week_number) DO UPDATE SET
        total_conversations = duckcode.weekly_conversation_stats.total_conversations + 1,
        completed_conversations = duckcode.weekly_conversation_stats.completed_conversations + 
            CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.weekly_conversation_stats.total_tokens_in + COALESCE(NEW.total_tokens_in, 0),
        total_tokens_out = duckcode.weekly_conversation_stats.total_tokens_out + COALESCE(NEW.total_tokens_out, 0),
        total_cost = duckcode.weekly_conversation_stats.total_cost + COALESCE(NEW.total_cost, 0),
        updated_at = NOW();
    
    -- Update monthly stats (similar pattern)
    INSERT INTO duckcode.monthly_conversation_stats (
        user_id, month_start_date, year, month, total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out, total_cache_writes, total_cache_reads,
        total_cost, total_messages, total_tool_calls, model_usage, updated_at
    ) VALUES (
        NEW.user_id, month_start, year_num, month_num, 1,
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        COALESCE(NEW.total_tokens_in, 0), COALESCE(NEW.total_tokens_out, 0),
        COALESCE(NEW.total_cache_writes, 0), COALESCE(NEW.total_cache_reads, 0),
        COALESCE(NEW.total_cost, 0), COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1, 'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0), 'cost', COALESCE(NEW.total_cost, 0)
        )), NOW()
    ) ON CONFLICT (user_id, year, month) DO UPDATE SET
        total_conversations = duckcode.monthly_conversation_stats.total_conversations + 1,
        completed_conversations = duckcode.monthly_conversation_stats.completed_conversations + 
            CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.monthly_conversation_stats.total_tokens_in + COALESCE(NEW.total_tokens_in, 0),
        total_tokens_out = duckcode.monthly_conversation_stats.total_tokens_out + COALESCE(NEW.total_tokens_out, 0),
        total_cost = duckcode.monthly_conversation_stats.total_cost + COALESCE(NEW.total_cost, 0),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for conversation analytics
CREATE TRIGGER trigger_update_conversation_stats
    AFTER INSERT OR UPDATE ON duckcode.conversation_analytics
    FOR EACH ROW
    EXECUTE FUNCTION duckcode.update_conversation_stats();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION duckcode.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers
CREATE TRIGGER trigger_conversation_analytics_updated_at
    BEFORE UPDATE ON duckcode.conversation_analytics
    FOR EACH ROW
    EXECUTE FUNCTION duckcode.update_updated_at_column();

-- Grant permissions to service_role for production deployment
GRANT USAGE ON SCHEMA duckcode TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA duckcode TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA duckcode TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA duckcode TO service_role;

-- Grant permissions to authenticated users for RLS policies
GRANT USAGE ON SCHEMA duckcode TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.conversation_analytics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.daily_conversation_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.weekly_conversation_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.monthly_conversation_stats TO authenticated;

-- Enable Row Level Security (RLS) on analytics tables
ALTER TABLE duckcode.conversation_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.daily_conversation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.weekly_conversation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.monthly_conversation_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversation_analytics
CREATE POLICY "Users can view their own conversation analytics" ON duckcode.conversation_analytics
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own conversation analytics" ON duckcode.conversation_analytics
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own conversation analytics" ON duckcode.conversation_analytics
    FOR UPDATE USING (user_id = auth.uid()::text);

-- Create RLS policies for daily stats
CREATE POLICY "Users can view their own daily stats" ON duckcode.daily_conversation_stats
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own daily stats" ON duckcode.daily_conversation_stats
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own daily stats" ON duckcode.daily_conversation_stats
    FOR UPDATE USING (user_id = auth.uid()::text);

-- Create RLS policies for weekly stats
CREATE POLICY "Users can view their own weekly stats" ON duckcode.weekly_conversation_stats
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own weekly stats" ON duckcode.weekly_conversation_stats
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own weekly stats" ON duckcode.weekly_conversation_stats
    FOR UPDATE USING (user_id = auth.uid()::text);

-- Create RLS policies for monthly stats
CREATE POLICY "Users can view their own monthly stats" ON duckcode.monthly_conversation_stats
    FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own monthly stats" ON duckcode.monthly_conversation_stats
    FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own monthly stats" ON duckcode.monthly_conversation_stats
    FOR UPDATE USING (user_id = auth.uid()::text);
