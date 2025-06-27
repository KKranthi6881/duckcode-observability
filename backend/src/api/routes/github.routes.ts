import { Router, RequestHandler } from 'express';
import * as githubController from '@/api/controllers/github.controller';
import { requireAuth } from '@/api/middlewares/auth.middleware'; 

const router = Router();

/**
 * @openapi
 * /api/github/start-installation:
 *   get:
 *     summary: Starts the GitHub App installation process
 *     description: Generates a state token, saves it with the user's ID, and redirects the user to the GitHub App installation page. Requires authentication.
 *     tags:
 *       - GitHub
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       302:
 *         description: Redirects to the GitHub App installation URL.
 *       401:
 *         description: Unauthorized.
 */
router.get('/start-installation', requireAuth as RequestHandler, githubController.startGitHubInstallation as RequestHandler);

/**
 * @openapi
 * /api/github/setup-callback:
 *   get:
 *     summary: Handles the callback from GitHub after app installation or setup.
 *     description: |
 *       This endpoint is redirected to by GitHub after a user installs the GitHub App
 *       or finishes the setup flow. It receives an `installation_id` and optionally a `setup_action`.
 *       The backend then fetches installation details, saves them, and redirects the user
 *       to the frontend.
 *     parameters:
 *       - in: query
 *         name: installation_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the installation.
 *       - in: query
 *         name: setup_action
 *         required: false
 *         schema:
 *           type: string
 *         description: The action performed during setup (e.g., "install").
 *       - in: query
 *         name: code
 *         required: false
 *         schema:
 *           type: string
 *         description: A temporary code from GitHub, used in some OAuth flows.
 *     responses:
 *       '302':
 *         description: Redirects to the frontend application upon successful processing.
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *             description: The URL to which the user is redirected.
 *       '400':
 *         description: Bad request (e.g., missing installation_id).
 *       '500':
 *         description: Internal server error during processing.
 *     tags:
 *       - GitHub
 */
router.get('/setup-callback', githubController.handleGitHubSetupCallback as RequestHandler);

/**
 * @openapi
 * /api/github/manual-link-installation:
 *   post:
 *     summary: Manually links a GitHub installation to the authenticated user
 *     description: |
 *       This endpoint is used when the automatic linking process failed due to missing state parameter.
 *       It requires the user to be authenticated and provides a way to manually associate
 *       a GitHub App installation with their account.
 *     parameters:
 *       - in: query
 *         name: installation_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the GitHub App installation to link.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Installation successfully linked
 *       400:
 *         description: Bad request (e.g., missing installation_id)
 *       401:
 *         description: Unauthorized (user not authenticated)
 *       500:
 *         description: Server error during linking process
 *     tags:
 *       - GitHub
 */
router.post('/manual-link-installation', requireAuth as RequestHandler, githubController.manualLinkInstallation as RequestHandler);

/**
 * @openapi
 * /api/github/connection-status:
 *   get:
 *     summary: Fetches the current user's GitHub connection status
 *     description: Requires authentication.
 *     tags:
 *       - GitHub
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: GitHub connection status
 *       401:
 *         description: Unauthorized.
 */
router.get('/connection-status', requireAuth as RequestHandler, githubController.getGitHubConnectionStatus as RequestHandler);

/**
 * @openapi
 * /api/github/repos/{owner}/{repo}/contents:
 *   get:
 *     summary: Get contents of a repository directory
 *     description: Fetches content listing for the specified path in a GitHub repository.
 *     tags:
 *       - GitHub
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: The account owner of the repository
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the repository
 *       - in: query
 *         name: ref
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the commit/branch/tag. Default is the repository's default branch.
 *     responses:
 *       200:
 *         description: Repository contents retrieved successfully
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Repository or path not found
 *       500:
 *         description: Server error
 */
// Route for ROOT repository contents (e.g., /repos/owner/repo/contents)
router.get('/repos/:owner/:repo/contents', requireAuth as RequestHandler, (req, res, next) => {
  req.params.path = ''; // Explicitly set path for root
  githubController.getRepoContents(req, res, next);
});

// Route for repository contents IN SUBDIRECTORIES (e.g., /repos/owner/repo/contents/path/to/folder)
// :path(*) captures 'path/to/folder'
router.get('/repos/:owner/:repo/contents/:path(*)', requireAuth as RequestHandler, (req, res, next) => {
  // req.params.path is populated by :path(*)
  githubController.getRepoContents(req, res, next);
});

/**
 * @openapi
 * /api/github/repos/{owner}/{repo}/content:
 *   get:
 *     summary: Get content of a specific file
 *     description: Fetches the content of a file from a GitHub repository. Returns base64 encoded content.
 *     tags:
 *       - GitHub
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: The account owner of the repository
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the repository
 *       - in: query
 *         name: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The file path within the repository
 *       - in: query
 *         name: ref
 *         required: false
 *         schema:
 *           type: string
 *         description: The name of the commit/branch/tag. Default is the repository's default branch.
 *     responses:
 *       200:
 *         description: File content retrieved successfully
 *       400:
 *         description: Invalid request or path is not a file
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: File not found
 *       500:
 *         description: Server error
 */
// Route for specific file content
// :path(*) captures 'path/to/file.md'. Handler checks if empty.
router.get('/repos/:owner/:repo/content/:path(*)', requireAuth as RequestHandler, (req, res, next) => {
  const filePath = req.params.path;
  if (!filePath || filePath.trim() === '') {
    res.status(400).json({ error: 'File path is required and cannot be empty.' });
    return; // Explicitly return void after sending response
  }
  githubController.getFileContent(req, res, next);
});

/**
 * @openapi
 * /api/github/repos/{owner}/{repo}:
 *   get:
 *     summary: Get detailed repository information
 *     description: Fetches detailed information about a GitHub repository including metadata like dates, size, etc.
 *     tags:
 *       - GitHub
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: owner
 *         required: true
 *         schema:
 *           type: string
 *         description: The account owner of the repository
 *       - in: path
 *         name: repo
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the repository
 *     responses:
 *       200:
 *         description: Repository details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Repository not found
 *       500:
 *         description: Server error
 */
router.get('/repos/:owner/:repo', requireAuth as RequestHandler, githubController.getRepositoryDetails as RequestHandler);

// Placeholder for webhook handler route
// router.post('/webhooks', githubController.handleGitHubWebhook);

export default router;