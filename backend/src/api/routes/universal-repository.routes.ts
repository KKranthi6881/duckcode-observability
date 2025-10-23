import { Router, RequestHandler } from 'express';
import * as universalRepoController from '../controllers/universal-repository.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

/**
 * Universal Repository Routes
 * Handles repository operations for both GitHub and GitLab
 * All routes require authentication
 */

/**
 * @openapi
 * /api/repos/{owner}/{repo}/tree:
 *   get:
 *     summary: Get repository file tree (works for GitHub and GitLab)
 *     description: Fetches the complete file tree structure for a repository
 *     tags:
 *       - Universal Repository
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: Repository owner
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: Repository name
 *       - in: query
 *         name: ref
 *         required: false
 *         schema:
 *           type: string
 *         description: Branch or commit ref (default: repository's default branch)
 *       - in: query
 *         name: path
 *         required: false
 *         schema:
 *           type: string
 *         description: Specific path within repository
 *       - in: query
 *         name: recursive
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Fetch recursively (default: true)
 *     responses:
 *       200:
 *         description: Repository tree retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Repository not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:owner/:repo/tree',
  requireAuth as RequestHandler,
  universalRepoController.getRepositoryTree as RequestHandler
);

/**
 * @openapi
 * /api/repos/{owner}/{repo}/contents:
 *   get:
 *     summary: Get repository contents (directory listing)
 *     description: Fetches contents of a directory in the repository (works for GitHub and GitLab)
 *     tags:
 *       - Universal Repository
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: Repository owner
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: Repository name
 *       - in: query
 *         name: ref
 *         required: false
 *         schema:
 *           type: string
 *         description: Branch or commit ref
 *     responses:
 *       200:
 *         description: Contents retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Repository or path not found
 *       500:
 *         description: Server error
 */
// Root directory contents
router.get(
  '/:owner/:repo/contents',
  requireAuth as RequestHandler,
  (req, res, next) => {
    req.params.path = '';
    universalRepoController.getRepositoryContents(req, res, next);
  }
);

// Subdirectory contents
router.get(
  '/:owner/:repo/contents/:path(*)',
  requireAuth as RequestHandler,
  universalRepoController.getRepositoryContents as RequestHandler
);

/**
 * @openapi
 * /api/repos/{owner}/{repo}/file:
 *   get:
 *     summary: Get file content
 *     description: Fetches the content of a specific file (works for GitHub and GitLab)
 *     tags:
 *       - Universal Repository
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: Repository owner
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: Repository name
 *       - in: path
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: File path
 *       - in: query
 *         name: ref
 *         required: false
 *         schema:
 *           type: string
 *         description: Branch or commit ref
 *     responses:
 *       200:
 *         description: File content retrieved successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
router.get(
  '/:owner/:repo/file/:path(*)',
  requireAuth as RequestHandler,
  (req, res, next) => {
    const filePath = req.params.path;
    if (!filePath || filePath.trim() === '') {
      res.status(400).json({ error: 'File path is required and cannot be empty.' });
      return;
    }
    universalRepoController.getFileContent(req, res, next);
  }
);

export default router;
