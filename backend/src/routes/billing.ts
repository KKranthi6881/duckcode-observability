import express, { Request, Response } from 'express';
import { SupabaseUser } from '../models/SupabaseUser';
import { SupabaseUsage } from '../models/SupabaseUsage';
import { SupabaseBilling } from '../models/SupabaseBilling';
import { auth, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Get user's current billing information
router.get('/info', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Get billing analytics from Supabase
    const billingData = await SupabaseBilling.getBillingAnalytics(req.user.id);
    
    const user = await SupabaseUser.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get current billing period
    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(1);
    currentPeriodStart.setHours(0, 0, 0, 0);
    
    const currentPeriodEnd = new Date(currentPeriodStart);
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        subscriptionTier: user.subscription_tier,
        createdAt: user.created_at
      },
      currentTier: billingData.tier,
      usage: billingData.usage,
      billingPeriod: {
        start: currentPeriodStart.toISOString(),
        end: currentPeriodEnd.toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching billing info:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get usage analytics for enterprise dashboard
router.get('/analytics', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await SupabaseUser.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only allow enterprise users to access analytics
    if (user.subscription_tier !== 'enterprise') {
      return res.status(403).json({ message: 'Access denied. Enterprise subscription required.' });
    }

    // Get comprehensive billing analytics
    const billingData = await SupabaseBilling.getBillingAnalytics(req.user.id);
    const usageStats = await SupabaseUsage.getStats(req.user.id, '30d');
    const dailyBreakdown = await SupabaseUsage.getDailyBreakdown(req.user.id, '30d');
    const modelBreakdown = await SupabaseUsage.getModelBreakdown(req.user.id, '30d');

    res.json({
      period: '30d',
      analytics: {
        daily: dailyBreakdown,
        models: modelBreakdown
      },
      summary: {
        totalDays: 30,
        totalModels: modelBreakdown.length,
        totalTokens: usageStats.totalTokens,
        totalRequests: usageStats.totalRequests,
        totalCost: billingData.usage.cost
      },
      billing: billingData
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upgrade subscription tier
router.post('/upgrade', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { tier } = req.body;
    
    // Get available subscription tiers from Supabase
    const availableTiers = await SupabaseBilling.getSubscriptionTiers();
    const validTier = availableTiers.find((t: any) => t.name === tier);
    
    if (!validTier) {
      return res.status(400).json({ message: 'Invalid subscription tier' });
    }

    const user = await SupabaseUser.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user subscription tier in Supabase
    const updatedUser = await SupabaseUser.updateSubscriptionTier(req.user.id, tier);

    res.json({
      message: 'Subscription upgraded successfully',
      newTier: validTier,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        subscriptionTier: updatedUser.subscription_tier
      }
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all available pricing tiers
router.get('/tiers', async (req: Request, res: Response) => {
  try {
    const tiers = await SupabaseBilling.getSubscriptionTiers();
    res.json(tiers);
  } catch (error) {
    console.error('Error fetching subscription tiers:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
