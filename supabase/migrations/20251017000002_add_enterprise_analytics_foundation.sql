-- =====================================================
-- Enterprise Analytics Enhancement - Phase 1
-- Add organization and API key tracking to analytics
-- BACKWARD COMPATIBLE - Does not break existing flow
-- =====================================================

-- Step 1: Add new columns to existing conversation_analytics table
-- All columns are NULLABLE to maintain backward compatibility
ALTER TABLE duckcode.conversation_analytics
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES enterprise.organizations(id),
ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES enterprise.organization_api_keys(id),
ADD COLUMN IF NOT EXISTS team_id UUID,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS cost_center TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_conv_analytics_org_id 
ON duckcode.conversation_analytics(organization_id) 
WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conv_analytics_api_key_id 
ON duckcode.conversation_analytics(api_key_id) 
WHERE api_key_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conv_analytics_team_id 
ON duckcode.conversation_analytics(team_id) 
WHERE team_id IS NOT NULL;

-- Composite index for org + date queries (very common)
CREATE INDEX IF NOT EXISTS idx_conv_analytics_org_date 
ON duckcode.conversation_analytics(organization_id, started_at DESC) 
WHERE organization_id IS NOT NULL;

-- Step 2: Create organization-level aggregation tables
CREATE TABLE IF NOT EXISTS duckcode.organization_daily_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id),
    usage_date DATE NOT NULL,
    
    -- Conversation counts
    total_conversations INTEGER DEFAULT 0,
    completed_conversations INTEGER DEFAULT 0,
    active_conversations INTEGER DEFAULT 0,
    
    -- User metrics
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0, -- Users who had conversations today
    
    -- Token aggregates
    total_tokens_in BIGINT DEFAULT 0,
    total_tokens_out BIGINT DEFAULT 0,
    total_cache_writes BIGINT DEFAULT 0,
    total_cache_reads BIGINT DEFAULT 0,
    
    -- Cost aggregates
    total_cost DECIMAL(12,6) DEFAULT 0.000000,
    actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
    charged_cost DECIMAL(12,6) DEFAULT 0.000000,
    profit_amount DECIMAL(12,6) DEFAULT 0.000000,
    
    -- Cost breakdown
    input_cost DECIMAL(12,6) DEFAULT 0.000000,
    output_cost DECIMAL(12,6) DEFAULT 0.000000,
    cache_cost DECIMAL(12,6) DEFAULT 0.000000,
    
    -- Usage metrics
    total_messages INTEGER DEFAULT 0,
    total_tool_calls INTEGER DEFAULT 0,
    avg_conversation_duration_minutes DECIMAL(8,2) DEFAULT 0.00,
    
    -- Model breakdown (JSONB for flexibility)
    -- Format: {"claude-3.5-sonnet": {"conversations": 5, "tokens": 1000, "cost": 0.05, "users": 3}}
    model_usage JSONB DEFAULT '{}',
    
    -- API Key breakdown (JSONB)
    -- Format: {"key-id-1": {"key_name": "Prod", "conversations": 10, "cost": 0.50}}
    api_key_usage JSONB DEFAULT '{}',
    
    -- Team/Department breakdown (JSONB)
    team_usage JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, usage_date)
);

-- Step 3: Create API key-level aggregation tables
CREATE TABLE IF NOT EXISTS duckcode.api_key_daily_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID NOT NULL REFERENCES enterprise.organization_api_keys(id),
    organization_id UUID NOT NULL REFERENCES enterprise.organizations(id),
    usage_date DATE NOT NULL,
    
    -- Usage metrics
    total_conversations INTEGER DEFAULT 0,
    completed_conversations INTEGER DEFAULT 0,
    
    -- Token aggregates
    total_tokens_in BIGINT DEFAULT 0,
    total_tokens_out BIGINT DEFAULT 0,
    total_cache_writes BIGINT DEFAULT 0,
    total_cache_reads BIGINT DEFAULT 0,
    
    -- Cost aggregates
    total_cost DECIMAL(12,6) DEFAULT 0.000000,
    actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
    profit_amount DECIMAL(12,6) DEFAULT 0.000000,
    
    -- User metrics
    unique_users INTEGER DEFAULT 0,
    user_list JSONB DEFAULT '[]', -- Array of user_ids who used this key
    
    -- Model breakdown
    model_usage JSONB DEFAULT '{}',
    
    -- Efficiency metrics
    avg_tokens_per_conversation DECIMAL(12,2) DEFAULT 0.00,
    avg_cost_per_conversation DECIMAL(12,6) DEFAULT 0.000000,
    cache_efficiency_percentage DECIMAL(5,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(api_key_id, usage_date)
);

-- Step 4: Create indexes for new aggregation tables
CREATE INDEX IF NOT EXISTS idx_org_daily_stats_org_date 
ON duckcode.organization_daily_stats(organization_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_org_daily_stats_date 
ON duckcode.organization_daily_stats(usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_api_key_daily_stats_key_date 
ON duckcode.api_key_daily_stats(api_key_id, usage_date DESC);

CREATE INDEX IF NOT EXISTS idx_api_key_daily_stats_org_date 
ON duckcode.api_key_daily_stats(organization_id, usage_date DESC);

-- Step 5: Create function to update organization stats
-- This runs AFTER the existing user stats trigger
CREATE OR REPLACE FUNCTION duckcode.update_organization_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    user_count INTEGER;
BEGIN
    -- Only process if organization_id is present (backward compatible)
    IF NEW.organization_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Use the conversation start date for aggregation
    target_date := DATE(COALESCE(NEW.started_at, NOW()));
    
    -- Skip if essential fields are missing
    IF NEW.model_name IS NULL OR NEW.model_name = '' THEN
        RETURN NEW;
    END IF;
    
    -- Count unique users for this org on this date
    SELECT COUNT(DISTINCT user_id) INTO user_count
    FROM duckcode.conversation_analytics
    WHERE organization_id = NEW.organization_id
      AND DATE(started_at) = target_date;
    
    -- Update organization daily stats
    INSERT INTO duckcode.organization_daily_stats (
        organization_id, usage_date, 
        total_conversations, completed_conversations, active_conversations,
        total_users, active_users,
        total_tokens_in, total_tokens_out, 
        total_cache_writes, total_cache_reads,
        total_cost, actual_api_cost, charged_cost, profit_amount,
        input_cost, output_cost,
        total_messages, total_tool_calls,
        model_usage, api_key_usage,
        updated_at
    ) VALUES (
        NEW.organization_id, target_date,
        1, 
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END,
        user_count,
        user_count,
        COALESCE(NEW.total_tokens_in, 0),
        COALESCE(NEW.total_tokens_out, 0),
        COALESCE(NEW.total_cache_writes, 0),
        COALESCE(NEW.total_cache_reads, 0),
        COALESCE(NEW.total_cost, 0),
        COALESCE(NEW.actual_api_cost, 0),
        COALESCE(NEW.charged_cost, 0),
        COALESCE(NEW.profit_amount, 0),
        COALESCE(NEW.input_cost, 0),
        COALESCE(NEW.output_cost, 0),
        COALESCE(NEW.message_count, 0),
        COALESCE(NEW.tool_call_count, 0),
        -- Model usage
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens_in', COALESCE(NEW.total_tokens_in, 0),
            'tokens_out', COALESCE(NEW.total_tokens_out, 0),
            'cost', COALESCE(NEW.total_cost, 0),
            'users', 1
        )),
        -- API key usage (only if api_key_id present)
        CASE 
            WHEN NEW.api_key_id IS NOT NULL THEN
                jsonb_build_object(NEW.api_key_id::text, jsonb_build_object(
                    'conversations', 1,
                    'cost', COALESCE(NEW.total_cost, 0),
                    'tokens', COALESCE(NEW.total_tokens_in, 0) + COALESCE(NEW.total_tokens_out, 0)
                ))
            ELSE '{}'::jsonb
        END,
        NOW()
    ) ON CONFLICT (organization_id, usage_date) DO UPDATE SET
        total_conversations = duckcode.organization_daily_stats.total_conversations + 1,
        completed_conversations = duckcode.organization_daily_stats.completed_conversations + 
            CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        active_conversations = duckcode.organization_daily_stats.active_conversations + 
            CASE WHEN NEW.status = 'active' THEN 1 ELSE 0 END,
        total_users = user_count,
        active_users = user_count,
        total_tokens_in = duckcode.organization_daily_stats.total_tokens_in + COALESCE(NEW.total_tokens_in, 0),
        total_tokens_out = duckcode.organization_daily_stats.total_tokens_out + COALESCE(NEW.total_tokens_out, 0),
        total_cache_writes = duckcode.organization_daily_stats.total_cache_writes + COALESCE(NEW.total_cache_writes, 0),
        total_cache_reads = duckcode.organization_daily_stats.total_cache_reads + COALESCE(NEW.total_cache_reads, 0),
        total_cost = duckcode.organization_daily_stats.total_cost + COALESCE(NEW.total_cost, 0),
        actual_api_cost = duckcode.organization_daily_stats.actual_api_cost + COALESCE(NEW.actual_api_cost, 0),
        charged_cost = duckcode.organization_daily_stats.charged_cost + COALESCE(NEW.charged_cost, 0),
        profit_amount = duckcode.organization_daily_stats.profit_amount + COALESCE(NEW.profit_amount, 0),
        input_cost = duckcode.organization_daily_stats.input_cost + COALESCE(NEW.input_cost, 0),
        output_cost = duckcode.organization_daily_stats.output_cost + COALESCE(NEW.output_cost, 0),
        total_messages = duckcode.organization_daily_stats.total_messages + COALESCE(NEW.message_count, 0),
        total_tool_calls = duckcode.organization_daily_stats.total_tool_calls + COALESCE(NEW.tool_call_count, 0),
        -- Merge model usage
        model_usage = COALESCE(duckcode.organization_daily_stats.model_usage, '{}'::jsonb) || 
            jsonb_build_object(NEW.model_name, 
                COALESCE(duckcode.organization_daily_stats.model_usage->NEW.model_name, '{}'::jsonb) || 
                jsonb_build_object(
                    'conversations', COALESCE((duckcode.organization_daily_stats.model_usage->NEW.model_name->>'conversations')::integer, 0) + 1,
                    'tokens_in', COALESCE((duckcode.organization_daily_stats.model_usage->NEW.model_name->>'tokens_in')::bigint, 0) + COALESCE(NEW.total_tokens_in, 0),
                    'tokens_out', COALESCE((duckcode.organization_daily_stats.model_usage->NEW.model_name->>'tokens_out')::bigint, 0) + COALESCE(NEW.total_tokens_out, 0),
                    'cost', COALESCE((duckcode.organization_daily_stats.model_usage->NEW.model_name->>'cost')::decimal, 0) + COALESCE(NEW.total_cost, 0)
                )
            ),
        -- Merge API key usage
        api_key_usage = CASE 
            WHEN NEW.api_key_id IS NOT NULL THEN
                COALESCE(duckcode.organization_daily_stats.api_key_usage, '{}'::jsonb) || 
                jsonb_build_object(NEW.api_key_id::text, 
                    COALESCE(duckcode.organization_daily_stats.api_key_usage->NEW.api_key_id::text, '{}'::jsonb) || 
                    jsonb_build_object(
                        'conversations', COALESCE((duckcode.organization_daily_stats.api_key_usage->NEW.api_key_id::text->>'conversations')::integer, 0) + 1,
                        'cost', COALESCE((duckcode.organization_daily_stats.api_key_usage->NEW.api_key_id::text->>'cost')::decimal, 0) + COALESCE(NEW.total_cost, 0),
                        'tokens', COALESCE((duckcode.organization_daily_stats.api_key_usage->NEW.api_key_id::text->>'tokens')::bigint, 0) + COALESCE(NEW.total_tokens_in, 0) + COALESCE(NEW.total_tokens_out, 0)
                    )
                )
            ELSE duckcode.organization_daily_stats.api_key_usage
        END,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for organization stats (runs AFTER existing user stats trigger)
DROP TRIGGER IF EXISTS trigger_update_organization_stats ON duckcode.conversation_analytics;
CREATE TRIGGER trigger_update_organization_stats
    AFTER INSERT OR UPDATE ON duckcode.conversation_analytics
    FOR EACH ROW
    EXECUTE FUNCTION duckcode.update_organization_stats();

-- Step 6: Create function to update API key stats
CREATE OR REPLACE FUNCTION duckcode.update_api_key_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    unique_user_count INTEGER;
BEGIN
    -- Only process if api_key_id is present
    IF NEW.api_key_id IS NULL OR NEW.organization_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    target_date := DATE(COALESCE(NEW.started_at, NOW()));
    
    -- Count unique users for this API key on this date
    SELECT COUNT(DISTINCT user_id) INTO unique_user_count
    FROM duckcode.conversation_analytics
    WHERE api_key_id = NEW.api_key_id
      AND DATE(started_at) = target_date;
    
    -- Update API key daily stats
    INSERT INTO duckcode.api_key_daily_stats (
        api_key_id, organization_id, usage_date,
        total_conversations, completed_conversations,
        total_tokens_in, total_tokens_out,
        total_cache_writes, total_cache_reads,
        total_cost, actual_api_cost, profit_amount,
        unique_users,
        model_usage,
        updated_at
    ) VALUES (
        NEW.api_key_id, NEW.organization_id, target_date,
        1,
        CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        COALESCE(NEW.total_tokens_in, 0),
        COALESCE(NEW.total_tokens_out, 0),
        COALESCE(NEW.total_cache_writes, 0),
        COALESCE(NEW.total_cache_reads, 0),
        COALESCE(NEW.total_cost, 0),
        COALESCE(NEW.actual_api_cost, 0),
        COALESCE(NEW.profit_amount, 0),
        unique_user_count,
        jsonb_build_object(NEW.model_name, jsonb_build_object(
            'conversations', 1,
            'tokens', COALESCE(NEW.total_tokens_in, 0) + COALESCE(NEW.total_tokens_out, 0),
            'cost', COALESCE(NEW.total_cost, 0)
        )),
        NOW()
    ) ON CONFLICT (api_key_id, usage_date) DO UPDATE SET
        total_conversations = duckcode.api_key_daily_stats.total_conversations + 1,
        completed_conversations = duckcode.api_key_daily_stats.completed_conversations + 
            CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END,
        total_tokens_in = duckcode.api_key_daily_stats.total_tokens_in + COALESCE(NEW.total_tokens_in, 0),
        total_tokens_out = duckcode.api_key_daily_stats.total_tokens_out + COALESCE(NEW.total_tokens_out, 0),
        total_cost = duckcode.api_key_daily_stats.total_cost + COALESCE(NEW.total_cost, 0),
        actual_api_cost = duckcode.api_key_daily_stats.actual_api_cost + COALESCE(NEW.actual_api_cost, 0),
        profit_amount = duckcode.api_key_daily_stats.profit_amount + COALESCE(NEW.profit_amount, 0),
        unique_users = unique_user_count,
        model_usage = COALESCE(duckcode.api_key_daily_stats.model_usage, '{}'::jsonb) || 
            jsonb_build_object(NEW.model_name, 
                COALESCE(duckcode.api_key_daily_stats.model_usage->NEW.model_name, '{}'::jsonb) || 
                jsonb_build_object(
                    'conversations', COALESCE((duckcode.api_key_daily_stats.model_usage->NEW.model_name->>'conversations')::integer, 0) + 1,
                    'tokens', COALESCE((duckcode.api_key_daily_stats.model_usage->NEW.model_name->>'tokens')::bigint, 0) + COALESCE(NEW.total_tokens_in, 0) + COALESCE(NEW.total_tokens_out, 0),
                    'cost', COALESCE((duckcode.api_key_daily_stats.model_usage->NEW.model_name->>'cost')::decimal, 0) + COALESCE(NEW.total_cost, 0)
                )
            ),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for API key stats
DROP TRIGGER IF EXISTS trigger_update_api_key_stats ON duckcode.conversation_analytics;
CREATE TRIGGER trigger_update_api_key_stats
    AFTER INSERT OR UPDATE ON duckcode.conversation_analytics
    FOR EACH ROW
    EXECUTE FUNCTION duckcode.update_api_key_stats();

-- Step 7: Grant permissions
GRANT ALL PRIVILEGES ON duckcode.organization_daily_stats TO service_role;
GRANT ALL PRIVILEGES ON duckcode.api_key_daily_stats TO service_role;

GRANT SELECT, INSERT, UPDATE ON duckcode.organization_daily_stats TO authenticated;
GRANT SELECT, INSERT, UPDATE ON duckcode.api_key_daily_stats TO authenticated;

-- Step 8: Enable RLS on new tables
ALTER TABLE duckcode.organization_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE duckcode.api_key_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for organization stats (admin can see their org's stats)
CREATE POLICY "Org admins can view their organization stats" 
ON duckcode.organization_daily_stats
FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id 
        FROM enterprise.user_organization_roles 
        WHERE user_id = auth.uid()
    )
);

-- Service role can do everything
CREATE POLICY "Service role full access to org stats" 
ON duckcode.organization_daily_stats
FOR ALL 
TO service_role
USING (true);

-- RLS policies for API key stats
CREATE POLICY "Org members can view API key stats" 
ON duckcode.api_key_daily_stats
FOR SELECT 
USING (
    organization_id IN (
        SELECT organization_id 
        FROM enterprise.user_organization_roles 
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Service role full access to API key stats" 
ON duckcode.api_key_daily_stats
FOR ALL 
TO service_role
USING (true);

-- Step 9: Create helper view for easy querying
CREATE OR REPLACE VIEW duckcode.organization_analytics_summary AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    o.display_name,
    ods.usage_date,
    ods.total_conversations,
    ods.total_users,
    ods.active_users,
    ods.total_cost,
    ods.actual_api_cost,
    ods.profit_amount,
    ods.total_tokens_in + ods.total_tokens_out as total_tokens,
    ods.model_usage,
    ods.api_key_usage
FROM duckcode.organization_daily_stats ods
JOIN enterprise.organizations o ON o.id = ods.organization_id
ORDER BY ods.usage_date DESC, ods.total_cost DESC;

GRANT SELECT ON duckcode.organization_analytics_summary TO authenticated, service_role;

-- Completion notice
DO $$
BEGIN
    RAISE NOTICE '✅ Enterprise analytics foundation migration complete!';
    RAISE NOTICE '   - Added organization_id, api_key_id columns to conversation_analytics';
    RAISE NOTICE '   - Created organization_daily_stats table';
    RAISE NOTICE '   - Created api_key_daily_stats table';
    RAISE NOTICE '   - Added triggers for automatic aggregation';
    RAISE NOTICE '   - Existing analytics flow remains unchanged';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Next steps:';
    RAISE NOTICE '   1. Backfill organization_id for existing records';
    RAISE NOTICE '   2. Update IDE to send organization_id and api_key_id';
    RAISE NOTICE '   3. Build admin panel UI for organization analytics';
END $$;
