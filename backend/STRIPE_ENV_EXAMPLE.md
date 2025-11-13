# Stripe Environment Variables

Add these to your `/backend/.env` file:

```bash
# =====================================================
# STRIPE CONFIGURATION
# =====================================================

# Stripe Secret Key (from Stripe Dashboard → Developers → API Keys)
# Test: sk_test_... | Live: sk_live_...
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE

# Stripe Webhook Secret (from Stripe Dashboard → Developers → Webhooks)
# Used to verify webhook signatures
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Stripe Price IDs (from Stripe Dashboard → Products)
# Professional Plan - $75/user/month
STRIPE_PRICE_PROFESSIONAL=price_YOUR_PROFESSIONAL_PRICE_ID

# Enterprise Plan - $125/user/month
STRIPE_PRICE_ENTERPRISE=price_YOUR_ENTERPRISE_PRICE_ID

# =====================================================
# FRONTEND CONFIGURATION
# =====================================================

# Frontend URL for Stripe redirects after checkout
FRONTEND_URL=http://localhost:5175

# =====================================================
# EXISTING CONFIGURATION
# =====================================================

# Keep your existing environment variables:
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - JWT_SECRET
# - etc.
```

## How to Get These Values

### 1. STRIPE_SECRET_KEY

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. In test mode, copy the "Secret key" (starts with `sk_test_`)
3. For production, switch to live mode and copy the live secret key

### 2. STRIPE_WEBHOOK_SECRET

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/stripe/webhook`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. After creating, click the endpoint and reveal the "Signing secret"

### 3. STRIPE_PRICE_PROFESSIONAL

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products)
2. Create a new product:
   - Name: "Professional Plan"
   - Price: $75
   - Billing: Monthly
3. Copy the Price ID (starts with `price_`)

### 4. STRIPE_PRICE_ENTERPRISE

1. Create another product:
   - Name: "Enterprise Plan"
   - Price: $125
   - Billing: Monthly
2. Copy the Price ID

## Testing Locally with Stripe CLI

For local development, use the Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# The CLI will output a webhook secret, use it temporarily:
# STRIPE_WEBHOOK_SECRET=whsec_...
```
