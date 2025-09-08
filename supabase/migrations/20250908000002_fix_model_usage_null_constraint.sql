-- Fix model usage stats trigger to handle null model names
-- This prevents the NOT NULL constraint violation when model_name is null

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_update_model_stats ON duckcode.chat_messages;

-- Update the function to handle null model names
CREATE OR REPLACE FUNCTION duckcode.update_model_usage_stats()
RETURNS TRIGGER AS $$
DECLARE
    target_date DATE;
    avg_response_time INTEGER;
    effective_model_name VARCHAR(100);
BEGIN
    -- Skip if model_name is null or empty
    IF NEW.model_name IS NULL OR NEW.model_name = '' THEN
        RETURN NEW;
    END IF;
    
    target_date := DATE(NEW.created_at);
    effective_model_name := NEW.model_name;
    
    -- Calculate average response time for existing records
    SELECT AVG(response_time_ms) INTO avg_response_time 
    FROM duckcode.chat_messages 
    WHERE user_id = NEW.user_id 
      AND model_name = effective_model_name 
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
        effective_model_name,
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

-- Recreate the trigger
CREATE TRIGGER trigger_update_model_stats
    AFTER INSERT ON duckcode.chat_messages
    FOR EACH ROW EXECUTE FUNCTION duckcode.update_model_usage_stats();
