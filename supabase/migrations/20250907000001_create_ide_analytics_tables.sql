-- Create comprehensive IDE analytics tracking tables
-- This migration adds detailed usage tracking for DuckCode IDE extension

-- Create chat sessions table to track individual chat conversations
CREATE TABLE IF NOT EXISTS duckcode.chat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL, -- IDE-generated session ID
    topic TEXT, -- Chat topic/title
    model_name VARCHAR(100) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    total_messages INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.0000,
    metadata JSONB DEFAULT '{}', -- Additional session metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat messages table for detailed message tracking
CREATE TABLE IF NOT EXISTS duckcode.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES duckcode.chat_sessions(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant', 'system')),
    content TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    model_name VARCHAR(100),
    response_time_ms INTEGER, -- Response time in milliseconds
    cost DECIMAL(10,4) DEFAULT 0.0000,
    tool_calls JSONB DEFAULT '[]', -- Array of tool calls made
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create IDE usage sessions table for tracking IDE activity
CREATE TABLE IF NOT EXISTS duckcode.ide_usage_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) REFERENCES duckcode.ide_sessions(session_token),
    ide_version VARCHAR(50),
    os_platform VARCHAR(50),
    workspace_path TEXT,
    project_language VARCHAR(50),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER, -- Calculated duration
    files_analyzed INTEGER DEFAULT 0,
    commands_executed INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feature usage tracking table
CREATE TABLE IF NOT EXISTS duckcode.feature_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES duckcode.ide_usage_sessions(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL, -- e.g., 'chat', 'code_analysis', 'file_search'
    action VARCHAR(100) NOT NULL, -- e.g., 'open', 'execute', 'complete'
    count INTEGER DEFAULT 1,
    duration_ms INTEGER, -- Time spent on feature
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create daily usage aggregates for quick analytics
CREATE TABLE IF NOT EXISTS duckcode.daily_usage_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    total_sessions INTEGER DEFAULT 0,
    total_chat_messages INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.0000,
    active_time_minutes INTEGER DEFAULT 0,
    features_used JSONB DEFAULT '{}', -- Feature usage counts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, usage_date)
);

-- Create model usage statistics table
CREATE TABLE IF NOT EXISTS duckcode.model_usage_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    usage_date DATE NOT NULL,
    total_requests INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0.0000,
    avg_response_time_ms INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 100.00, -- Percentage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, model_name, usage_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON duckcode.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_started_at ON duckcode.chat_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON duckcode.chat_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON duckcode.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON duckcode.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON duckcode.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_message_type ON duckcode.chat_messages(message_type);

CREATE INDEX IF NOT EXISTS idx_ide_usage_sessions_user_id ON duckcode.ide_usage_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ide_usage_sessions_started_at ON duckcode.ide_usage_sessions(started_at);

CREATE INDEX IF NOT EXISTS idx_feature_usage_user_id ON duckcode.feature_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_feature_name ON duckcode.feature_usage(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_usage_created_at ON duckcode.feature_usage(created_at);

CREATE INDEX IF NOT EXISTS idx_daily_usage_stats_user_date ON duckcode.daily_usage_stats(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_model_usage_stats_user_model_date ON duckcode.model_usage_stats(user_id, model_name, usage_date);

-- Enable Row Level Security
ALTER TABLE duckcode.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.ide_usage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.daily_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.model_usage_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for chat_sessions
CREATE POLICY "Users can access own chat sessions" ON duckcode.chat_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for chat_messages
CREATE POLICY "Users can access own chat messages" ON duckcode.chat_messages
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for ide_usage_sessions
CREATE POLICY "Users can access own IDE sessions" ON duckcode.ide_usage_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for feature_usage
CREATE POLICY "Users can access own feature usage" ON duckcode.feature_usage
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for daily_usage_stats
CREATE POLICY "Users can access own daily stats" ON duckcode.daily_usage_stats
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for model_usage_stats
CREATE POLICY "Users can access own model stats" ON duckcode.model_usage_stats
    FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON duckcode.chat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.chat_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.ide_usage_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.feature_usage TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.daily_usage_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.model_usage_stats TO authenticated;

-- Function to update daily usage statistics
CREATE OR REPLACE FUNCTION duckcode.update_daily_usage_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    session_record RECORD;
BEGIN
    target_date := DATE(NEW.created_at);
    
    -- Get session info if this is a chat message
    IF TG_TABLE_NAME = 'chat_messages' THEN
        SELECT * INTO session_record FROM duckcode.chat_sessions WHERE id = NEW.session_id;
    END IF;
    
    -- Insert or update daily stats
    INSERT INTO duckcode.daily_usage_stats (
        user_id, 
        usage_date, 
        total_chat_messages,
        total_input_tokens,
        total_output_tokens,
        total_cost
    ) VALUES (
        NEW.user_id,
        target_date,
        CASE WHEN TG_TABLE_NAME = 'chat_messages' THEN 1 ELSE 0 END,
        COALESCE(NEW.input_tokens, 0),
        COALESCE(NEW.output_tokens, 0),
        COALESCE(NEW.cost, 0)
    )
    ON CONFLICT (user_id, usage_date) 
    DO UPDATE SET
        total_chat_messages = duckcode.daily_usage_stats.total_chat_messages + 
            CASE WHEN TG_TABLE_NAME = 'chat_messages' THEN 1 ELSE 0 END,
        total_input_tokens = duckcode.daily_usage_stats.total_input_tokens + COALESCE(NEW.input_tokens, 0),
        total_output_tokens = duckcode.daily_usage_stats.total_output_tokens + COALESCE(NEW.output_tokens, 0),
        total_cost = duckcode.daily_usage_stats.total_cost + COALESCE(NEW.cost, 0),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic daily stats updates
CREATE TRIGGER trigger_update_daily_stats_from_messages
    AFTER INSERT ON duckcode.chat_messages
    FOR EACH ROW EXECUTE FUNCTION duckcode.update_daily_usage_stats();

-- Function to update model usage statistics
CREATE OR REPLACE FUNCTION duckcode.update_model_usage_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    avg_response_time INTEGER;
BEGIN
    target_date := DATE(NEW.created_at);
    
    -- Calculate average response time for existing records
    SELECT AVG(response_time_ms) INTO avg_response_time 
    FROM duckcode.chat_messages 
    WHERE user_id = NEW.user_id 
      AND model_name = NEW.model_name 
      AND DATE(created_at) = target_date;
    
    -- Insert or update model stats
    INSERT INTO duckcode.model_usage_stats (
        user_id,
        model_name,
        usage_date,
        total_requests,
        total_input_tokens,
        total_output_tokens,
        total_cost,
        avg_response_time_ms
    ) VALUES (
        NEW.user_id,
        NEW.model_name,
        target_date,
        1,
        COALESCE(NEW.input_tokens, 0),
        COALESCE(NEW.output_tokens, 0),
        COALESCE(NEW.cost, 0),
        COALESCE(NEW.response_time_ms, 0)
    )
    ON CONFLICT (user_id, model_name, usage_date)
    DO UPDATE SET
        total_requests = duckcode.model_usage_stats.total_requests + 1,
        total_input_tokens = duckcode.model_usage_stats.total_input_tokens + COALESCE(NEW.input_tokens, 0),
        total_output_tokens = duckcode.model_usage_stats.total_output_tokens + COALESCE(NEW.output_tokens, 0),
        total_cost = duckcode.model_usage_stats.total_cost + COALESCE(NEW.cost, 0),
        avg_response_time_ms = COALESCE(avg_response_time, 0),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for model usage stats
CREATE TRIGGER trigger_update_model_stats
    AFTER INSERT ON duckcode.chat_messages
    FOR EACH ROW EXECUTE FUNCTION duckcode.update_model_usage_stats();
