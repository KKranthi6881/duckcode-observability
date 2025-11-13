import express, { Response } from 'express';
import { auth, AuthenticatedRequest } from '../middleware/auth';
import { stripeService, PRICING_PLANS, isStripeConfigured } from '../services/stripe.service';
import { supabase } from '../config/supabase';

const router = express.Router();

/**
 * Get pricing plans
 */
router.get('/plans', async (req, res: Response) => {
  try {
    res.json({
      plans: {
        professional: {
          name: PRICING_PLANS.professional.name,
          pricePerSeat: PRICING_PLANS.professional.pricePerSeat,
          features: PRICING_PLANS.professional.features,
        },
        enterprise: {
          name: PRICING_PLANS.enterprise.name,
          pricePerSeat: PRICING_PLANS.enterprise.pricePerSeat,
          features: PRICING_PLANS.enterprise.features,
        },
      },
      trial: {
        days: 30,
        description: '30-day free trial - No credit card required',
      },
    });
  } catch (error) {
    console.error('Error fetching pricing plans:', error);
    res.status(500).json({ message: 'Failed to fetch pricing plans' });
  }
});

/**
 * Get current subscription info
 */
router.get('/info', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organization_id) {
      return res.status(400).json({ message: 'No organization found for user' });
    }

    const subscriptionInfo = await stripeService.getSubscriptionInfo(
      req.user.organization_id
    );

    if (!subscriptionInfo) {
      return res.status(404).json({ message: 'No subscription found' });
    }

    const trialDaysRemaining = await stripeService.getTrialDaysRemaining(
      req.user.organization_id
    );

    const isActive = await stripeService.isSubscriptionActive(
      req.user.organization_id
    );

    res.json({
      ...subscriptionInfo,
      trial_days_remaining: trialDaysRemaining,
      is_active: isActive,
    });
  } catch (error) {
    console.error('Error fetching subscription info:', error);
    res.status(500).json({ message: 'Failed to fetch subscription information' });
  }
});

/**
 * Create checkout session to start subscription
 */
router.post('/checkout', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ 
        message: 'Stripe is not configured. Please contact your administrator.',
        error: 'STRIPE_NOT_CONFIGURED'
      });
    }

    if (!req.user?.organization_id || !req.user?.email) {
      return res.status(400).json({ message: 'Invalid user session' });
    }

    const { plan, seats } = req.body;

    if (!plan || !['professional', 'enterprise'].includes(plan)) {
      return res.status(400).json({ message: 'Invalid plan selected' });
    }

    if (!seats || seats < 1 || seats > 1000) {
      return res.status(400).json({ message: 'Invalid seat count (1-1000)' });
    }

    // Get organization details
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, display_name')
      .eq('id', req.user.organization_id)
      .single();

    if (!org) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';

    const session = await stripeService.createCheckoutSession({
      organizationId: req.user.organization_id,
      plan,
      seats,
      customerEmail: req.user.email,
      successUrl: `${frontendUrl}/admin/subscription?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancelUrl: `${frontendUrl}/admin/subscription?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ message: 'Failed to create checkout session' });
  }
});

/**
 * Create portal session for managing subscription
 */
router.post('/portal', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organization_id) {
      return res.status(400).json({ message: 'No organization found for user' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';

    const session = await stripeService.createPortalSession(
      req.user.organization_id,
      `${frontendUrl}/admin/subscription`
    );

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    res.status(500).json({ message: 'Failed to create portal session' });
  }
});

/**
 * Update subscription seats
 */
router.post('/update-seats', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organization_id) {
      return res.status(400).json({ message: 'No organization found for user' });
    }

    const { seats } = req.body;

    if (!seats || seats < 1 || seats > 1000) {
      return res.status(400).json({ message: 'Invalid seat count (1-1000)' });
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_organization_roles')
      .select('role_id, organization_roles(name)')
      .eq('user_id', req.user.id)
      .eq('organization_id', req.user.organization_id)
      .single();

    // @ts-ignore
    if (!userRole || userRole.organization_roles?.name !== 'admin') {
      return res.status(403).json({ message: 'Only admins can update seats' });
    }

    await stripeService.updateSubscriptionSeats(req.user.organization_id, seats);

    res.json({ message: 'Seats updated successfully', new_seats: seats });
  } catch (error) {
    console.error('Error updating seats:', error);
    res.status(500).json({ message: 'Failed to update seats' });
  }
});

/**
 * Cancel subscription
 */
router.post('/cancel', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organization_id) {
      return res.status(400).json({ message: 'No organization found for user' });
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_organization_roles')
      .select('role_id, organization_roles(name)')
      .eq('user_id', req.user.id)
      .eq('organization_id', req.user.organization_id)
      .single();

    // @ts-ignore
    if (!userRole || userRole.organization_roles?.name !== 'admin') {
      return res.status(403).json({ message: 'Only admins can cancel subscription' });
    }

    await stripeService.cancelSubscription(req.user.organization_id);

    res.json({ message: 'Subscription will be canceled at period end' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ message: 'Failed to cancel subscription' });
  }
});

/**
 * Reactivate subscription
 */
router.post('/reactivate', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organization_id) {
      return res.status(400).json({ message: 'No organization found for user' });
    }

    // Check if user is admin
    const { data: userRole } = await supabase
      .from('user_organization_roles')
      .select('role_id, organization_roles(name)')
      .eq('user_id', req.user.id)
      .eq('organization_id', req.user.organization_id)
      .single();

    // @ts-ignore
    if (!userRole || userRole.organization_roles?.name !== 'admin') {
      return res.status(403).json({ message: 'Only admins can reactivate subscription' });
    }

    await stripeService.reactivateSubscription(req.user.organization_id);

    res.json({ message: 'Subscription reactivated successfully' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ message: 'Failed to reactivate subscription' });
  }
});

/**
 * Get subscription events (audit log)
 */
router.get('/events', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organization_id) {
      return res.status(400).json({ message: 'No organization found for user' });
    }

    const { data: events, error } = await supabase
      .from('subscription_events')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ events });
  } catch (error) {
    console.error('Error fetching subscription events:', error);
    res.status(500).json({ message: 'Failed to fetch subscription events' });
  }
});

/**
 * Get invoices
 */
router.get('/invoices', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.organization_id) {
      return res.status(400).json({ message: 'No organization found for user' });
    }

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('organization_id', req.user.organization_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
});

export default router;
