import { Router } from 'express';
import {
  getUserSummary,
  getUserTrends,
  getUserModelBreakdown,
  getUserRecentConversations,
  exportUserAnalytics,
} from '../controllers/user-analytics.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * @route GET /api/user-analytics/summary
 * @desc Get analytics summary for logged-in user
 * @query days - Number of days to fetch (default: 30)
 */
router.get('/summary', getUserSummary);

/**
 * @route GET /api/user-analytics/trends
 * @desc Get daily cost trends for logged-in user
 * @query days - Number of days to fetch (default: 30)
 */
router.get('/trends', getUserTrends);

/**
 * @route GET /api/user-analytics/models
 * @desc Get model usage breakdown for logged-in user
 * @query days - Number of days to fetch (default: 30)
 */
router.get('/models', getUserModelBreakdown);

/**
 * @route GET /api/user-analytics/recent
 * @desc Get recent conversations for logged-in user
 * @query limit - Number of conversations to fetch (default: 10)
 */
router.get('/recent', getUserRecentConversations);

/**
 * @route GET /api/user-analytics/export
 * @desc Export analytics data for logged-in user
 * @query days - Number of days to export (default: 30)
 */
router.get('/export', exportUserAnalytics);

export default router;
