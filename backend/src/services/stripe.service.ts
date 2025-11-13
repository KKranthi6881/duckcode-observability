import Stripe from 'stripe';
import { supabase } from '../config/supabase';

// Initialize Stripe only if API key is provided
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const stripe = STRIPE_KEY 
  ? new Stripe(STRIPE_KEY, {
      apiVersion: '2024-11-20.acacia' as any,
    })
  : null;

// Helper to check if Stripe is configured
const isStripeConfigured = (): boolean => {
  return !!stripe && !!process.env.STRIPE_PRICE_PROFESSIONAL && !!process.env.STRIPE_PRICE_ENTERPRISE;
};

// Pricing configuration
export const PRICING_PLANS = {
  professional: {
    name: 'Professional',
    pricePerSeat: 75, // $75/user/month
    stripePriceId: process.env.STRIPE_PRICE_PROFESSIONAL || '',
    features: [
      'Column-level lineage',
      'Snowflake cost dashboard',
      'AI query optimization',
      'Auto documentation',
      'Auto troubleshooting',
      'Architecture diagrams',
      'AI code completion',
      'Offline IDE capabilities',
      'Metadata sync',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    pricePerSeat: 125, // $125/user/month
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || '',
    features: [
      'All Professional features',
      'OKTA SSO integration',
      'Advanced security controls',
      'Priority support',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantees',
    ],
  },
};

export interface CreateCheckoutSessionParams {
  organizationId: string;
  plan: 'professional' | 'enterprise';
  seats: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionInfo {
  subscription_status: string;
  subscription_plan: string | null;
  current_seats: number;
  trial_end_date: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_per_seat: number | null;
}

class StripeService {
  /**
   * Create or retrieve Stripe customer for organization
   */
  async getOrCreateCustomer(
    organizationId: string,
    email: string,
    name: string
  ): Promise<string> {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
    }
    
    try {
      // Check if customer already exists
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', organizationId)
        .single();

      if (org?.stripe_customer_id) {
        return org.stripe_customer_id;
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          organization_id: organizationId,
        },
      });

      // Update organization with Stripe customer ID
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customer.id })
        .eq('id', organizationId);

      return customer.id;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  /**
   * Create Stripe Checkout Session for subscription
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<Stripe.Checkout.Session> {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
    }
    
    try {
      const { organizationId, plan, seats, customerEmail, successUrl, cancelUrl } = params;

      // Get or create Stripe customer
      const { data: org } = await supabase
        .from('organizations')
        .select('name, display_name, stripe_customer_id')
        .eq('id', organizationId)
        .single();

      if (!org) {
        throw new Error('Organization not found');
      }

      const customerId = await this.getOrCreateCustomer(
        organizationId,
        customerEmail,
        org.display_name
      );

      const priceId = PRICING_PLANS[plan].stripePriceId;

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: seats,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        metadata: {
          organization_id: organizationId,
          plan,
          seats: seats.toString(),
        },
        subscription_data: {
          metadata: {
            organization_id: organizationId,
            plan,
            seats: seats.toString(),
          },
        },
      });

      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create customer portal session for managing subscription
   */
  async createPortalSession(
    organizationId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
    }
    
    try {
      // Get organization's Stripe customer ID
      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', organizationId)
        .single();

      if (!org?.stripe_customer_id) {
        throw new Error('No Stripe customer found for organization');
      }

      const session = await stripe!.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: returnUrl,
      });

      return session;
    } catch (error) {
      console.error('Error creating portal session:', error);
      throw error;
    }
  }

  /**
   * Update subscription seat count
   */
  async updateSubscriptionSeats(
    organizationId: string,
    newSeats: number
  ): Promise<void> {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
    }
    
    try {
      // Get current subscription
      const { data: sub } = await supabase
        .from('organization_subscriptions')
        .select('stripe_subscription_id')
        .eq('organization_id', organizationId)
        .single();

      if (!sub?.stripe_subscription_id) {
        throw new Error('No active subscription found');
      }

      // Get subscription from Stripe
      const subscription = await stripe!.subscriptions.retrieve(sub.stripe_subscription_id);

      // Update quantity on the subscription item
      await stripe!.subscriptions.update(sub.stripe_subscription_id, {
        items: [
          {
            id: subscription.items.data[0].id,
            quantity: newSeats,
          },
        ],
        proration_behavior: 'always_invoice',
      });

      // Update in database
      await supabase
        .from('organization_subscriptions')
        .update({ current_seats: newSeats, updated_at: new Date().toISOString() })
        .eq('organization_id', organizationId);

      // Log event
      await this.logSubscriptionEvent(organizationId, 'seats_updated', {
        old_seats: subscription.items.data[0].quantity,
        new_seats: newSeats,
      });
    } catch (error) {
      console.error('Error updating subscription seats:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(organizationId: string): Promise<void> {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
    }
    
    try {
      const { data: sub } = await supabase
        .from('organization_subscriptions')
        .select('stripe_subscription_id')
        .eq('organization_id', organizationId)
        .single();

      if (!sub?.stripe_subscription_id) {
        throw new Error('No active subscription found');
      }

      // Cancel at period end
      await stripe!.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      // Update database
      await supabase
        .from('organization_subscriptions')
        .update({
          cancel_at_period_end: true,
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId);

      // Log event
      await this.logSubscriptionEvent(organizationId, 'subscription_canceled', {
        cancel_at_period_end: true,
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(organizationId: string): Promise<void> {
    if (!stripe) {
      throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
    }
    
    try {
      // Get subscription
      const { data: sub } = await supabase
        .from('organization_subscriptions')
        .select('stripe_subscription_id')
        .eq('organization_id', organizationId)
        .single();

      if (!sub?.stripe_subscription_id) {
        throw new Error('No subscription found');
      }

      // Remove cancel_at_period_end
      await stripe!.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: false,
      });

      // Update database
      await supabase
        .from('organization_subscriptions')
        .update({
          cancel_at_period_end: false,
          canceled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', organizationId);

      // Log event
      await this.logSubscriptionEvent(organizationId, 'subscription_reactivated', {});
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription information
   */
  async getSubscriptionInfo(organizationId: string): Promise<SubscriptionInfo | null> {
    try {
      const { data: sub } = await supabase
        .from('organization_subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .single();

      if (!sub) {
        return null;
      }

      return {
        subscription_status: sub.subscription_status,
        subscription_plan: sub.subscription_plan,
        current_seats: sub.current_seats,
        trial_end_date: sub.trial_end_date,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        price_per_seat: sub.price_per_seat,
      };
    } catch (error) {
      console.error('Error getting subscription info:', error);
      return null;
    }
  }

  /**
   * Check if organization has active subscription (including trial)
   */
  async isSubscriptionActive(organizationId: string): Promise<boolean> {
    try {
      const { data } = await supabase.rpc('is_subscription_active', {
        org_id: organizationId,
      });

      return data === true;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get trial days remaining
   */
  async getTrialDaysRemaining(organizationId: string): Promise<number> {
    try {
      const { data } = await supabase.rpc('get_trial_days_remaining', {
        org_id: organizationId,
      });

      return data || 0;
    } catch (error) {
      console.error('Error getting trial days:', error);
      return 0;
    }
  }

  /**
   * Log subscription event
   */
  private async logSubscriptionEvent(
    organizationId: string,
    eventType: string,
    eventData: any,
    stripeEventId?: string
  ): Promise<void> {
    try {
      await supabase.from('subscription_events').insert({
        organization_id: organizationId,
        event_type: eventType,
        stripe_event_id: stripeEventId,
        event_data: eventData,
      });
    } catch (error) {
      console.error('Error logging subscription event:', error);
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    if (!stripe) {
      console.warn('Stripe webhook received but Stripe is not configured');
      return;
    }
    
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const organizationId = session.metadata?.organization_id;
    if (!organizationId) return;

    const plan = session.metadata?.plan as 'professional' | 'enterprise';
    const seats = parseInt(session.metadata?.seats || '1');

    // The subscription will be created/updated by the subscription.created webhook
    await this.logSubscriptionEvent(
      organizationId,
      'checkout_completed',
      {
        session_id: session.id,
        plan,
        seats,
      },
      session.id
    );
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organization_id;
    if (!organizationId) return;

    const plan = subscription.metadata?.plan as 'professional' | 'enterprise';
    const seats = parseInt(subscription.metadata?.seats || '1');
    const pricePerSeat = PRICING_PLANS[plan]?.pricePerSeat || 0;

    // Update subscription in database
    const { data: existing } = await supabase
      .from('organization_subscriptions')
      .select('id, subscription_status')
      .eq('organization_id', organizationId)
      .single();

    const updateData = {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      stripe_price_id: subscription.items.data[0]?.price.id,
      subscription_plan: plan,
      subscription_status: subscription.status,
      price_per_seat: pricePerSeat,
      current_seats: seats,
      current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
      current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('organization_subscriptions')
      .update(updateData)
      .eq('organization_id', organizationId);

    // Log event
    await this.logSubscriptionEvent(
      organizationId,
      'subscription_updated',
      {
        previous_status: existing?.subscription_status,
        new_status: subscription.status,
        plan,
        seats,
      },
      subscription.id
    );
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organization_id;
    if (!organizationId) return;

    // Update subscription status
    await supabase
      .from('organization_subscriptions')
      .update({
        subscription_status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', organizationId);

    // Log event
    await this.logSubscriptionEvent(
      organizationId,
      'subscription_deleted',
      { subscription_id: subscription.id },
      subscription.id
    );
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    // Get organization from customer
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!org) return;

    // Store invoice
    await supabase.from('invoices').insert({
      organization_id: org.id,
      stripe_invoice_id: invoice.id,
      stripe_hosted_invoice_url: invoice.hosted_invoice_url,
      stripe_invoice_pdf: invoice.invoice_pdf,
      amount_due: invoice.amount_due / 100,
      amount_paid: invoice.amount_paid / 100,
      currency: invoice.currency,
      invoice_status: invoice.status,
      period_start: new Date(invoice.period_start * 1000).toISOString(),
      period_end: new Date(invoice.period_end * 1000).toISOString(),
      paid_at: invoice.status_transitions.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
    });

    // Log event
    await this.logSubscriptionEvent(org.id, 'invoice_paid', {
      invoice_id: invoice.id,
      amount: invoice.amount_paid / 100,
    });
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;

    // Get organization from customer
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!org) return;

    // Update subscription status to past_due
    await supabase
      .from('organization_subscriptions')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('organization_id', org.id);

    // Log event
    await this.logSubscriptionEvent(org.id, 'payment_failed', {
      invoice_id: invoice.id,
      amount: invoice.amount_due / 100,
    });
  }
}

export const stripeService = new StripeService();
export { stripe, isStripeConfigured };
