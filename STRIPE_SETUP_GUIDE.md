# Stripe Subscription Setup Guide

## Overview

This guide walks you through setting up Stripe subscriptions for DuckCode Observability. The system supports:

- **30-day free trial** for all new organizations
- **Professional Plan**: $75/user/month (without OKTA integration)
- **Enterprise Plan**: $125/user/month (with OKTA integration)

## Prerequisites

1. Stripe account (create at [stripe.com](https://stripe.com))
2. Supabase project (already configured)
3. Backend and frontend running locally or deployed

## Step 1: Database Setup

### Run the Migration

Execute the subscription schema migration:

```bash
cd supabase
supabase db push
```

Or apply the migration directly:

```bash
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f supabase/migrations/20251113000001_create_subscription_schema.sql
```

This creates:
- `organization_subscriptions` table
- `subscription_events` audit log
- `payment_methods` table
- `invoices` table
- Helper functions for trial tracking
- Automatic triggers

## Step 2: Stripe Dashboard Configuration

### 1. Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)
3. Keep this secure - you'll add it to `.env`

### 2. Create Products and Prices

#### Professional Plan

1. Go to **Products** → **Add Product**
2. Set:
   - **Name**: Professional Plan
   - **Description**: DuckCode Professional - Column-level lineage, AI optimization, offline IDE
   - **Pricing Model**: Recurring
   - **Price**: $75
   - **Billing Period**: Monthly
   - **Usage is metered**: No
3. Click **Save Product**
4. Copy the **Price ID** (starts with `price_`)

#### Enterprise Plan

1. Create another product:
   - **Name**: Enterprise Plan
   - **Description**: DuckCode Enterprise - All Professional features + OKTA SSO integration
   - **Price**: $125
   - **Billing Period**: Monthly
2. Copy the **Price ID**

### 3. Set Up Webhook

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Set **Endpoint URL**: `https://your-backend-domain.com/api/stripe/webhook`
   - For local testing: `http://localhost:3000/api/stripe/webhook`
3. Select events to listen to:
   ```
   checkout.session.completed
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   invoice.paid
   invoice.payment_failed
   ```
4. Click **Add endpoint**
5. Copy the **Signing secret** (starts with `whsec_`)

### 4. Configure Customer Portal (Optional but Recommended)

1. Go to **Settings** → **Billing** → **Customer Portal**
2. Enable **Customer Portal**
3. Configure:
   - Allow customers to update payment methods ✅
   - Allow customers to view invoices ✅
   - Allow customers to switch plans ✅
   - Allow customers to cancel subscriptions ✅

## Step 3: Backend Configuration

### Update Environment Variables

Add to `/backend/.env`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE

# Stripe Price IDs
STRIPE_PRICE_PROFESSIONAL=price_YOUR_PROFESSIONAL_PRICE_ID
STRIPE_PRICE_ENTERPRISE=price_YOUR_ENTERPRISE_PRICE_ID

# Frontend URL (for redirects)
FRONTEND_URL=http://localhost:5175
```

### Install Dependencies

```bash
cd backend
npm install stripe
```

### Verify Routes are Registered

The routes should already be registered in `backend/src/app.ts`:

```typescript
import subscriptionRoutes from './routes/subscriptions';
import stripeWebhookRoutes from './routes/stripe-webhook';

// Webhook must be before JSON parsing
app.use('/api/stripe/webhook', stripeWebhookRoutes);

// Other routes
app.use('/api/subscriptions', subscriptionRoutes);
```

## Step 4: Frontend Configuration

### Add Subscription Page to Routes

Update `frontend/src/App.tsx` to include the subscription route:

```typescript
import Subscription from './pages/admin/Subscription';

// Inside your routes:
<Route path="/admin/subscription" element={<Subscription />} />
```

### Add to Navigation

Update your admin sidebar to include a link to `/admin/subscription`:

```tsx
<Link to="/admin/subscription">
  <CreditCard className="w-5 h-5 mr-2" />
  Subscription
</Link>
```

## Step 5: Testing

### Test Trial Flow

1. **Create New Organization**
   - Register a new user
   - Organization automatically gets 30-day trial
   - Verify in database:
     ```sql
     SELECT * FROM enterprise.organization_subscriptions 
     WHERE organization_id = 'YOUR_ORG_ID';
     ```

2. **Check Trial Status**
   - API: `GET /api/subscriptions/info`
   - Should return `subscription_status: 'trialing'`
   - `trial_days_remaining` should be ~30

### Test Subscription Flow

1. **Navigate to Subscription Page**
   - Go to `/admin/subscription`
   - Should see trial warning and pricing plans

2. **Subscribe to Professional**
   - Select Professional plan
   - Set seats to 2
   - Click "Subscribe to Professional"
   - You'll be redirected to Stripe Checkout

3. **Use Stripe Test Cards**
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155`
   - Any future expiry date
   - Any CVC

4. **Complete Checkout**
   - Fill in test card details
   - Complete payment
   - You'll be redirected back to your app

5. **Verify Subscription Created**
   ```sql
   SELECT * FROM enterprise.organization_subscriptions 
   WHERE organization_id = 'YOUR_ORG_ID';
   ```
   - `subscription_status` should be 'active'
   - `stripe_subscription_id` should be populated
   - `current_seats` should match what you selected

### Test Webhook Events

1. **Monitor Backend Logs**
   ```bash
   cd backend
   npm run dev
   ```

2. **Trigger Test Webhooks**
   - In Stripe Dashboard → Developers → Webhooks
   - Click your webhook endpoint
   - Click "Send test webhook"
   - Select event types and send

3. **Verify Database Updates**
   ```sql
   SELECT * FROM enterprise.subscription_events 
   WHERE organization_id = 'YOUR_ORG_ID' 
   ORDER BY created_at DESC;
   ```

### Test Customer Portal

1. **Navigate to Subscription Page** (while subscribed)
2. Click **"Manage Subscription"**
3. Opens Stripe Customer Portal
4. Test:
   - Update payment method
   - Change seat count
   - View invoices
   - Cancel subscription

## Step 6: Enforcing Subscription (Optional)

### Add Middleware to Protected Routes

For routes that should only be accessible with active subscription:

```typescript
import { requireActiveSubscription } from '../middleware/subscription';

// Apply to specific routes
router.get('/premium-feature', auth, requireActiveSubscription, handler);
```

### Require Enterprise Plan for Specific Features

```typescript
import { requirePlan } from '../middleware/subscription';

// Only accessible to Enterprise customers
router.post('/sso/configure', auth, requirePlan('enterprise'), handler);
```

### Add Trial Warning Headers

```typescript
import { checkTrialStatus } from '../middleware/subscription';

// Add to all routes to include trial info in headers
app.use(checkTrialStatus);
```

## Production Checklist

Before going live:

- [ ] Switch from Stripe test mode to live mode
- [ ] Update `STRIPE_SECRET_KEY` to live key (`sk_live_...`)
- [ ] Update webhook endpoint to production URL
- [ ] Update `STRIPE_WEBHOOK_SECRET` to live webhook secret
- [ ] Update Price IDs to live product prices
- [ ] Test production checkout with real card
- [ ] Configure tax collection (if applicable)
- [ ] Set up billing alerts
- [ ] Configure invoice emails
- [ ] Add company branding to Stripe Checkout
- [ ] Set up Stripe Billing Portal branding

## API Endpoints

### Subscription Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/subscriptions/plans` | GET | No | Get pricing plans |
| `/api/subscriptions/info` | GET | Yes | Get current subscription |
| `/api/subscriptions/checkout` | POST | Yes | Create checkout session |
| `/api/subscriptions/portal` | POST | Yes | Open customer portal |
| `/api/subscriptions/update-seats` | POST | Yes | Update seat count |
| `/api/subscriptions/cancel` | POST | Yes | Cancel subscription |
| `/api/subscriptions/reactivate` | POST | Yes | Reactivate subscription |
| `/api/subscriptions/events` | GET | Yes | Get subscription events |
| `/api/subscriptions/invoices` | GET | Yes | Get invoices |
| `/api/stripe/webhook` | POST | No | Stripe webhook handler |

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook URL is correct
2. Verify webhook is active in Stripe Dashboard
3. Check firewall/security rules allow Stripe IPs
4. For local testing, use [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

### Subscription Not Updating After Payment

1. Check webhook signature verification
2. Verify `STRIPE_WEBHOOK_SECRET` is correct
3. Check backend logs for webhook processing errors
4. Verify database permissions for service_role

### Trial Not Starting

1. Check trigger is created:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_create_subscription_on_org';
   ```
2. Verify organization was created properly
3. Check subscription_events table for errors

### Payment Failed

1. Use [Stripe test cards](https://stripe.com/docs/testing)
2. Check customer has valid payment method
3. Review invoice in Stripe Dashboard
4. Check webhook logs for `invoice.payment_failed` events

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- Test Cards: https://stripe.com/docs/testing

## Next Steps

1. **Add Email Notifications**: Send emails when trial is ending, payment fails, etc.
2. **Usage-Based Billing**: Track API calls, metadata scans, etc.
3. **Annual Plans**: Add discounted annual pricing
4. **Team Plans**: Different tiers for team sizes
5. **Add-ons**: Charge for additional features separately
6. **Coupons**: Create promotional codes for discounts
