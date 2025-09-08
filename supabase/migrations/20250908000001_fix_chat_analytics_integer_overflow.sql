-- Fix integer overflow issues in chat analytics tables
-- The response_time_ms field was causing overflow with JavaScript timestamps
-- Change INTEGER fields to BIGINT to handle larger values

-- Fix response_time_ms field in chat_messages table
ALTER TABLE duckcode.chat_messages 
ALTER COLUMN response_time_ms TYPE BIGINT;

-- Fix other potentially problematic integer fields
ALTER TABLE duckcode.chat_messages 
ALTER COLUMN input_tokens TYPE BIGINT,
ALTER COLUMN output_tokens TYPE BIGINT;

-- Fix integer fields in chat_sessions table
ALTER TABLE duckcode.chat_sessions 
ALTER COLUMN total_messages TYPE BIGINT,
ALTER COLUMN total_input_tokens TYPE BIGINT,
ALTER COLUMN total_output_tokens TYPE BIGINT;

-- Fix integer fields in ide_usage_sessions table
ALTER TABLE duckcode.ide_usage_sessions 
ALTER COLUMN duration_minutes TYPE BIGINT,
ALTER COLUMN files_analyzed TYPE BIGINT,
ALTER COLUMN commands_executed TYPE BIGINT,
ALTER COLUMN errors_encountered TYPE BIGINT;

-- Fix integer fields in feature_usage table
ALTER TABLE duckcode.feature_usage 
ALTER COLUMN count TYPE BIGINT,
ALTER COLUMN duration_ms TYPE BIGINT;

-- Fix integer fields in daily_usage_stats table
ALTER TABLE duckcode.daily_usage_stats 
ALTER COLUMN total_sessions TYPE BIGINT,
ALTER COLUMN total_chat_messages TYPE BIGINT,
ALTER COLUMN total_input_tokens TYPE BIGINT,
ALTER COLUMN total_output_tokens TYPE BIGINT,
ALTER COLUMN active_time_minutes TYPE BIGINT;

-- Fix integer fields in model_usage_stats table
ALTER TABLE duckcode.model_usage_stats 
ALTER COLUMN total_requests TYPE BIGINT,
ALTER COLUMN total_input_tokens TYPE BIGINT,
ALTER COLUMN total_output_tokens TYPE BIGINT,
ALTER COLUMN avg_response_time_ms TYPE BIGINT;
