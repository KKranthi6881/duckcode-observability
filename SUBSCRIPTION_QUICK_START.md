# Stripe Subscription - Quick Start Guide

This is a simplified guide to get Stripe subscriptions working quickly. For detailed setup, see [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md).

## 🚀 Quick Setup (5 minutes)

### 1. Install Stripe SDK

```bash
cd backend
npm install stripe
```

### 2. Run Database Migration

```bash
cd supabase
supabase db push
```

This creates all subscription tables, triggers, and functions.

### 3. Configure Stripe

1. **Get Stripe Keys**: [Dashboard → API Keys](https://dashboard.stripe.com/test/apikeys)
2. **Create Products**:
   - Professional: $75/month → Copy Price ID
   - Enterprise: $125/month → Copy Price ID
3. **Create Webhook**: [Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
   - URL: `http://localhost:3000/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

### 4. Update Environment Variables

Add to `/backend/.env`:

```bash
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
STRIPE_PRICE_PROFESSIONAL=price_YOUR_PROF_ID
STRIPE_PRICE_ENTERPRISE=price_YOUR_ENT_ID
FRONTEND_URL=http://localhost:5175
```

### 5. Add Subscription Page to Frontend

Update `frontend/src/App.tsx`:

```tsx
import Subscription from './pages/admin/Subscription';

// Add route:
<Route path="/admin/subscription" element={<Subscription />} />
```

### 6. Test It!

1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Register new user → automatic 30-day trial starts
4. Go to `/admin/subscription`
5. Click "Subscribe to Professional"
6. Use test card: `4242 4242 4242 4242`
7. Complete checkout → redirected back with active subscription

## 📋 Pricing Model

| Plan | Price/User/Month | Features |
|------|------------------|----------|
| **Trial** | Free for 30 days | All features unlocked |
| **Professional** | $75 | Column lineage, AI optimization, offline IDE |
| **Enterprise** | $125 | Professional + OKTA SSO integration |

## 🧪 Test Cards

Use these Stripe test cards:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Any future expiry, any CVC.

## 📊 Database Schema

The migration creates:

- `organization_subscriptions` - Main subscription records
- `subscription_events` - Audit log of all changes
- `payment_methods` - Stored payment methods
- `invoices` - Billing history

Plus helper functions:
- `is_subscription_active(org_id)` - Check if subscription is valid
- `get_trial_days_remaining(org_id)` - Get trial countdown

## 🔒 Enforcing Subscriptions (Optional)

Add to routes that require active subscription:

```typescript
import { requireActiveSubscription } from '../middleware/subscription';

router.get('/premium-feature', auth, requireActiveSubscription, handler);
```

For Enterprise-only features:

```typescript
import { requirePlan } from '../middleware/subscription';

router.post('/sso/setup', auth, requirePlan('enterprise'), handler);
```

## 🎯 How It Works

1. **New Organization** → Automatically gets 30-day trial
2. **Trial Ends** → User sees "Subscribe" prompt
3. **Checkout** → Stripe processes payment
4. **Webhook** → Backend updates subscription status
5. **Access** → Features remain available

## 🔍 Verification

Check subscription status:

```sql
SELECT 
  o.name,
  s.subscription_status,
  s.subscription_plan,
  s.trial_end_date,
  s.current_seats
FROM enterprise.organizations o
JOIN enterprise.organization_subscriptions s ON s.organization_id = o.id;
```

## 🛠️ API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/subscriptions/plans` | Get pricing |
| `GET /api/subscriptions/info` | Current subscription |
| `POST /api/subscriptions/checkout` | Start checkout |
| `POST /api/subscriptions/portal` | Manage billing |

## 🐛 Troubleshooting

**Webhooks not working?**
```bash
# Use Stripe CLI for local testing:
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**Trial not starting?**
```sql
-- Check if trigger exists:
SELECT * FROM pg_trigger WHERE tgname = 'trigger_create_subscription_on_org';
```

**Subscription not updating?**
- Check backend logs for webhook errors
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Test webhook in Stripe Dashboard

## 📚 Resources

- [Full Setup Guide](./STRIPE_SETUP_GUIDE.md) - Detailed instructions
- [Stripe Docs](https://stripe.com/docs) - Official documentation
- [Test Cards](https://stripe.com/docs/testing) - All test scenarios

## ✅ Production Checklist

Before going live:

- [ ] Switch to Stripe live mode keys
- [ ] Update webhook URL to production domain
- [ ] Test with real card (yourself)
- [ ] Configure tax settings
- [ ] Set up invoice emails
- [ ] Add company branding to checkout
- [ ] Test cancellation flow
- [ ] Set up billing alerts

---

**Questions?** See [STRIPE_SETUP_GUIDE.md](./STRIPE_SETUP_GUIDE.md) for comprehensive documentation.
