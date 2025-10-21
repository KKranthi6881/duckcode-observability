import express, { Request, Response } from 'express';
import {
  getModelLineage,
  getModelColumns,
  getColumnLineage,
  getLineageStats
} from '../controllers/metadata-lineage.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * @route GET /api/metadata/lineage/model/:connectionId
 * @desc Get model-level lineage graph (nodes + edges)
 * @access Private
 */
router.get('/model/:connectionId', getModelLineage as any);

/**
 * @route GET /api/metadata/lineage/columns/:objectId
 * @desc Get columns for a model (for expansion)
 * @query limit, offset - Pagination
 * @access Private
 */
router.get('/columns/:objectId', getModelColumns as any);

/**
 * @route GET /api/metadata/lineage/column/:objectId/:columnName
 * @desc Get full column lineage path
 * @query direction - upstream, downstream, both
 * @access Private
 */
router.get('/column/:objectId/:columnName', getColumnLineage as any);

/**
 * @route GET /api/metadata/lineage/stats/:connectionId
 * @desc Get lineage statistics
 * @access Private
 */
router.get('/stats/:connectionId', getLineageStats as any);

export default router;
