-- =====================================================
-- Stripe Subscription Management Schema
-- =====================================================
-- Manages Stripe subscriptions, trials, and billing
-- Supports:
--   - 30-day free trial
--   - $75/user/month (Professional - without OKTA)
--   - $125/user/month (Enterprise - with OKTA)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CREATE SUBSCRIPTION ENUMS
-- =====================================================

CREATE TYPE enterprise.subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused'
);

CREATE TYPE enterprise.subscription_plan AS ENUM (
  'professional', -- $75/user/month - No OKTA
  'enterprise'    -- $125/user/month - With OKTA
);

-- =====================================================
-- 2. ORGANIZATION SUBSCRIPTIONS TABLE
-- =====================================================

CREATE TABLE enterprise.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Stripe IDs
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  
  -- Subscription details
  subscription_plan enterprise.subscription_plan,
  subscription_status enterprise.subscription_status DEFAULT 'trialing' NOT NULL,
  
  -- Pricing
  price_per_seat DECIMAL(10, 2), -- Store actual price per seat
  current_seats INTEGER DEFAULT 1 NOT NULL,
  
  -- Trial tracking
  trial_start_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ,
  is_trial_used BOOLEAN DEFAULT false NOT NULL,
  
  -- Subscription period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
  canceled_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  CONSTRAINT valid_trial_dates CHECK (trial_end_date IS NULL OR trial_end_date > trial_start_date),
  CONSTRAINT valid_period_dates CHECK (current_period_end IS NULL OR current_period_end > current_period_start),
  CONSTRAINT positive_seats CHECK (current_seats > 0)
);

CREATE INDEX idx_org_subs_organization ON enterprise.organization_subscriptions(organization_id);
CREATE INDEX idx_org_subs_stripe_customer ON enterprise.organization_subscriptions(stripe_customer_id);
CREATE INDEX idx_org_subs_stripe_subscription ON enterprise.organization_subscriptions(stripe_subscription_id);
CREATE INDEX idx_org_subs_status ON enterprise.organization_subscriptions(subscription_status);
CREATE INDEX idx_org_subs_trial_end ON enterprise.organization_subscriptions(trial_end_date) WHERE subscription_status = 'trialing';

COMMENT ON TABLE enterprise.organization_subscriptions IS 'Stripe subscription management per organization';
COMMENT ON COLUMN enterprise.organization_subscriptions.trial_start_date IS 'When the 30-day trial started';
COMMENT ON COLUMN enterprise.organization_subscriptions.trial_end_date IS 'When the 30-day trial ends';
COMMENT ON COLUMN enterprise.organization_subscriptions.is_trial_used IS 'Whether organization has used their one-time trial';

-- =====================================================
-- 3. SUBSCRIPTION EVENTS TABLE (Audit log)
-- =====================================================

CREATE TABLE enterprise.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES enterprise.organization_subscriptions(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL, -- e.g., 'trial_started', 'subscription_created', 'payment_failed'
  stripe_event_id TEXT UNIQUE,
  
  previous_status enterprise.subscription_status,
  new_status enterprise.subscription_status,
  
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_sub_events_organization ON enterprise.subscription_events(organization_id);
CREATE INDEX idx_sub_events_subscription ON enterprise.subscription_events(subscription_id);
CREATE INDEX idx_sub_events_type ON enterprise.subscription_events(event_type);
CREATE INDEX idx_sub_events_stripe ON enterprise.subscription_events(stripe_event_id);
CREATE INDEX idx_sub_events_created ON enterprise.subscription_events(created_at DESC);

COMMENT ON TABLE enterprise.subscription_events IS 'Audit log of all subscription-related events';

-- =====================================================
-- 4. PAYMENT METHODS TABLE
-- =====================================================

CREATE TABLE enterprise.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL,
  stripe_payment_method_id TEXT UNIQUE NOT NULL,
  
  is_default BOOLEAN DEFAULT false NOT NULL,
  
  -- Card details (last 4 digits, brand, exp)
  card_brand TEXT,
  card_last4 TEXT,
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_payment_methods_organization ON enterprise.payment_methods(organization_id);
CREATE INDEX idx_payment_methods_stripe ON enterprise.payment_methods(stripe_payment_method_id);
CREATE INDEX idx_payment_methods_default ON enterprise.payment_methods(organization_id, is_default) WHERE is_default = true;

COMMENT ON TABLE enterprise.payment_methods IS 'Stripe payment methods attached to organizations';

-- =====================================================
-- 5. INVOICES TABLE
-- =====================================================

CREATE TABLE enterprise.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES enterprise.organizations(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES enterprise.organization_subscriptions(id) ON DELETE SET NULL,
  
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_hosted_invoice_url TEXT,
  stripe_invoice_pdf TEXT,
  
  amount_due DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'usd' NOT NULL,
  
  invoice_status TEXT NOT NULL, -- 'draft', 'open', 'paid', 'void', 'uncollectible'
  
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_invoices_organization ON enterprise.invoices(organization_id);
CREATE INDEX idx_invoices_subscription ON enterprise.invoices(subscription_id);
CREATE INDEX idx_invoices_stripe ON enterprise.invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON enterprise.invoices(invoice_status);
CREATE INDEX idx_invoices_created ON enterprise.invoices(created_at DESC);

COMMENT ON TABLE enterprise.invoices IS 'Stripe invoices for billing history';

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to check if organization is in valid subscription state
CREATE OR REPLACE FUNCTION enterprise.is_subscription_active(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  sub_record RECORD;
BEGIN
  SELECT subscription_status, trial_end_date 
  INTO sub_record
  FROM enterprise.organization_subscriptions
  WHERE organization_id = org_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Active if status is active or trialing (and trial hasn't expired)
  IF sub_record.subscription_status = 'active' THEN
    RETURN true;
  END IF;
  
  IF sub_record.subscription_status = 'trialing' THEN
    RETURN (sub_record.trial_end_date IS NULL OR sub_record.trial_end_date > now());
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get days remaining in trial
CREATE OR REPLACE FUNCTION enterprise.get_trial_days_remaining(org_id UUID)
RETURNS INTEGER AS $$
DECLARE
  trial_end TIMESTAMPTZ;
BEGIN
  SELECT trial_end_date 
  INTO trial_end
  FROM enterprise.organization_subscriptions
  WHERE organization_id = org_id
    AND subscription_status = 'trialing';
  
  IF NOT FOUND OR trial_end IS NULL THEN
    RETURN 0;
  END IF;
  
  RETURN GREATEST(0, EXTRACT(DAY FROM (trial_end - now()))::INTEGER);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create subscription record when organization is created
CREATE OR REPLACE FUNCTION enterprise.create_subscription_on_org_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Create subscription with 30-day trial
  INSERT INTO enterprise.organization_subscriptions (
    organization_id,
    subscription_status,
    trial_start_date,
    trial_end_date,
    is_trial_used,
    current_seats
  ) VALUES (
    NEW.id,
    'trialing',
    now(),
    now() + INTERVAL '30 days',
    true,
    1
  );
  
  -- Log event
  INSERT INTO enterprise.subscription_events (
    organization_id,
    event_type,
    new_status,
    event_data
  ) VALUES (
    NEW.id,
    'trial_started',
    'trialing',
    jsonb_build_object(
      'trial_days', 30,
      'trial_end_date', now() + INTERVAL '30 days'
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_subscription_on_org
  AFTER INSERT ON enterprise.organizations
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.create_subscription_on_org_creation();

-- Trigger to update organization status based on subscription
CREATE OR REPLACE FUNCTION enterprise.sync_org_status_with_subscription()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE enterprise.organizations
  SET status = CASE
    WHEN NEW.subscription_status = 'trialing' THEN 'trial'::enterprise.organization_status
    WHEN NEW.subscription_status IN ('active', 'past_due') THEN 'active'::enterprise.organization_status
    WHEN NEW.subscription_status IN ('canceled', 'unpaid', 'incomplete_expired') THEN 'suspended'::enterprise.organization_status
    ELSE status
  END,
  updated_at = now()
  WHERE id = NEW.organization_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sync_org_status
  AFTER INSERT OR UPDATE OF subscription_status ON enterprise.organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION enterprise.sync_org_status_with_subscription();

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA enterprise TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA enterprise TO service_role;
GRANT SELECT ON enterprise.organization_subscriptions TO authenticated;
GRANT SELECT ON enterprise.subscription_events TO authenticated;
GRANT SELECT ON enterprise.payment_methods TO authenticated;
GRANT SELECT ON enterprise.invoices TO authenticated;

-- =====================================================
-- 8. ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Update organizations table to track stripe customer
ALTER TABLE enterprise.organizations 
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer 
  ON enterprise.organizations(stripe_customer_id);

COMMENT ON COLUMN enterprise.organizations.stripe_customer_id IS 'Stripe customer ID for billing';

COMMIT;
