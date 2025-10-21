import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { orchestrator } from './metadata.routes';

const router = Router();
const controller = new WebhookController(orchestrator);

/**
 * GitHub webhook endpoint (no auth - verified by signature)
 * POST /api/webhooks/github
 */
router.post(
  '/github',
  controller.handleGitHubWebhook.bind(controller)
);

/**
 * Setup webhook for a connection (requires auth)
 * POST /api/webhooks/github/setup
 */
router.post(
  '/github/setup',
  requireAuth,
  controller.setupWebhook.bind(controller)
);

export default router;
