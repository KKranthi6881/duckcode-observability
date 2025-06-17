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

export const handleGitHubSetupCallback = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  const { installation_id, setup_action, state } = req.query;

  // Log all params received for debugging
  console.log(`[Controller] GitHub callback params received:`, {
    installation_id,
    setup_action,
    state,
    all_params: req.query,
    headers: req.headers,
    url: req.url,
    method: req.method
  });

  if (!installation_id || typeof installation_id !== 'string') {
    console.error('[Controller] Missing or invalid installation_id');
    return res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=missing_installation_id`);
  }

  // Check for state parameter - if missing, handle this case gracefully
  if (!state || typeof state !== 'string') {
    console.warn('[Controller] Callback received without a state parameter.');
    
    // First use our debug page to see what's happening
    if (req.query.installation_id && !req.query.state) {
      console.log('[Controller] Redirecting to debug page for testing');
      return res.redirect(`${FRONTEND_URL}/github/debug-callback?installation_id=${req.query.installation_id}&status=error&error=Missing%20security%20verification%20token.%20Please%20try%20installing%20again.&recovery=needed`);
    }

    // Without a state parameter AND without authentication, we can't securely
    // associate this installation with a user. We'll redirect to the frontend
    // with a special error code that can trigger a guided recovery flow.
    
    // For security reasons, we can't just process installations without state validation
    // as that would allow any user to claim any installation.
    
    // Instead, we'll redirect to frontend with the installation_id so the UI can guide
    // the user to claim this installation through a secure flow.
    const encodedError = encodeURIComponent('Missing security verification token. Please try installing again.');
    console.log(`[Controller] Redirecting to frontend with recovery needed. URL: ${FRONTEND_URL}/github/callback?status=error&error=${encodedError}&installation_id=${installation_id}&recovery=needed`);
    return res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=${encodedError}&installation_id=${installation_id}&recovery=needed`);
  }

  console.log(`[Controller] Received setup callback for installation ID: ${installation_id}, action: ${setup_action}`);

  try {
    // 1. Validate the state and get the associated user ID
    const supabaseUserId = await githubService.findAndConsumeState(state);

    if (!supabaseUserId) {
      console.error(`[Controller] Invalid or expired state token received: ${state}`);
      return res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=invalid_state_token`);
    }

    console.log(`[Controller] State validated for user: ${supabaseUserId}`);

    // 2. Process the installation using the ID and associate it with the user
    await githubService.processInstallationFromId(parseInt(installation_id, 10), supabaseUserId);

    console.log(`[Controller] GitHub installation ${installation_id} processed successfully for user ${supabaseUserId}.`);

    // 3. Redirect to frontend with success status
    console.log(`[Controller] Redirecting to frontend with success. URL: ${FRONTEND_URL}/github/callback?status=success&installation_id=${installation_id}`);
    res.redirect(`${FRONTEND_URL}/github/callback?status=success&installation_id=${installation_id}`);

  } catch (error: any) {
    console.error(`[Controller] Error handling GitHub setup callback for installation ${installation_id}:`, error);
    const errorMessage = encodeURIComponent(error.message || 'An unexpected error occurred.');
    console.log(`[Controller] Redirecting to frontend with error. URL: ${FRONTEND_URL}/github/callback?status=error&error=${errorMessage}&installation_id=${installation_id}`);
    // It's generally best to either send a response OR call next(), but not both.
    // Since we are handling the response with a redirect, we will not call next().
    res.redirect(`${FRONTEND_URL}/github/callback?status=error&error=${errorMessage}&installation_id=${installation_id}`);
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