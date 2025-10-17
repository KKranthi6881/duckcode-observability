import express from 'express';
import {
  getOrganizationSummary,
  getOrganizationTrends,
  getOrganizationUserBreakdown,
  getOrganizationApiKeyBreakdown,
  getOrganizationModelBreakdown,
  getUserAnalyticsWithComparison,
  getConversationDetails,
  exportOrganizationAnalytics
} from '../controllers/organization-analytics.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Organization-level analytics (admin only - verified in controller)
router.get('/:organizationId/analytics/summary', getOrganizationSummary);
router.get('/:organizationId/analytics/trends', getOrganizationTrends);
router.get('/:organizationId/analytics/users', getOrganizationUserBreakdown);
router.get('/:organizationId/analytics/api-keys', getOrganizationApiKeyBreakdown);
router.get('/:organizationId/analytics/models', getOrganizationModelBreakdown);
router.get('/:organizationId/analytics/export', exportOrganizationAnalytics);

// User analytics with org comparison (any authenticated user can view their own)
router.get('/:organizationId/users/:userId/analytics', getUserAnalyticsWithComparison);

// Conversation details (drill-down)
router.get('/:organizationId/conversations/:conversationId', getConversationDetails);

export default router;
