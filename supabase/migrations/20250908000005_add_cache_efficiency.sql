-- Add cache efficiency metric at conversation level for UI display
ALTER TABLE duckcode.conversation_analytics
  ADD COLUMN IF NOT EXISTS cache_efficiency DECIMAL(6,3) DEFAULT 0.000; -- ratio in [0,1], 3 decimals
