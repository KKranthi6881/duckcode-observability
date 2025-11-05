import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  listRecommendations,
  getRecommendationsSummary,
  applyRecommendation,
  dismissRecommendation,
  getROI,
  generateRecommendations,
} from '../controllers/snowflake-recommendations.controller';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Recommendations endpoints
router.get('/:id/recommendations', listRecommendations);
router.get('/:id/recommendations/summary', getRecommendationsSummary);
router.post('/:id/recommendations/generate', generateRecommendations);
router.post('/:id/recommendations/:recommendationId/apply', applyRecommendation);
router.put('/:id/recommendations/:recommendationId/dismiss', dismissRecommendation);

// ROI endpoints
router.get('/:id/roi', getROI);

export default router;
