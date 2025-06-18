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

// Placeholder for webhook handler route
// router.post('/webhooks', githubController.handleGitHubWebhook);

export default router;