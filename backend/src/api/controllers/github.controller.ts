import { Request, Response, NextFunction } from 'express';
import * as githubService from '@/services/github.service';
import dotenv from 'dotenv';

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL;
const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;

export const startGitHubInstallation = async (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  const userId = req.user?.id;

  if (!userId) {
    // This should ideally not be hit if requireAuth is working, but good to keep
    res.status(401).json({ error: 'User not authenticated.' });
    return;
  }

  if (!GITHUB_APP_NAME) {
    console.error('[Controller] GITHUB_APP_NAME is not set in .env file.');
    // Send a JSON error response
    res.status(500).json({ error: 'GitHub App name is not configured on the server.' });
    return;
  }

  try {
    const state = await githubService.createInstallationState(userId);
    console.log(`[Controller] Generated state ${state} for user ${userId}.`);

    const installationUrl = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new?state=${state}`;
    console.log(`[Controller] Sending GitHub installation URL to frontend: ${installationUrl}`);
    
    // Send the URL back to the frontend in a JSON response
    res.status(200).json({ installationUrl });
  } catch (error) {
    console.error('[Controller] Error starting GitHub installation:', error);
    // Let the generic error handler deal with it, or send a specific JSON error
    // For consistency, sending JSON error
    if (error instanceof Error) {
        res.status(500).json({ error: `Error starting GitHub installation: ${error.message}` });
    } else {
        res.status(500).json({ error: 'An unknown error occurred while starting GitHub installation.' });
    }
  }
};

export const handleGitHubSetupCallback = async (req: Request, res: Response, next: NextFunction) => {
  // Explicitly cast query parameters to make TypeScript happy
  const installation_id = req.query.installation_id as string | undefined;
  const setup_action = req.query.setup_action as string | undefined;
  const state = req.query.state as string | undefined;
  
  if (!installation_id) {
    // If installation_id is missing, it's a critical error regardless of state.
    console.error('[Controller] GitHub callback missing installation_id.');
    res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=missing_installation_id`);
    return;
  }

  // If state is missing, but we have an installation_id,
  // transition into 'manual linking' mode which is managed via the frontend.
  if (!state) {
    // Skip validateState and just redirect to frontend manual linking flow,
    // this is necessary for various edge cases like:
    // - Direct app installation without going through our flow
    // - Browser cookie/localStorage issues losing the state
    // - When GitHub sometimes drops the state parameter when generating its own
    //   error pages which then redirect to us without state.
    
    console.log(`[Controller] GitHub callback missing state, but has installation_id: ${installation_id}. Redirecting to manual linking.`);
    
    if (!FRONTEND_URL) {
      console.error('[Controller] FRONTEND_URL is not set in .env file.');
      res.status(500).send('Server misconfiguration: Frontend URL is not configured.');
      return;
    }
    // Redirecting to the settings page. The Settings.tsx component's useEffect/onFocus
    // should handle re-fetching the (now hopefully updated) GitHub connection status.
    res.redirect(`${FRONTEND_URL}/dashboard/settings?github_post_management=true&installation_id=${installation_id}`);
    return;
  }

  console.log(`[Controller] GitHub callback with state: ${state}, installation_id: ${installation_id}, setup_action: ${setup_action}`);
  try {
    // Validate the provided state is legitimate and find the associated user
    // TypeScript is now happy because we explicitly cast state above
    const supabaseUserId = await githubService.findAndConsumeState(state);
    if (!supabaseUserId) {
      console.warn(`[Controller] Invalid or consumed state token: ${state} for installation_id: ${installation_id}`);
      res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=invalid_state_token&installation_id=${installation_id}`);
      return;
    }

    console.log(`[Controller] State token validated for user: ${supabaseUserId}. Processing installation_id: ${installation_id}`);
    // This service function should ideally handle both new installations and updates to existing ones if necessary.
    await githubService.processInstallationFromId(parseInt(installation_id, 10), supabaseUserId);
    console.log(`[Controller] Successfully processed installation_id: ${installation_id} for user: ${supabaseUserId}. Redirecting to frontend callback with success.`);
    
    // Include setup_action in the success redirect to give more context to the frontend callback page if needed.
    res.redirect(`${FRONTEND_URL}/github/callback?status=success&installation_id=${installation_id}&setup_action=${setup_action || 'unknown'}`);
  } catch (error: any) {
    console.error(`[Controller] Error processing GitHub setup callback with state ${state} for installation_id ${installation_id}:`, error);
    res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=${encodeURIComponent(error.message)}&installation_id=${installation_id}`);
  }
};

/**
 * Manually links a GitHub installation to the currently authenticated user.
 * This is used in recovery scenarios where the state parameter was missing in the callback.
 */
export const manualLinkInstallation = async (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  const userId = req.user?.id;
  const { installation_id } = req.query;
  
  console.log(`[Controller] Manual link request received. User: ${userId}, Installation: ${installation_id}`);
  console.log(`[Controller] Headers: ${JSON.stringify(req.headers)}`);
  
  if (!userId) {
    console.error(`[Controller] Missing user ID in manual link request`);
    res.status(401).json({ 
      success: false, 
      message: 'Authentication required to link a GitHub installation' 
    });
    return;
  }
  
  if (!installation_id || typeof installation_id !== 'string') {
    console.error(`[Controller] Missing or invalid installation_id parameter in manual link request`);
    res.status(400).json({ 
      success: false, 
      message: 'Missing or invalid installation_id parameter'
    });
    return;
  }
  
  try {
    // Process the installation using the current authenticated user's ID
    await githubService.processInstallationFromId(parseInt(installation_id, 10), userId);
    
    console.log(`[Controller] Successfully manually linked installation ${installation_id} to user ${userId}`);
    
    res.status(200).json({ 
      success: true, 
      message: 'GitHub installation successfully linked to your account',
      installation_id: installation_id
    });
  } catch (error: any) {
    console.error(`[Controller] Error manual linking installation ${installation_id}:`, error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to link GitHub installation'
    });
  }
};

export const getGitHubConnectionStatus = async (req: Request, res: Response, next: NextFunction) => {
  // @ts-ignore
  const userId = req.user?.id;
  if (!userId) {
    // Ensure a response is sent and the function exits.
    res.status(401).json({ message: 'User not authenticated.' });
    return;
  }
  try {
    // Assuming githubService is an object/module exporting your service functions
    const connectionStatus = await githubService.getInstallationConnectionDetails(userId);
    res.json(connectionStatus);
  } catch (error) {
    console.error('[Controller] Error getting GitHub connection status:', error);
    // Pass the error to the next error-handling middleware.
    next(error);
  }
};

// Get contents of a repository or path within a repository
export const getRepoContents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Authentication required to access repository content' });
      return;
    }

    const userId = req.user.id;
    const { owner, repo, path = '' } = req.params;
    const { ref } = req.query as { ref?: string };

    if (!owner || !repo) {
      res.status(400).json({ message: 'Owner and repository name are required' });
      return;
    }

    // Get GitHub installation details for this user
    const connectionStatus = await githubService.getInstallationConnectionDetails(userId);
    
    if (!connectionStatus.isConnected || !connectionStatus.details) {
      res.status(404).json({ message: 'GitHub connection not found' });
      return;
    }
    
    // Get the Octokit app instance
    const app = githubService.getApp();
    const octokit = await app.getInstallationOctokit(connectionStatus.details.installationId);

    // Fetch repository contents
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: ref || undefined,
    });

    res.json(data);
  } catch (error: any) {
    console.error('[Controller] Error getting repository contents:', error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      message: error.message || 'Failed to fetch repository contents',
      error: error.response?.data?.message || error.message
    });
  }
};

// Get file content from a repository
export const getFileContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Authentication required to access file content' });
      return;
    }

    const userId = req.user.id;
    const { owner, repo, path } = req.params;
    const { ref } = req.query as { ref?: string };

    if (!owner || !repo || !path) {
      res.status(400).json({ message: 'Owner, repository name, and file path are required' });
      return;
    }

    // Get GitHub installation details for this user
    const connectionStatus = await githubService.getInstallationConnectionDetails(userId);
    
    if (!connectionStatus.isConnected || !connectionStatus.details) {
      res.status(404).json({ message: 'GitHub connection not found' });
      return;
    }
    
    // Get the Octokit app instance
    const app = githubService.getApp();
    const octokit = await app.getInstallationOctokit(connectionStatus.details.installationId);

    // Fetch file content
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: ref || undefined,
    });

    // If the result is an array, it's a directory, not a file
    if (Array.isArray(data)) {
      res.status(400).json({ message: 'Requested path is a directory, not a file' });
      return;
    }

    // For files, return content (base64 encoded) and other metadata
    res.json(data);
  } catch (error: any) {
    console.error('[Controller] Error getting file content:', error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      message: error.message || 'Failed to fetch file content',
      error: error.response?.data?.message || error.message
    });
  }
};

// Get detailed repository information
export const getRepositoryDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Authentication required to access repository details' });
      return;
    }

    const userId = req.user.id;
    const { owner, repo } = req.params;

    if (!owner || !repo) {
      res.status(400).json({ message: 'Owner and repository name are required' });
      return;
    }

    // Get GitHub installation details for this user
    const connectionStatus = await githubService.getInstallationConnectionDetails(userId);
    
    if (!connectionStatus.isConnected || !connectionStatus.details) {
      res.status(404).json({ message: 'GitHub connection not found' });
      return;
    }
    
    // Get the Octokit app instance
    const app = githubService.getApp();
    const octokit = await app.getInstallationOctokit(connectionStatus.details.installationId);

    // Fetch repository details
    const { data } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    res.json(data);
  } catch (error: any) {
    console.error('[Controller] Error getting repository details:', error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({
      message: error.message || 'Failed to fetch repository details',
      error: error.response?.data?.message || error.message
    });
  }
};