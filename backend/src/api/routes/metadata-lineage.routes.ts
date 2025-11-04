import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { 
  getModelLineage, 
  getModelColumns,
  getColumnLineage,
  getLineageByFilePath,
  getUnifiedLineage
} from '../controllers/metadata-lineage.controller';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * @route GET /api/metadata/lineage/unified
 * @desc Unified lineage (both dbt and Snowflake sources)
 * @access Private
 */
router.get('/unified', getUnifiedLineage as any);

/**
 * @route GET /api/metadata/lineage/by-file/:connectionId
 * @desc Get lineage for a specific file path (file-specific lineage)
 * @query filePath - The relative path of the file (e.g., "models/marts/customers.sql")
 * @access Private
 */
router.get('/by-file/:connectionId', getLineageByFilePath as any);

/**
 * @route GET /api/metadata/lineage/:connectionId
 * @desc Model-level lineage for a connection
 * @access Private
 */
router.get('/:connectionId', getModelLineage as any);

/**
 * @route GET /api/metadata/lineage/columns/:objectId
 * @desc Get columns for a specific object (for expansion)
 * @access Private
 */
router.get('/columns/:objectId', getModelColumns as any);

/**
 * @route GET /api/metadata/lineage/:connectionId/columns/:objectId/:columnName
 * @desc Column-level lineage for a specific object and column
 * @access Private
 */
router.get('/:connectionId/columns/:objectId/:columnName', getColumnLineage as any);

export default router;
