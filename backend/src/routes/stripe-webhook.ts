import express, { Request, Response } from 'express';
import { stripe, stripeService, isStripeConfigured } from '../services/stripe.service';
import Stripe from 'stripe';

const router = express.Router();

/**
 * Stripe webhook endpoint
 * This endpoint receives events from Stripe to keep our database in sync
 * 
 * IMPORTANT: This route MUST use raw body, not JSON parsed body
 * The signature verification requires the raw request body
 */
router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    if (!isStripeConfigured() || !stripe) {
      console.warn('Stripe webhook received but Stripe is not configured');
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Log the event
    console.log(`Received Stripe webhook event: ${event.type}`, {
      id: event.id,
      type: event.type,
    });

    try {
      // Handle the event
      await stripeService.handleWebhookEvent(event);

      res.json({ received: true });
    } catch (error: any) {
      console.error('Error processing webhook event:', error);
      res.status(500).json({ error: 'Error processing webhook event' });
    }
  }
);

export default router;
