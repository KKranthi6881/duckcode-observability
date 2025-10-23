import express, { Request, Response } from 'express';
import {
  getModelLineage,
  getModelColumns,
  getColumnLineage,
  getLineageStats,
  getFocusedLineage,
  getLineageByFilePath
} from '../controllers/metadata-lineage.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * @route GET /api/metadata/lineage/by-file/:connectionId
 * @desc Get lineage for a specific file path (file-specific lineage)
 * @query filePath - The relative path of the file (e.g., "models/marts/customers.sql")
 * @access Private
 */
router.get('/by-file/:connectionId', getLineageByFilePath as any);

/**
 * @route GET /api/metadata/lineage/model/:connectionId
 * @desc Get model-level lineage graph (nodes + edges)
 * @access Private
 */
router.get('/model/:connectionId', getModelLineage as any);

/**
 * @route GET /api/metadata/lineage/focused/:connectionId/:modelId
 * @desc Get focused lineage for a specific model with upstream/downstream
 * @query upstreamLimit, downstreamLimit - Number of models to fetch in each direction (default: 5)
 * @access Private
 */
router.get('/focused/:connectionId/:modelId', getFocusedLineage as any);

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
