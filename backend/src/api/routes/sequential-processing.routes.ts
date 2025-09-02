import { Router } from 'express';
import { SequentialProcessingController } from '../controllers/sequential-processing.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

/**
 * @route POST /api/sequential/start
 * @desc Start sequential processing pipeline for a repository
 * @access Private
 */
router.post('/start', (req, res, next) => {
  console.log('🔥 Sequential processing route hit:', {
    method: req.method,
    url: req.url,
    body: req.body,
    hasAuthHeader: !!req.headers.authorization
  });
  next();
}, SequentialProcessingController.startSequentialProcessing);

/**
 * @route GET /api/sequential/status/:repositoryFullName
 * @desc Get sequential processing status for a repository
 * @access Private
 */
router.get('/status/:repositoryFullName', SequentialProcessingController.getSequentialStatus);

export default router; 