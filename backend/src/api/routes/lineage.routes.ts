import { Router, Request, Response, NextFunction } from 'express';
import * as lineageController from '../controllers/lineage.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import lineageStatusRoutes from '../lineage/status';

// Define AuthenticatedRequest interface locally
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

const router = Router();

// Mount our new Phase 2C status routes with prefix (comprehensive status including lineage)
router.use('/phase2c', requireAuth, lineageStatusRoutes);

/**
 * @swagger
 * /api/lineage/process-repository/{owner}/{repo}:
 *   post:
 *     summary: Initiates lineage processing for a repository that already has documentation
 *     tags: [Lineage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: The owner of the repository.
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the repository.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional filter for specific file types (e.g., ['sql', 'python'])
 *               forceReprocess:
 *                 type: boolean
 *                 description: Whether to reprocess files that already have lineage data
 *                 default: false
 *     responses:
 *       202:
 *         description: Accepted. Lineage processing has been queued.
 *       400:
 *         description: Bad Request. Repository not found or no documented files.
 *       401:
 *         description: Unauthorized. Authentication required.
 */
router.post(
  '/process-repository/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.processRepositoryLineage as any
);

/**
 * @swagger
 * /api/lineage/status/{owner}/{repo}:
 *   get:
 *     summary: Gets the lineage processing status for a repository
 *     tags: [Lineage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: The owner of the repository.
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the repository.
 *     responses:
 *       200:
 *         description: OK. Returns lineage processing status and statistics.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [pending, processing, completed, partial]
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalFiles:
 *                       type: integer
 *                     filesWithLineage:
 *                       type: integer
 *                     totalAssets:
 *                       type: integer
 *                     totalRelationships:
 *                       type: integer
 *                     avgConfidenceScore:
 *                       type: number
 *                 progress:
 *                   type: object
 *                   properties:
 *                     completed:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     percentage:
 *                       type: number
 *       401:
 *         description: Unauthorized. Authentication required.
 *       404:
 *         description: Not Found. Repository not found.
 */
router.get(
  '/status/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getLineageStatus as any
);

/**
 * @swagger
 * /api/lineage/assets/{owner}/{repo}:
 *   get:
 *     summary: Gets all discovered data assets for a repository
 *     tags: [Lineage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: The owner of the repository.
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the repository.
 *       - in: query
 *         name: assetType
 *         schema:
 *           type: string
 *         description: Filter by asset type (table, view, function, etc.)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for asset names
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: OK. Returns discovered data assets.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       assetName:
 *                         type: string
 *                       assetType:
 *                         type: string
 *                       fullQualifiedName:
 *                         type: string
 *                       filePath:
 *                         type: string
 *                       metadata:
 *                         type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       401:
 *         description: Unauthorized. Authentication required.
 *       404:
 *         description: Not Found. Repository not found.
 */
router.get(
  '/assets/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getDataAssets as any
);

/**
 * @swagger
 * /api/lineage/relationships/{owner}/{repo}:
 *   get:
 *     summary: Gets lineage relationships for a repository
 *     tags: [Lineage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: The owner of the repository.
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the repository.
 *       - in: query
 *         name: assetId
 *         schema:
 *           type: string
 *         description: Filter relationships for a specific asset
 *       - in: query
 *         name: relationshipType
 *         schema:
 *           type: string
 *         description: Filter by relationship type
 *       - in: query
 *         name: minConfidence
 *         schema:
 *           type: number
 *           default: 0.5
 *         description: Minimum confidence score for relationships
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: OK. Returns lineage relationships.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 relationships:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       sourceAsset:
 *                         type: object
 *                       targetAsset:
 *                         type: object
 *                       relationshipType:
 *                         type: string
 *                       confidenceScore:
 *                         type: number
 *                 total:
 *                   type: integer
 *       401:
 *         description: Unauthorized. Authentication required.
 *       404:
 *         description: Not Found. Repository not found.
 */
router.get(
  '/relationships/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getLineageRelationships as any
);

/**
 * @swagger
 * /api/lineage/graph/{owner}/{repo}:
 *   get:
 *     summary: Gets lineage graph data for visualization
 *     tags: [Lineage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: The owner of the repository.
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the repository.
 *       - in: query
 *         name: focusAsset
 *         schema:
 *           type: string
 *         description: Asset ID to focus the graph on
 *       - in: query
 *         name: depth
 *         schema:
 *           type: integer
 *           default: 2
 *         description: Maximum depth for graph traversal
 *       - in: query
 *         name: includeColumns
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Whether to include column-level lineage
 *     responses:
 *       200:
 *         description: OK. Returns graph data for visualization.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nodes:
 *                   type: array
 *                   items:
 *                     type: object
 *                 edges:
 *                   type: array
 *                   items:
 *                     type: object
 *                 metadata:
 *                   type: object
 *       401:
 *         description: Unauthorized. Authentication required.
 *       404:
 *         description: Not Found. Repository not found.
 */
router.get(
  '/graph/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getLineageGraph as any
);

// Additional existing routes for cross-file resolution, impact analysis, etc.
router.post(
  '/resolve-cross-file/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.resolveCrossFileRelationships as any
);

router.get(
  '/execution-order/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getExecutionOrder as any
);

router.get(
  '/circular-dependencies/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getCircularDependencies as any
);

router.get(
  '/data-flow-patterns/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getDataFlowPatterns as any
);

router.get(
  '/optimization-suggestions/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getOptimizationSuggestions as any
);

router.get(
  '/cross-file-references/:owner/:repo',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  lineageController.getCrossFileAssetReferences as any
);

export default router; 