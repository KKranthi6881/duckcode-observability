import { Router } from 'express';
import { AdminMetadataController } from '../controllers/admin-metadata.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GitHub Connections
 */
router.get('/connections', AdminMetadataController.listConnections);
router.post('/connections', AdminMetadataController.connectRepository);
router.delete('/connections/:connectionId', AdminMetadataController.disconnectRepository);

/**
 * Extraction Jobs
 */
router.post('/connections/:connectionId/extract', AdminMetadataController.startExtraction);
router.get('/jobs/:connectionId/status', AdminMetadataController.getJobStatus);

/**
 * Statistics
 */
router.get('/stats', AdminMetadataController.getStats);

export default router;
