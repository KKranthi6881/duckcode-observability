import { Router } from 'express';
import { body } from 'express-validator';
import {
  getSyncPackage,
  matchWorkspaceConnections,
  getConnections,
  getDocumentation,
  registerSession
} from '../controllers/metadata-sync.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * @route   GET /api/metadata-sync/organizations/:orgId/sync-package
 * @desc    Get metadata sync package for IDE
 * @query   connection_ids - Array of connection IDs to filter
 * @query   last_sync_timestamp - ISO timestamp for incremental sync
 * @query   include_documentation - Include AI documentation (default: false)
 * @query   limit - Max objects to return (default: 1000)
 * @query   offset - Pagination offset (default: 0)
 * @access  Private
 */
router.get('/organizations/:orgId/sync-package', getSyncPackage);

/**
 * @route   POST /api/metadata-sync/organizations/:orgId/connections/match-workspace
 * @desc    Match workspace connections based on workspace identifier
 * @body    workspace_identifier - Workspace identifier (e.g., "company/repo")
 * @access  Private
 */
router.post(
  '/organizations/:orgId/connections/match-workspace',
  [
    body('workspace_identifier').notEmpty().withMessage('Workspace identifier is required')
  ],
  matchWorkspaceConnections
);

/**
 * @route   GET /api/metadata-sync/organizations/:orgId/connections
 * @desc    Get all available connections for an organization
 * @access  Private
 */
router.get('/organizations/:orgId/connections', getConnections);

/**
 * @route   GET /api/metadata-sync/organizations/:orgId/documentation
 * @desc    Get AI documentation for objects
 * @query   connection_ids - Array of connection IDs to filter
 * @query   object_ids - Array of object IDs to filter
 * @access  Private
 */
router.get('/organizations/:orgId/documentation', getDocumentation);

/**
 * @route   POST /api/metadata-sync/organizations/:orgId/ide-sessions
 * @desc    Register or update IDE sync session
 * @body    workspace_identifier - Workspace identifier
 * @body    workspace_hash - Hash of workspace path
 * @body    ide_version - IDE/extension version
 * @body    sync_mode - Sync mode (workspace-aware, manual, sync-all)
 * @body    connection_ids - Array of connection IDs being synced
 * @access  Private
 */
router.post(
  '/organizations/:orgId/ide-sessions',
  [
    body('workspace_identifier').notEmpty().withMessage('Workspace identifier is required'),
    body('sync_mode').optional().isIn(['workspace-aware', 'manual', 'sync-all'])
  ],
  registerSession
);

export default router;
