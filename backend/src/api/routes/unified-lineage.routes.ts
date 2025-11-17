/**
 * Unified Lineage Routes
 * 
 * Multi-source lineage API endpoints
 */

import { Router } from 'express';
import { auth } from '../../middleware/auth';
import { 
  getUnifiedLineage,
  getLineageStats,
  getUnifiedImpact,
} from '../controllers/unified-lineage.controller';

const router = Router();

// All routes require authentication
router.use(auth);

/**
 * GET /api/lineage/unified/:objectId
 * Get unified lineage graph for an object
 * 
 * Query params:
 * - depth: number (default: 3) - How many levels to traverse
 * - direction: 'upstream' | 'downstream' | 'both' (default: 'both')
 * - includeTypes: string (optional) - Comma-separated source types to include (e.g., 'github,snowflake')
 */
router.get('/unified/:objectId', getUnifiedLineage);

/**
 * GET /api/lineage/stats
 * Get lineage statistics for the organization
 */
router.get('/stats', getLineageStats);

router.get('/unified-impact/:objectId', getUnifiedImpact);

export default router;
