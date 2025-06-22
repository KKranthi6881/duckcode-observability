import { Router } from 'express';
import * as insightsController from '@/api/controllers/insights.controller';
import { requireAuth } from '@/api/middlewares/auth.middleware';

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

export default router;
