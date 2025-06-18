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
    return res.status(401).json({ error: 'User not authenticated.' });
  }

  if (!GITHUB_APP_NAME) {
    console.error('[Controller] GITHUB_APP_NAME is not set in .env file.');
    // Send a JSON error response
    return res.status(500).json({ error: 'GitHub App name is not configured on the server.' });
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
        return res.status(500).json({ error: `Error starting GitHub installation: ${error.message}` });
    }
    return res.status(500).json({ error: 'An unknown error occurred while starting GitHub installation.' });
  }
};

export const handleGitHubSetupCallback = async (req: Request, res: Response, next: NextFunction) => {
  const { installation_id, setup_action, state } = req.query as { installation_id?: string, setup_action?: string, state?: string };

  if (!installation_id) {
    // If installation_id is missing, it's a critical error regardless of state.
    console.error('[Controller] GitHub callback missing installation_id.');
    return res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=missing_installation_id`);
  }

  // If state is missing, but we have an installation_id,
  // it's highly likely a redirect after the user managed their existing installation settings on GitHub.
  if (!state) {
    console.log(`[Controller] GitHub callback for installation_id: ${installation_id} without 'state'. Setup_action: '${setup_action}'. Assuming post-management redirect.`);
    try {
      // Attempt to find the user associated with this installation to refresh it.
      const existingInstallation = await githubService.findInstallationByInstallationId(parseInt(installation_id, 10));
      if (existingInstallation && existingInstallation.supabase_user_id) {
        console.log(`[Controller] Found existing installation for user ${existingInstallation.supabase_user_id}. Refreshing details from GitHub.`);
        await githubService.processInstallationFromId(parseInt(installation_id, 10), existingInstallation.supabase_user_id);
        console.log(`[Controller] Installation details refreshed for ${installation_id}.`);
      } else {
        console.warn(`[Controller] Post-management redirect for installation_id: ${installation_id}, but no existing installation record found or user_id missing. Cannot refresh details automatically.`);
        // If no record, we can't securely update. Redirecting and letting frontend handle it or show an error.
        // This scenario should be rare if the installation was done through the app initially.
      }
    } catch (refreshError: any) {
      console.error(`[Controller] Error during post-management refresh for installation_id ${installation_id}:`, refreshError);
      // Proceed with redirect anyway, frontend might show stale data or an error.
    }
    // Redirecting to the settings page. The Settings.tsx component's useEffect/onFocus
    // should handle re-fetching the (now hopefully updated) GitHub connection status.
    return res.redirect(`${FRONTEND_URL}/dashboard/settings?github_post_management=true&installation_id=${installation_id}`);
  }

  console.log(`[Controller] GitHub callback with state: ${state}, installation_id: ${installation_id}, setup_action: ${setup_action}`);
  try {
    const supabaseUserId = await githubService.findAndConsumeState(state);
    if (!supabaseUserId) {
      console.warn(`[Controller] Invalid or consumed state token: ${state} for installation_id: ${installation_id}`);
      return res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=invalid_state_token&installation_id=${installation_id}`);
    }

    console.log(`[Controller] State token validated for user: ${supabaseUserId}. Processing installation_id: ${installation_id}`);
    // This service function should ideally handle both new installations and updates to existing ones if necessary.
    await githubService.processInstallationFromId(parseInt(installation_id, 10), supabaseUserId);
    console.log(`[Controller] Successfully processed installation_id: ${installation_id} for user: ${supabaseUserId}. Redirecting to frontend callback with success.`);
    
    // Include setup_action in the success redirect to give more context to the frontend callback page if needed.
    return res.redirect(`${FRONTEND_URL}/github/callback?status=success&installation_id=${installation_id}&setup_action=${setup_action || 'unknown'}`);
  } catch (error: any) {
    console.error(`[Controller] Error processing GitHub setup callback with state ${state} for installation_id ${installation_id}:`, error);
    return res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=${encodeURIComponent(error.message)}&installation_id=${installation_id}`);
  }
};

/**
 * Manually links a GitHub installation to the currently authenticated user.
 * This is used in recovery scenarios where the state parameter was missing in the callback.
 */
export const manualLinkInstallation = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  // @ts-ignore
  const userId = req.user?.id;
  const { installation_id } = req.query;
  
  console.log(`[Controller] Manual link request received. User: ${userId}, Installation: ${installation_id}`);
  console.log(`[Controller] Headers: ${JSON.stringify(req.headers)}`);
  
  if (!userId) {
    console.error(`[Controller] Missing user ID in manual link request`);
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required to link a GitHub installation' 
    });
  }
  
  if (!installation_id || typeof installation_id !== 'string') {
    console.error(`[Controller] Missing or invalid installation_id parameter in manual link request`);
    return res.status(400).json({ 
      success: false, 
      message: 'Missing or invalid installation_id parameter'
    });
  }
  
  try {
    // Process the installation using the current authenticated user's ID
    await githubService.processInstallationFromId(parseInt(installation_id, 10), userId);
    
    console.log(`[Controller] Successfully manually linked installation ${installation_id} to user ${userId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'GitHub installation successfully linked to your account',
      installation_id: installation_id
    });
  } catch (error: any) {
    console.error(`[Controller] Error manual linking installation ${installation_id}:`, error);
    return res.status(500).json({ 
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
    return res.status(401).json({ message: 'User not authenticated.' });
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