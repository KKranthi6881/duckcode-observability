import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../../config/supabase';
import { encryptGitHubToken, validateGitHubToken, decryptGitHubToken, generateWebhookSecret, encryptWebhookSecret } from '../../services/encryptionService';
import { orchestrator } from '../routes/metadata.routes';

/**
 * Admin Metadata Controller
 * Handles GitHub connections and metadata extraction jobs
 */
export class AdminMetadataController {
  
  /**
   * List all GitHub connections for organization
   */
  static async listConnections(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get user's organization from user profile
      const { data: userProfile, error: orgError } = await supabase
        .schema('duckcode')
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

      if (orgError || !userProfile || !userProfile.organization_id) {
        return res.status(403).json({ error: 'No organization found' });
      }

      const organizationId = userProfile.organization_id;

      const { data: connections, error } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich connections with actual object/column counts from metadata schema
      const enrichedConnections = await Promise.all(
        (connections || []).map(async (conn) => {
          // Count objects for this connection
          const { count: objectCount } = await supabase
            .schema('metadata')
            .from('objects')
            .select('id', { count: 'exact', head: true })
            .eq('connection_id', conn.id)
            .eq('organization_id', organizationId);

          // Count columns for this connection
          const { count: columnCount } = await supabase
            .schema('metadata')
            .from('columns')
            .select('id', { count: 'exact', head: true })
            .eq('connection_id', conn.id)
            .eq('organization_id', organizationId);

          // Count files for this connection
          const { count: fileCount } = await supabase
            .schema('metadata')
            .from('files')
            .select('id', { count: 'exact', head: true })
            .eq('connection_id', conn.id)
            .eq('organization_id', organizationId);

          return {
            ...conn,
            total_objects: objectCount || 0,
            total_columns: columnCount || 0,
            total_files: fileCount || 0
          };
        })
      );

      res.json({ connections: enrichedConnections });
    } catch (error) {
      console.error('Error listing connections:', error);
      res.status(500).json({ 
        error: 'Failed to list connections',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Connect a new GitHub or GitLab repository
   */
  static async connectRepository(req: Request, res: Response) {
    try {
      const { repositoryUrl, branch = 'main', accessToken, provider = 'github' } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get user's organization from user profile
      const { data: userProfile, error: orgError } = await supabase
        .schema('duckcode')
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

      if (orgError || !userProfile || !userProfile.organization_id) {
        return res.status(403).json({ error: 'No organization found' });
      }

      const organizationId = userProfile.organization_id;

      if (!repositoryUrl || !accessToken || !provider) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Parse repository URL based on provider
      let owner: string;
      let name: string;
      let urlMatch: RegExpMatchArray | null;

      if (provider === 'gitlab') {
        // Parse GitLab URL (supports gitlab.com and self-hosted)
        urlMatch = repositoryUrl.match(/gitlab\.com\/([^\/]+)\/([^\/\.]+)/);
        if (!urlMatch) {
          return res.status(400).json({ error: 'Invalid GitLab URL' });
        }
        [, owner, name] = urlMatch;
        
        // Validate GitLab token format (glpat-...)
        if (!accessToken.startsWith('glpat-')) {
          console.warn('⚠️  GitLab token format validation failed');
          return res.status(400).json({ 
            error: 'Invalid GitLab token format',
            message: 'Please provide a valid GitLab Personal Access Token (glpat-...)'
          });
        }
      } else {
        // Parse GitHub URL
        urlMatch = repositoryUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
        if (!urlMatch) {
          return res.status(400).json({ error: 'Invalid GitHub URL' });
        }
        [, owner, name] = urlMatch;

        // Validate GitHub token format
        if (!validateGitHubToken(accessToken)) {
          console.warn('⚠️  GitHub token format validation failed');
          return res.status(400).json({ 
            error: 'Invalid GitHub token format',
            message: 'Please provide a valid GitHub Personal Access Token (ghp_...) or Fine-grained token (github_pat_...)'
          });
        }
      }

      // Encrypt the access token using AES-256-GCM
      console.log(`🔒 Encrypting ${provider} access token...`);
      const encryptedToken = encryptGitHubToken(accessToken);
      console.log('✅ Token encrypted successfully');

      // Create connection record
      const { data: connection, error: connError } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .insert({
          organization_id: organizationId,
          repository_url: repositoryUrl,
          repository_name: name,
          repository_owner: owner,
          branch: branch,
          access_token_encrypted: encryptedToken, // Encrypted with AES-256-GCM
          provider: provider, // 'github' or 'gitlab'
          status: 'connected',
          created_by: userId
        })
        .select()
        .single();

      if (connError) throw connError;

      // Create repository record in metadata schema
      const { data: repo, error: repoError} = await supabase
        .schema('metadata')
        .from('repositories')
        .insert({
          organization_id: organizationId,
          connection_id: connection.id,
          path: repositoryUrl,
          name: name,
          type: 'git_repo'
        })
        .select()
        .single();

      if (repoError) {
        console.warn('Failed to create repository record:', repoError);
      }

      // =========================================================================
      // AUTOMATIC WEBHOOK CREATION (ONLY FOR GITHUB)
      // =========================================================================
      if (provider === 'github') {
        try {
          console.log(`🪝 [Webhook] Creating webhook for ${owner}/${name}...`);
          
          // 1. Generate webhook secret
          const webhookSecret = generateWebhookSecret();
          
          // 2. Create webhook via GitHub API
          const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
          const webhookUrl = `${backendUrl}/api/webhooks/github/${organizationId}`;
          
          const webhookResponse = await fetch(
            `https://api.github.com/repos/${owner}/${name}/hooks`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github+json',
                'Content-Type': 'application/json',
                'X-GitHub-Api-Version': '2022-11-28'
              },
              body: JSON.stringify({
                name: 'web',
                active: true,
                events: ['push'],
                config: {
                  url: webhookUrl,
                  content_type: 'json',
                  secret: webhookSecret, // Plain text to GitHub
                  insecure_ssl: '0'
                }
              })
            }
          );

          if (webhookResponse.ok) {
            const webhook: any = await webhookResponse.json();
            
            // 3. Encrypt and store webhook secret
            const encryptedSecret = encryptWebhookSecret(webhookSecret);
            
            await supabaseAdmin
              .schema('enterprise')
              .from('github_connections')
              .update({
                webhook_id: webhook.id.toString(),
                webhook_secret: encryptedSecret,
                webhook_configured: true,
                webhook_configured_at: new Date().toISOString()
              })
              .eq('id', connection.id);
            
            console.log(`✅ [Webhook] Successfully created webhook ID: ${webhook.id} for ${owner}/${name}`);
            console.log(`   Webhook URL: ${webhookUrl}`);
          } else {
            const errorData: any = await webhookResponse.json();
            console.error(`⚠️  [Webhook] Failed to create webhook:`, errorData);
            
            // Store error but don't fail the connection
            await supabaseAdmin
              .schema('enterprise')
              .from('github_connections')
              .update({
                webhook_configured: false,
                webhook_last_error: errorData.message || 'Failed to create webhook'
              })
              .eq('id', connection.id);
          }
        } catch (webhookError: any) {
          console.error('⚠️  [Webhook] Error creating webhook:', webhookError.message);
          
          // Store error but don't fail the connection
          await supabaseAdmin
            .schema('enterprise')
            .from('github_connections')
            .update({
              webhook_configured: false,
              webhook_last_error: webhookError.message || 'Unknown error'
            })
            .eq('id', connection.id);
        }
      }

      res.json({ 
        message: 'Repository connected successfully',
        connection 
      });
    } catch (error: any) {
      console.error('Error connecting repository:', error);
      
      // Handle duplicate repository
      if (error.code === '23505' && error.message?.includes('github_connections_organization_id_repository_url_key')) {
        return res.status(409).json({ 
          error: 'Repository already connected',
          message: 'This repository is already connected to your organization. Check the list below.'
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to connect repository',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Start metadata extraction
   */
  static async startExtraction(req: Request, res: Response) {
    try {
      const { connectionId } = req.params;
      const { fullExtraction = true, filePatterns } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get user's organization from user profile
      const { data: userProfile, error: orgError } = await supabase
        .schema('duckcode')
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

      if (orgError || !userProfile || !userProfile.organization_id) {
        return res.status(403).json({ error: 'No organization found' });
      }

      const organizationId = userProfile.organization_id;

      // Get connection details
      const { data: connection, error: connError } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('organization_id', organizationId)
        .single();

      if (connError || !connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      // Check if extraction is already running
      if (connection.status === 'extracting') {
        return res.status(409).json({ 
          error: 'Extraction already in progress',
          jobId: connection.current_job_id 
        });
      }

      // Create extraction job
      const { data: job, error: jobError } = await supabase
        .from('metadata_extraction_jobs')
        .insert({
          connection_id: connectionId,
          organization_id: organizationId,
          job_type: fullExtraction ? 'full' : 'incremental',
          status: 'pending',
          config: {
            filePatterns: filePatterns || [
              '**/*.sql',
              '**/*.py',
              '**/dbt_project.yml',
              '**/models/**/*.sql',
              '**/*.ipynb'
            ],
            enableLLMValidation: true,
            enableRustParser: false, // Start with Python/SQLglot only
            qualityThreshold: 0.85
          }
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Update connection status
      await supabase
        .schema('enterprise')
        .from('github_connections')
        .update({ 
          status: 'extracting',
          current_job_id: job.id 
        })
        .eq('id', connectionId);

      // Start orchestration in background
      orchestrator.startExtraction(connectionId).catch((error: any) => {
        console.error(`Extraction job ${connectionId} failed:`, error);
      });

      res.json({ 
        message: 'Metadata extraction started',
        jobId: job.id,
        status: 'pending'
      });
    } catch (error) {
      console.error('Error starting extraction:', error);
      res.status(500).json({ 
        error: 'Failed to start extraction',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get extraction job status
   */
  static async getJobStatus(req: Request, res: Response) {
    try {
      const { connectionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get user's organization from user profile
      const { data: userProfile, error: orgError } = await supabase
        .schema('duckcode')
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

      if (orgError || !userProfile || !userProfile.organization_id) {
        return res.status(403).json({ error: 'No organization found' });
      }

      const organizationId = userProfile.organization_id;

      // Get latest job for this connection
      const { data: job, error } = await supabase
        .from('metadata_extraction_jobs')
        .select('*')
        .eq('connection_id', connectionId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !job) {
        return res.status(404).json({ error: 'No jobs found' });
      }

      res.json(job);
    } catch (error) {
      console.error('Error getting job status:', error);
      res.status(500).json({ 
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get extraction statistics
   */
  static async getStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get user's organization from user profile
      const { data: userProfile, error: orgError } = await supabase
        .schema('duckcode')
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

      if (orgError || !userProfile || !userProfile.organization_id) {
        return res.status(403).json({ error: 'No organization found' });
      }

      const organizationId = userProfile.organization_id;

      const { data: stats, error } = await supabase
        .schema('metadata')
        .rpc('get_extraction_statistics', {
          p_organization_id: organizationId
        });

      if (error) throw error;

      res.json({ stats });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ 
        error: 'Failed to get statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Disconnect repository
   */
  static async disconnectRepository(req: Request, res: Response) {
    try {
      const { connectionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get user's organization from user profile
      const { data: userProfile, error: orgError } = await supabase
        .schema('duckcode')
        .from('user_profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

      if (orgError || !userProfile || !userProfile.organization_id) {
        return res.status(403).json({ error: 'No organization found' });
      }

      const organizationId = userProfile.organization_id;

      // Get connection
      const { data: connection, error: connError } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('organization_id', organizationId)
        .single();

      if (connError || !connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      if (connection.status === 'extracting') {
        return res.status(409).json({ 
          error: 'Cannot disconnect while extraction is running' 
        });
      }

      // Delete all metadata (cascading)
      const { error: deleteError } = await supabase
        .schema('enterprise')
        .from('github_connections')
        .delete()
        .eq('id', connectionId);

      if (deleteError) throw deleteError;

      res.json({ message: 'Repository disconnected successfully' });
    } catch (error) {
      console.error('Error disconnecting repository:', error);
      res.status(500).json({ 
        error: 'Failed to disconnect repository',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
