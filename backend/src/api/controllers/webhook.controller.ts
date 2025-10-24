import { Request, Response } from 'express';
import crypto from 'crypto';
import { ExtractionOrchestrator } from '../../services/metadata/extraction/ExtractionOrchestrator';
import { supabase, supabaseAdmin } from '../../config/supabase';
import { decryptWebhookSecret } from '../../services/encryptionService';
import { DocumentationUpdateOrchestrator } from '../../services/documentation/DocumentationUpdateOrchestrator';

export class WebhookController {
  private orchestrator: ExtractionOrchestrator;

  constructor(orchestrator: ExtractionOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Handle GitHub webhook events
   * POST /api/webhooks/github/:organizationId
   */
  async handleGitHubWebhook(req: Request, res: Response) {
    try {
      const organizationId = req.params.organizationId;
      const signature = req.headers['x-hub-signature-256'] as string;
      const event = req.headers['x-github-event'] as string;
      const payload = req.body;

      console.log(`📨 Received GitHub webhook: ${event} for org: ${organizationId}`);

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

      // Find connection by organization and repository URL
      const { data: connection } = await supabaseAdmin
        .schema('enterprise')
        .from('github_connections')
        .select('id, repository_url, status, organization_id, webhook_secret')
        .eq('organization_id', organizationId)
        .eq('repository_url', repoUrl)
        .eq('webhook_configured', true)
        .single();

      if (!connection) {
        console.log(`   No connection found for: ${repoUrl}`);
        return res.status(200).json({ message: 'Repository not connected or webhook not configured' });
      }

      // Decrypt and verify webhook signature
      if (!connection.webhook_secret) {
        console.warn('⚠️  Webhook secret not configured for this connection');
        return res.status(400).json({ error: 'Webhook not properly configured' });
      }

      const webhookSecret = decryptWebhookSecret(connection.webhook_secret);
      if (!this.verifyGitHubSignature(req.body, signature, webhookSecret)) {
        console.warn('⚠️  Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
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

      // Update last delivery timestamp
      await supabaseAdmin
        .schema('enterprise')
        .from('github_connections')
        .update({ webhook_last_delivery_at: new Date().toISOString() })
        .eq('id', connection.id);

      console.log(`✅ Triggering automatic extraction for connection: ${connection.id}`);

      // Log webhook event
      await this.logWebhookEvent({
        organizationId: connection.organization_id,
        connectionId: connection.id,
        provider: 'github',
        event: 'push',
        repositoryUrl: repoUrl,
        branch,
        commits: payload.commits?.length || 0,
        pusher: payload.pusher?.name || 'unknown',
        commitSha: payload.after,
        commitMessage: payload.commits?.[payload.commits.length - 1]?.message
      });

      // Start extraction asynchronously
      this.orchestrator.startExtraction(connection.id)
        .then(() => {
          // Trigger documentation update after extraction completes
          this.triggerDocumentationUpdate(connection.id, connection.organization_id);
        })
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
  private verifyGitHubSignature(payload: any, signature: string, secret: string): boolean {
    if (!signature) {
      return false;
    }

    if (!secret) {
      console.warn('⚠️  Webhook secret not provided');
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
      );
    } catch (error) {
      return false;
    }
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

  /**
   * Handle GitLab webhook events
   * POST /api/webhooks/gitlab/:organizationId
   */
  async handleGitLabWebhook(req: Request, res: Response) {
    try {
      const token = req.headers['x-gitlab-token'] as string;
      const event = req.headers['x-gitlab-event'] as string;
      const payload = req.body;
      const organizationId = req.params.organizationId;

      console.log(`📨 Received GitLab webhook: ${event} for org: ${organizationId}`);

      // Verify webhook token
      if (!this.verifyGitLabToken(token)) {
        console.warn('⚠️  Invalid webhook token');
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Only process push events
      if (event !== 'Push Hook') {
        console.log(`   Ignoring event type: ${event}`);
        return res.status(200).json({ message: 'Event ignored' });
      }

      // Only process pushes to main/master branch
      const branch = payload.ref?.replace('refs/heads/', '');
      if (!['main', 'master'].includes(branch)) {
        console.log(`   Ignoring push to branch: ${branch}`);
        return res.status(200).json({ message: 'Non-main branch ignored' });
      }

      const repoUrl = payload.project?.git_http_url;
      if (!repoUrl) {
        return res.status(400).json({ error: 'Missing repository URL' });
      }

      console.log(`🔄 Push to ${branch} detected for: ${repoUrl}`);

      // Find connection by repository URL and organization
      const { data: connection } = await supabase
        .schema('enterprise')
        .from('github_connections') // GitLab also uses this table
        .select('id, repository_url, status, organization_id')
        .eq('repository_url', repoUrl)
        .eq('organization_id', organizationId)
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

      // Log webhook event
      await this.logWebhookEvent({
        organizationId,
        connectionId: connection.id,
        provider: 'gitlab',
        event: 'push',
        repositoryUrl: repoUrl,
        branch,
        commits: payload.commits?.length || 0,
        pusher: payload.user_name || 'unknown',
        commitSha: payload.after,
        commitMessage: payload.commits?.[payload.commits.length - 1]?.message
      });

      // Start extraction asynchronously
      this.orchestrator.startExtraction(connection.id)
        .then(() => {
          // Trigger documentation update after extraction completes
          this.triggerDocumentationUpdate(connection.id, organizationId);
        })
        .catch((error) => {
          console.error(`❌ Background extraction failed:`, error);
        });

      return res.status(200).json({
        success: true,
        message: 'Automatic extraction triggered',
        connectionId: connection.id
      });

    } catch (error: any) {
      console.error('❌ GitLab webhook processing failed:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify GitLab webhook token
   */
  private verifyGitLabToken(token: string): boolean {
    if (!token) {
      return false;
    }

    const secret = process.env.GITLAB_WEBHOOK_TOKEN || '';
    if (!secret) {
      console.warn('⚠️  GITLAB_WEBHOOK_TOKEN not configured');
      return true; // Allow in development
    }

    return token === secret;
  }

  /**
   * Log webhook event to database
   */
  private async logWebhookEvent(event: {
    organizationId: string;
    connectionId: string;
    provider: string;
    event: string;
    repositoryUrl: string;
    branch: string;
    commits: number;
    pusher: string;
    commitSha?: string;
    commitMessage?: string;
  }): Promise<void> {
    try {
      await supabaseAdmin
        .schema('metadata')
        .from('webhook_events')
        .insert({
          connection_id: event.connectionId,
          organization_id: event.organizationId,
          provider: event.provider,
          event_type: event.event,
          branch: event.branch,
          commit_count: event.commits,
          pusher: event.pusher,
          commit_sha: event.commitSha,
          commit_message: event.commitMessage,
          processed: true,
          extraction_triggered: true,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging webhook event:', error);
      // Don't fail webhook processing if logging fails
    }
  }

  /**
   * Trigger documentation update after metadata extraction
   * This is called after extraction completes
   */
  private async triggerDocumentationUpdate(
    connectionId: string,
    organizationId: string,
    webhookEventId?: string
  ): Promise<void> {
    try {
      console.log(`📄 [Auto-Update] Triggering documentation update check...`);
      console.log(`   Connection: ${connectionId}`);
      console.log(`   Organization: ${organizationId}`);

      // Use DocumentationUpdateOrchestrator to handle the update
      const updateOrchestrator = new DocumentationUpdateOrchestrator();
      await updateOrchestrator.handleMetadataChange(
        connectionId,
        organizationId,
        webhookEventId
      );

      console.log(`✅ [Auto-Update] Documentation update check completed`);

    } catch (error: any) {
      console.error('⚠️  [Auto-Update] Error triggering documentation update:', error.message);
      // Don't fail extraction if doc update fails
    }
  }
}
