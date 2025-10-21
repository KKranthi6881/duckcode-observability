import { Request, Response } from 'express';
import crypto from 'crypto';
import { ExtractionOrchestrator } from '../../services/metadata/extraction/ExtractionOrchestrator';
import { supabase } from '../../config/supabase';

export class WebhookController {
  private orchestrator: ExtractionOrchestrator;

  constructor(orchestrator: ExtractionOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Handle GitHub webhook events
   * POST /api/webhooks/github
   */
  async handleGitHubWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;
      const payload = req.body;

      console.log(`📨 Received GitHub webhook: ${event}`);

      // Verify webhook signature
      if (!this.verifyGitHubSignature(req.body, signature)) {
        console.warn('⚠️  Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Only process push events
      if (event !== 'push') {
        console.log(`   Ignoring event type: ${event}`);
        return res.status(200).json({ message: 'Event ignored' });
      }

      // Only process pushes to main/master branch
      const branch = payload.ref?.replace('refs/heads/', '');
      if (!['main', 'master'].includes(branch)) {
        console.log(`   Ignoring push to branch: ${branch}`);
        return res.status(200).json({ message: 'Non-main branch ignored' });
      }

      const repoUrl = payload.repository?.clone_url;
      if (!repoUrl) {
        return res.status(400).json({ error: 'Missing repository URL' });
      }

      console.log(`🔄 Push to ${branch} detected for: ${repoUrl}`);

      // Find connection by repository URL
      const { data: connection } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('id, repository_url, status')
        .eq('repository_url', repoUrl)
        .single();

      if (!connection) {
        console.log(`   No connection found for: ${repoUrl}`);
        return res.status(200).json({ message: 'Repository not connected' });
      }

      // Check if already extracting
      const existingProgress = this.orchestrator.getProgress(connection.id);
      if (existingProgress) {
        console.log(`   Extraction already in progress`);
        return res.status(200).json({ 
          message: 'Extraction already in progress',
          connectionId: connection.id
        });
      }

      console.log(`✅ Triggering automatic extraction for connection: ${connection.id}`);

      // Start extraction asynchronously
      this.orchestrator.startExtraction(connection.id)
        .catch((error) => {
          console.error(`❌ Background extraction failed:`, error);
        });

      return res.status(200).json({
        success: true,
        message: 'Automatic extraction triggered',
        connectionId: connection.id
      });

    } catch (error: any) {
      console.error('❌ Webhook processing failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify GitHub webhook signature
   */
  private verifyGitHubSignature(payload: any, signature: string): boolean {
    if (!signature) {
      return false;
    }

    const secret = process.env.GITHUB_WEBHOOK_SECRET || '';
    if (!secret) {
      console.warn('⚠️  GITHUB_WEBHOOK_SECRET not configured');
      return true; // Allow in development
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  }

  /**
   * Setup webhook for a connection
   * POST /api/webhooks/github/setup
   */
  async setupWebhook(req: Request, res: Response) {
    try {
      const { connectionId } = req.body;

      // Get connection details
      const { data: connection } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('*')
        .eq('id', connectionId)
        .single();

      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // TODO: Create webhook via GitHub API
      // This requires GitHub API integration
      // For now, return manual setup instructions

      const webhookUrl = `${process.env.BACKEND_URL}/api/webhooks/github`;

      return res.json({
        success: true,
        message: 'Webhook setup instructions',
        instructions: {
          url: webhookUrl,
          content_type: 'application/json',
          secret: process.env.GITHUB_WEBHOOK_SECRET || 'configure-secret',
          events: ['push'],
          active: true
        },
        manual_setup_url: `https://github.com/${connection.repository_owner}/${connection.repository_name}/settings/hooks/new`
      });

    } catch (error: any) {
      console.error('Error setting up webhook:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
