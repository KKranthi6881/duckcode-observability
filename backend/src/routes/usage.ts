import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { SupabaseUsage } from '../models/SupabaseUsage';
import { SupabaseUser } from '../models/SupabaseUser';
import { auth, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// @route   POST /api/usage/track
// @desc    Track IDE usage data
// @access  Private
router.post('/track', auth, [
  body('type', 'Usage type is required').isIn(['prompt', 'completion', 'error']),
  body('timestamp', 'Timestamp is required').isNumeric()
], async (req: AuthenticatedRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { type, tokens = 0, model, prompt, completion, error, timestamp } = req.body;

  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Create usage record
    const usage = await SupabaseUsage.create({
      userId: req.user.id,
      tokens: parseInt(tokens) || 0,
      model: model || 'unknown',
      prompt: type === 'prompt' ? prompt : undefined,
      completion: type === 'completion' ? completion : undefined,
      metadata: { type, error: type === 'error' ? error : undefined, timestamp }
    });

    // Update user's total token usage (handled automatically by trigger)

    res.json({ success: true, message: 'Usage tracked successfully' });

  } catch (err) {
    console.error('Error tracking usage:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/usage/stats
// @desc    Get user usage statistics
// @access  Private
router.get('/stats', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { period = '30d' } = req.query;
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Get usage statistics
    const stats = await SupabaseUsage.getStats(req.user.id, period as '7d' | '30d' | '90d');
    const dailyStats = await SupabaseUsage.getDailyBreakdown(req.user.id, period as '7d' | '30d' | '90d');
    const modelStats = await SupabaseUsage.getModelBreakdown(req.user.id, period as '7d' | '30d' | '90d');

    res.json({
      period,
      summary: stats,
      dailyBreakdown: dailyStats,
      modelBreakdown: modelStats
    });

  } catch (err) {
    console.error('Error fetching usage stats:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/usage/limits
// @desc    Get user usage limits and current usage
// @access  Private
router.get('/limits', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Get usage limits and current usage from Supabase
    const limitsData = await SupabaseUsage.checkUsageLimits(req.user.id);
    
    res.json({
      tier: limitsData.subscriptionTier,
      limits: {
        monthlyTokens: limitsData.monthlyTokensLimit,
        monthlyRequests: limitsData.monthlyRequestsLimit
      },
      currentUsage: {
        monthlyTokens: limitsData.monthlyTokensUsed,
        monthlyRequests: limitsData.monthlyRequestsUsed
      },
      remainingUsage: {
        monthlyTokens: limitsData.monthlyTokensLimit === -1 ? -1 : Math.max(0, limitsData.monthlyTokensLimit - limitsData.monthlyTokensUsed),
        monthlyRequests: limitsData.monthlyRequestsLimit === -1 ? -1 : Math.max(0, limitsData.monthlyRequestsLimit - limitsData.monthlyRequestsUsed)
      },
      canMakeRequest: limitsData.canMakeRequest
    });

  } catch (err) {
    console.error('Error checking usage limits:', err instanceof Error ? err.message : err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
