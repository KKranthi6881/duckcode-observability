import { Router } from 'express';
import { MetadataController } from '../controllers/metadata.controller';
import { uploadManifest, getExtractionError } from '../controllers/manifest-upload.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { ExtractionOrchestrator } from '../../services/metadata/extraction/ExtractionOrchestrator';

// Create shared orchestrator
export const orchestrator = new ExtractionOrchestrator();

const router = Router();
const controller = new MetadataController(orchestrator);

// All routes require authentication
router.use(requireAuth);

/**
 * Trigger automatic extraction for a connection
 * POST /api/metadata/connections/:id/extract
 */
router.post(
  '/connections/:id/extract',
  controller.triggerExtraction.bind(controller)
);

/**
 * Cancel an active extraction
 * POST /api/metadata/connections/:id/cancel
 */
router.post(
  '/connections/:id/cancel',
  controller.cancelExtraction.bind(controller)
);

/**
 * Get extraction progress
 * GET /api/metadata/connections/:id/progress
 */
router.get(
  '/connections/:id/progress',
  controller.getProgress.bind(controller)
);

/**
 * Get all active extractions
 * GET /api/metadata/extractions/active
 */
router.get(
  '/extractions/active',
  controller.getActiveExtractions.bind(controller)
);

/**
 * Get lineage for a connection
 * GET /api/metadata/connections/:id/lineage
 */
router.get(
  '/connections/:id/lineage',
  controller.getLineage.bind(controller)
);

/**
 * Get extraction statistics
 * GET /api/metadata/connections/:id/stats
 */
router.get(
  '/connections/:id/stats',
  controller.getStats.bind(controller)
);

/**
 * Upload manifest.json manually
 * POST /api/metadata/connections/:connectionId/upload-manifest
 */
router.post(
  '/connections/:connectionId/upload-manifest',
  uploadManifest
);

/**
 * Get extraction error details with guidance
 * GET /api/metadata/connections/:connectionId/error
 */
router.get(
  '/connections/:connectionId/error',
  getExtractionError
);

export default router;
