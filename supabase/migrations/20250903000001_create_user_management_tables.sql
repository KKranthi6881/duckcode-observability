-- Create dedicated duckcode schema for security isolation
-- This migration creates a separate schema for DuckCode application data

-- Create duckcode schema
CREATE SCHEMA IF NOT EXISTS duckcode;

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA duckcode TO authenticated;
GRANT USAGE ON SCHEMA duckcode TO service_role;

-- Create user profiles table in duckcode schema
CREATE TABLE IF NOT EXISTS duckcode.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free' NOT NULL,
  total_tokens_used INTEGER DEFAULT 0 NOT NULL,
  monthly_tokens_used INTEGER DEFAULT 0 NOT NULL,
  last_reset_date DATE DEFAULT CURRENT_DATE NOT NULL,
  billing_email TEXT,
  company_name TEXT,
  last_login TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create usage_records table in duckcode schema
CREATE TABLE IF NOT EXISTS duckcode.usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens INTEGER NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  prompt TEXT,
  completion TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create billing_info table in duckcode schema
CREATE TABLE IF NOT EXISTS duckcode.billing_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  monthly_usage_cost DECIMAL(10,2) DEFAULT 0.00,
  total_cost DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create subscription_tiers table in duckcode schema
CREATE TABLE IF NOT EXISTS duckcode.subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10,2) NOT NULL,
  token_limit INTEGER,
  features JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default subscription tiers
INSERT INTO duckcode.subscription_tiers (name, display_name, description, monthly_price, token_limit, features) VALUES
  ('free', 'Free', 'Basic usage with limited tokens', 0.00, 10000, '{"support": "community", "models": ["gpt-3.5-turbo"]}'),
  ('pro', 'Pro', 'Enhanced usage for professionals', 29.99, 100000, '{"support": "email", "models": ["gpt-3.5-turbo", "gpt-4"], "priority": true}'),
  ('enterprise', 'Enterprise', 'Unlimited usage for teams', 99.99, null, '{"support": "priority", "models": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"], "priority": true, "analytics": true}')
ON CONFLICT (name) DO NOTHING;

-- Create function to sync user profile on auth user creation
CREATE OR REPLACE FUNCTION duckcode.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO duckcode.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION duckcode.handle_new_user();

-- Grant permissions to service role for admin operations
GRANT ALL ON ALL TABLES IN SCHEMA duckcode TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA duckcode TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA duckcode TO service_role;

-- Grant select permissions to authenticated users on subscription tiers
GRANT SELECT ON duckcode.subscription_tiers TO authenticated;

-- Enable Row Level Security (RLS) Policies

-- Enable RLS on user_profiles
ALTER TABLE duckcode.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and modify their own profile
CREATE POLICY "Users can view own profile" ON duckcode.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON duckcode.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON duckcode.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Enable RLS on usage_records
ALTER TABLE duckcode.usage_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own usage records
CREATE POLICY "Users can view own usage records" ON duckcode.usage_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage records" ON duckcode.usage_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable RLS on billing_info
ALTER TABLE duckcode.billing_info ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own billing info
CREATE POLICY "Users can view own billing info" ON duckcode.billing_info
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own billing info" ON duckcode.billing_info
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own billing info" ON duckcode.billing_info
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Enable RLS on subscription_tiers (public read access)
ALTER TABLE duckcode.subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read subscription tiers
CREATE POLICY "Anyone can view subscription tiers" ON duckcode.subscription_tiers
  FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON duckcode.user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON duckcode.user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON duckcode.usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON duckcode.usage_records(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_records_model ON duckcode.usage_records(model);
CREATE INDEX IF NOT EXISTS idx_billing_info_user_id ON duckcode.billing_info(user_id);

-- Create function to automatically update monthly usage
CREATE OR REPLACE FUNCTION duckcode.update_monthly_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user's token usage
  UPDATE duckcode.user_profiles 
  SET 
    total_tokens_used = total_tokens_used + NEW.tokens,
    monthly_tokens_used = CASE 
      WHEN last_reset_date < DATE_TRUNC('month', CURRENT_DATE) THEN NEW.tokens
      ELSE monthly_tokens_used + NEW.tokens
    END,
    last_reset_date = CASE
      WHEN last_reset_date < DATE_TRUNC('month', CURRENT_DATE) THEN CURRENT_DATE
      ELSE last_reset_date
    END,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic usage updates
CREATE TRIGGER trigger_update_monthly_usage
  AFTER INSERT ON duckcode.usage_records
  FOR EACH ROW EXECUTE FUNCTION duckcode.update_monthly_usage();

-- Create function to check usage limits
CREATE OR REPLACE FUNCTION duckcode.check_usage_limit(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_tier TEXT;
  monthly_usage INTEGER;
  tier_limit INTEGER;
BEGIN
  -- Get user's subscription tier and monthly usage
  SELECT subscription_tier, monthly_tokens_used 
  INTO user_tier, monthly_usage
  FROM duckcode.user_profiles 
  WHERE id = user_uuid;
  
  -- Get tier limit
  SELECT token_limit 
  INTO tier_limit
  FROM duckcode.subscription_tiers 
  WHERE name = user_tier;
  
  -- Return true if under limit or no limit (NULL)
  RETURN tier_limit IS NULL OR monthly_usage < tier_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
