import { Router, RequestHandler } from 'express';
import * as githubController from '@/api/controllers/github.controller'; 

const router = Router();

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

// Placeholder for webhook handler route
// router.post('/webhooks', githubController.handleGitHubWebhook);

export default router;