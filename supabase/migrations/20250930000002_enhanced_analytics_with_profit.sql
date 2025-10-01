-- Enhanced Analytics Schema with Profit Tracking and Cost Breakdown
-- This migration adds detailed cost analysis and profit margin tracking

-- Add profit margin and cost breakdown columns to conversation_analytics
ALTER TABLE duckcode.conversation_analytics
ADD COLUMN IF NOT EXISTS actual_api_cost DECIMAL(12,6) DEFAULT 0.000000, -- What we pay to API provider
ADD COLUMN IF NOT EXISTS charged_cost DECIMAL(12,6) DEFAULT 0.000000, -- What we charge user (2x markup)
ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,6) DEFAULT 0.000000, -- Profit = charged - actual
ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(5,2) DEFAULT 100.00, -- Profit margin percentage (default 100%)

-- Add detailed cost breakdown
ADD COLUMN IF NOT EXISTS actual_input_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS actual_output_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS actual_cache_write_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS actual_cache_read_cost DECIMAL(12,6) DEFAULT 0.000000,

-- Add context window tracking for better analytics
ADD COLUMN IF NOT EXISTS max_context_window INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS context_usage_percentage DECIMAL(5,2) DEFAULT 0.00,

-- Add response time tracking
ADD COLUMN IF NOT EXISTS avg_response_time_ms INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_response_time_ms BIGINT DEFAULT 0;

-- Update daily stats to include profit tracking
ALTER TABLE duckcode.daily_conversation_stats
ADD COLUMN IF NOT EXISTS actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS charged_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS avg_profit_per_conversation DECIMAL(12,6) DEFAULT 0.000000,

-- Add cost efficiency metrics
ADD COLUMN IF NOT EXISTS cost_per_1k_tokens DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS cache_efficiency_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Update weekly stats
ALTER TABLE duckcode.weekly_conversation_stats
ADD COLUMN IF NOT EXISTS actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS charged_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS avg_profit_per_conversation DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS cost_per_1k_tokens DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS cache_efficiency_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Update monthly stats
ALTER TABLE duckcode.monthly_conversation_stats
ADD COLUMN IF NOT EXISTS actual_api_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS charged_cost DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS avg_profit_per_conversation DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS cost_per_1k_tokens DECIMAL(12,6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS cache_efficiency_percentage DECIMAL(5,2) DEFAULT 0.00;

-- Create function to calculate profit metrics
CREATE OR REPLACE FUNCTION duckcode.calculate_profit_metrics(
    p_actual_cost DECIMAL,
    p_charged_cost DECIMAL
) RETURNS TABLE (
    profit_amount DECIMAL,
    profit_margin DECIMAL
) AS $$
BEGIN
    RETURN QUERY SELECT
        p_charged_cost - p_actual_cost AS profit_amount,
        CASE 
            WHEN p_actual_cost > 0 THEN ((p_charged_cost - p_actual_cost) / p_actual_cost) * 100
            ELSE 0
        END AS profit_margin;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to calculate cache efficiency
CREATE OR REPLACE FUNCTION duckcode.calculate_cache_efficiency(
    p_cache_reads BIGINT,
    p_total_tokens_in BIGINT
) RETURNS DECIMAL AS $$
BEGIN
    IF p_total_tokens_in > 0 THEN
        RETURN (p_cache_reads::DECIMAL / p_total_tokens_in::DECIMAL) * 100;
    ELSE
        RETURN 0;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create comprehensive analytics view for easy querying
CREATE OR REPLACE VIEW duckcode.conversation_analytics_enriched AS
SELECT 
    ca.*,
    -- Calculate derived metrics
    CASE 
        WHEN ca.max_context_window > 0 THEN 
            (ca.context_tokens::DECIMAL / ca.max_context_window::DECIMAL) * 100
        ELSE 0 
    END AS calculated_context_usage_pct,
    
    CASE 
        WHEN ca.message_count > 0 THEN 
            ca.total_response_time_ms / ca.message_count
        ELSE 0 
    END AS calculated_avg_response_time,
    
    CASE 
        WHEN (ca.total_tokens_in + ca.total_tokens_out) > 0 THEN
            (ca.charged_cost / ((ca.total_tokens_in + ca.total_tokens_out)::DECIMAL / 1000))
        ELSE 0
    END AS cost_per_1k_tokens_calc,
    
    -- Cache efficiency
    duckcode.calculate_cache_efficiency(ca.total_cache_reads, ca.total_tokens_in) AS cache_efficiency_calc,
    
    -- Profit metrics
    (pm.profit_metrics).profit_amount AS calculated_profit,
    (pm.profit_metrics).profit_margin AS calculated_margin
FROM duckcode.conversation_analytics ca
CROSS JOIN LATERAL (
    SELECT duckcode.calculate_profit_metrics(ca.actual_api_cost, ca.charged_cost) AS profit_metrics
) pm;

-- Create materialized view for dashboard performance
CREATE MATERIALIZED VIEW IF NOT EXISTS duckcode.dashboard_summary AS
SELECT 
    user_id,
    -- Today's stats
    SUM(CASE WHEN usage_date = CURRENT_DATE THEN total_conversations ELSE 0 END) AS today_conversations,
    SUM(CASE WHEN usage_date = CURRENT_DATE THEN charged_cost ELSE 0 END) AS today_charged_cost,
    SUM(CASE WHEN usage_date = CURRENT_DATE THEN profit_amount ELSE 0 END) AS today_profit,
    SUM(CASE WHEN usage_date = CURRENT_DATE THEN total_tokens_in + total_tokens_out ELSE 0 END) AS today_tokens,
    
    -- This week's stats
    SUM(CASE WHEN usage_date >= CURRENT_DATE - INTERVAL '7 days' THEN total_conversations ELSE 0 END) AS week_conversations,
    SUM(CASE WHEN usage_date >= CURRENT_DATE - INTERVAL '7 days' THEN charged_cost ELSE 0 END) AS week_charged_cost,
    SUM(CASE WHEN usage_date >= CURRENT_DATE - INTERVAL '7 days' THEN profit_amount ELSE 0 END) AS week_profit,
    
    -- This month's stats
    SUM(CASE WHEN usage_date >= DATE_TRUNC('month', CURRENT_DATE) THEN total_conversations ELSE 0 END) AS month_conversations,
    SUM(CASE WHEN usage_date >= DATE_TRUNC('month', CURRENT_DATE) THEN charged_cost ELSE 0 END) AS month_charged_cost,
    SUM(CASE WHEN usage_date >= DATE_TRUNC('month', CURRENT_DATE) THEN profit_amount ELSE 0 END) AS month_profit,
    
    -- All time stats
    SUM(total_conversations) AS total_conversations,
    SUM(charged_cost) AS total_charged_cost,
    SUM(profit_amount) AS total_profit,
    SUM(total_tokens_in + total_tokens_out) AS total_tokens,
    
    -- Averages
    AVG(cost_per_1k_tokens) AS avg_cost_per_1k_tokens,
    AVG(cache_efficiency_percentage) AS avg_cache_efficiency,
    
    MAX(usage_date) AS last_activity_date
FROM duckcode.daily_conversation_stats
GROUP BY user_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_summary_user_id ON duckcode.dashboard_summary(user_id);

-- Create function to refresh dashboard summary
CREATE OR REPLACE FUNCTION duckcode.refresh_dashboard_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY duckcode.dashboard_summary;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON duckcode.conversation_analytics_enriched TO authenticated;
GRANT SELECT ON duckcode.dashboard_summary TO authenticated;
GRANT EXECUTE ON FUNCTION duckcode.calculate_profit_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION duckcode.calculate_cache_efficiency TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN duckcode.conversation_analytics.actual_api_cost IS 'Actual cost paid to API provider (before markup)';
COMMENT ON COLUMN duckcode.conversation_analytics.charged_cost IS 'Cost charged to user (with 2x markup)';
COMMENT ON COLUMN duckcode.conversation_analytics.profit_amount IS 'Profit = charged_cost - actual_api_cost';
COMMENT ON COLUMN duckcode.conversation_analytics.profit_margin IS 'Profit margin percentage (default 100% for 2x markup)';
COMMENT ON VIEW duckcode.conversation_analytics_enriched IS 'Enriched view with calculated metrics for analytics dashboard';
COMMENT ON MATERIALIZED VIEW duckcode.dashboard_summary IS 'Pre-aggregated dashboard metrics for fast loading';
