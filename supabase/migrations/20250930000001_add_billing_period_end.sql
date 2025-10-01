-- Fix billing_info table schema to match backend model
-- The backend expects different columns than what exists in the schema

-- Add missing columns required by SupabaseBilling model
ALTER TABLE duckcode.billing_info 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS monthly_token_limit INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS monthly_request_limit INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS current_tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_requests_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT NOW();

-- Add unique constraint on user_id and billing_period_start for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_info_user_period 
ON duckcode.billing_info(user_id, billing_period_start);

-- Update existing records to set default values
UPDATE duckcode.billing_info 
SET 
  billing_period_start = COALESCE(current_period_start, NOW()),
  billing_period_end = COALESCE(current_period_end, NOW() + INTERVAL '1 month'),
  subscription_tier = 'free',
  monthly_token_limit = 10000,
  monthly_request_limit = 1000,
  current_tokens_used = 0,
  current_requests_used = 0,
  last_updated = NOW()
WHERE billing_period_start IS NULL;

-- Add comments for clarity
COMMENT ON COLUMN duckcode.billing_info.billing_period_start IS 'Start date of the current billing period';
COMMENT ON COLUMN duckcode.billing_info.billing_period_end IS 'End date of the current billing period';
COMMENT ON COLUMN duckcode.billing_info.subscription_tier IS 'User subscription tier (free, pro, enterprise)';
COMMENT ON COLUMN duckcode.billing_info.monthly_token_limit IS 'Maximum tokens allowed per month';
COMMENT ON COLUMN duckcode.billing_info.monthly_request_limit IS 'Maximum requests allowed per month';
COMMENT ON COLUMN duckcode.billing_info.current_tokens_used IS 'Tokens used in current billing period';
COMMENT ON COLUMN duckcode.billing_info.current_requests_used IS 'Requests made in current billing period';
