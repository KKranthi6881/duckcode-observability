-- Helper functions for analytics queries

-- Function to get model breakdown
CREATE OR REPLACE FUNCTION duckcode.get_model_breakdown(p_user_id TEXT)
RETURNS TABLE (
    model_name VARCHAR,
    conversations BIGINT,
    total_cost DECIMAL,
    total_tokens BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ca.model_name,
        COUNT(*)::BIGINT AS conversations,
        SUM(ca.charged_cost)::DECIMAL AS total_cost,
        SUM(ca.total_tokens_in + ca.total_tokens_out)::BIGINT AS total_tokens
    FROM duckcode.conversation_analytics ca
    WHERE ca.user_id = p_user_id
    GROUP BY ca.model_name
    ORDER BY conversations DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION duckcode.get_model_breakdown TO authenticated;
