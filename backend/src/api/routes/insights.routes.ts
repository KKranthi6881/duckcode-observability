import { Router } from 'express';
import * as insightsController from '../controllers/insights.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/insights/process-repository:
 *   post:
 *     summary: Kicks off the process of analyzing a GitHub repository.
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repositoryFullName
 *             properties:
 *               repositoryFullName:
 *                 type: string
 *                 description: The full name of the repository (e.g., 'owner/repo').
 *                 example: 'my-org/my-awesome-project'
 *     responses:
 *       202:
 *         description: Accepted. The repository processing has been successfully queued.
 *       400:
 *         description: Bad Request. Missing or invalid repositoryFullName.
 *       401:
 *         description: Unauthorized. Authentication required.
 *       404:
 *         description: Not Found. GitHub connection for the user not found.
 */
router.post(
  '/process-repository',
  requireAuth, // Middleware to ensure the user is authenticated
  insightsController.processRepository
);

/**
 * @swagger
 * /api/insights/processing-status/{owner}/{repo}:
 *   get:
 *     summary: Gets the real-time processing status of a repository.
 *     tags: [Insights]
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
 *         description: OK. Returns the current processing status.
 *       401:
 *         description: Unauthorized. Authentication required.
 *       404:
 *         description: Not Found. No files found for this repository.
 */
router.get(
  '/processing-status/:owner/:repo',
  requireAuth,
  (req, res, next) => {
    // Combine owner and repo into a single repositoryFullName for the controller
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  insightsController.getRepositoryProcessingStatus
);

/**
 * @swagger
 * /api/insights/file-summary/{owner}/{repo}/{filePath}:
 *   get:
 *     summary: Gets the code summary for a specific file in a repository.
 *     tags: [Insights]
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
 *       - in: path
 *         name: filePath
 *         required: true
 *         schema:
 *           type: string
 *         description: The full path to the file (can contain slashes).
 *     responses:
 *       200:
 *         description: OK. Returns the code summary for the file.
 *       401:
 *         description: Unauthorized. Authentication required.
 *       404:
 *         description: Not Found. File not found or summary not available.
 */
router.get(
  '/file-summary/:owner/:repo/*',
  requireAuth,
  (req, res, next) => {
    // Combine owner and repo into a single repositoryFullName for the controller
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  insightsController.getFileSummary
);

/**
 * @swagger
 * /api/insights/generate-summaries/{owner}/{repo}:
 *   post:
 *     summary: Generates AI summaries for files in a repository that don't have summaries yet.
 *     tags: [Insights]
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
 *         description: OK. Summary generation completed.
 *       401:
 *         description: Unauthorized. Authentication required.
 *       500:
 *         description: Internal Server Error. AI service not configured or other error.
 */
router.post(
  '/generate-summaries/:owner/:repo',
  requireAuth,
  (req, res, next) => {
    // Combine owner and repo into a single repositoryFullName for the controller
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  insightsController.generateRepositorySummaries
);

/**
 * @swagger
 * /api/insights/retry-vectors/{owner}/{repo}:
 *   post:
 *     summary: Retry vector processing for files with failed or pending vector status
 *     tags: [Insights]
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
 *         description: OK. Vector processing retry initiated.
 *       401:
 *         description: Unauthorized. Authentication required.
 *       500:
 *         description: Internal Server Error.
 */
router.post(
  '/retry-vectors/:owner/:repo',
  requireAuth,
  (req, res, next) => {
    // Combine owner and repo into a single repositoryFullName for the controller
    req.params.repositoryFullName = `${req.params.owner}/${req.params.repo}`;
    next();
  },
  insightsController.retryVectorProcessing
);

/**
 * @swagger
 * /api/insights/process-documentation-only:
 *   post:
 *     summary: Initiates ONLY documentation processing for sequential pipeline.
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repositoryFullName
 *             properties:
 *               repositoryFullName:
 *                 type: string
 *                 description: The full name of the repository (e.g., 'owner/repo').
 *                 example: 'my-org/my-awesome-project'
 *               selectedLanguage:
 *                 type: string
 *                 description: Selected language for analysis prompts.
 *                 example: 'postgres'
 *     responses:
 *       202:
 *         description: Accepted. Documentation processing has been successfully queued.
 *       400:
 *         description: Bad Request. Missing or invalid repositoryFullName.
 *       401:
 *         description: Unauthorized. Authentication required.
 */
router.post(
  '/process-documentation-only',
  requireAuth,
  insightsController.processDocumentationOnly
);

/**
 * @swagger
 * /api/insights/process-vectors-only:
 *   post:
 *     summary: Initiates ONLY vector processing for files with completed documentation.
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repositoryFullName
 *             properties:
 *               repositoryFullName:
 *                 type: string
 *                 description: The full name of the repository (e.g., 'owner/repo').
 *                 example: 'my-org/my-awesome-project'
 *     responses:
 *       202:
 *         description: Accepted. Vector processing has been successfully queued.
 *       400:
 *         description: Bad Request. Missing or invalid repositoryFullName.
 *       401:
 *         description: Unauthorized. Authentication required.
 */
router.post(
  '/process-vectors-only',
  requireAuth,
  insightsController.processVectorsOnly
);

/**
 * @swagger
 * /api/insights/process-lineage-only:
 *   post:
 *     summary: Initiates ONLY lineage processing for SQL files with completed vectors.
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repositoryFullName
 *             properties:
 *               repositoryFullName:
 *                 type: string
 *                 description: The full name of the repository (e.g., 'owner/repo').
 *                 example: 'my-org/my-awesome-project'
 *     responses:
 *       202:
 *         description: Accepted. Lineage processing has been successfully queued.
 *       400:
 *         description: Bad Request. Missing or invalid repositoryFullName.
 *       401:
 *         description: Unauthorized. Authentication required.
 */
router.post(
  '/process-lineage-only',
  requireAuth,
  insightsController.processLineageOnly
);

/**
 * @swagger
 * /api/insights/process-dependencies-only:
 *   post:
 *     summary: Initiates ONLY dependencies processing (Phase 4) for sequential pipeline.
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repositoryFullName
 *             properties:
 *               repositoryFullName:
 *                 type: string
 *                 description: The full name of the repository (e.g., 'owner/repo').
 *                 example: 'my-org/my-awesome-project'
 *     responses:
 *       202:
 *         description: Accepted. Dependencies processing has been successfully queued.
 */
router.post(
  '/process-dependencies-only',
  requireAuth,
  insightsController.processDependenciesOnly
);

/**
 * @swagger
 * /api/insights/process-analysis-only:
 *   post:
 *     summary: Initiates ONLY analysis processing (Phase 5) for sequential pipeline.
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - repositoryFullName
 *             properties:
 *               repositoryFullName:
 *                 type: string
 *                 description: The full name of the repository (e.g., 'owner/repo').
 *                 example: 'my-org/my-awesome-project'
 *     responses:
 *       202:
 *         description: Accepted. Analysis processing has been successfully queued.
 */
router.post(
  '/process-analysis-only',
  requireAuth,
  insightsController.processAnalysisOnly
);

export default router;
