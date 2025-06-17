import { Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import * as githubService from '@/services/github.service';
import { GitHubInstallationPayload } from '@/types/github.types';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_APP_ID = process.env.GITHUB_APP_ID;
const GITHUB_PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Debug logging at module load time
console.log('[DEBUG] Controller Loaded - GITHUB_APP_ID:', GITHUB_APP_ID ? 'Set' : 'Not Set');
console.log('[DEBUG] Controller Loaded - GITHUB_PRIVATE_KEY:', GITHUB_PRIVATE_KEY ? 'Set (length: ' + GITHUB_PRIVATE_KEY.length + ')' : 'Not Set');
console.log('[DEBUG] Controller Loaded - GITHUB_CLIENT_ID:', GITHUB_CLIENT_ID ? 'Set' : 'Not Set');
console.log('[DEBUG] Controller Loaded - GITHUB_CLIENT_SECRET:', GITHUB_CLIENT_SECRET ? 'Set' : 'Not Set');

if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.error('CRITICAL: Missing GitHub App credentials in .env file. Check GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET.');
  // Optionally, throw an error here to prevent the app from starting incorrectly
  // throw new Error('Essential GitHub App credentials are not configured. Server cannot start.');
}

export const handleGitHubSetupCallback = async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
  console.log('[DEBUG] handleGitHubSetupCallback - GITHUB_APP_ID:', GITHUB_APP_ID ? 'Set' : 'Not Set');
  console.log('[DEBUG] handleGitHubSetupCallback - GITHUB_PRIVATE_KEY:', GITHUB_PRIVATE_KEY ? 'Set (first 30 chars): ' + GITHUB_PRIVATE_KEY?.substring(0,30) : 'Not Set');
  console.log('[DEBUG] handleGitHubSetupCallback - GITHUB_CLIENT_ID:', GITHUB_CLIENT_ID ? 'Set' : 'Not Set');
  console.log('[DEBUG] handleGitHubSetupCallback - GITHUB_CLIENT_SECRET:', GITHUB_CLIENT_SECRET ? 'Set' : 'Not Set');

  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    // This check is somewhat redundant if the module-level check is robust,
    // but good for ensuring they are available in the handler's scope if there were async loading issues (not typical for dotenv).
    console.error('Error in handleGitHubSetupCallback: GitHub App credentials not available.');
    return next(new Error('GitHub App ID or Private Key is not configured on the server.'));
  }

  const { installation_id, setup_action, code } = req.query;

  if (!installation_id) {
    return res.status(400).send('Missing installation_id query parameter.');
  }

  try {
    // Ensure private key is formatted correctly (replace escaped newlines if necessary)
    const formattedPrivateKey = GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');

    // 1. Authenticate as the GitHub App to fetch installation details
    const auth = createAppAuth({
      appId: Number(GITHUB_APP_ID),
      privateKey: formattedPrivateKey,
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
    });

    const appAuthentication = await auth({ type: 'app' });
    const appOctokit = new Octokit({ auth: appAuthentication.token });

    // 2. Fetch the installation details
    const { data: installationDetails } = await appOctokit.apps.getInstallation({
      installation_id: Number(installation_id),
    });

    // 3. Fetch accessible repositories if the selection is "selected"
    let accessibleRepositories: any[] | undefined = undefined;
    if (installationDetails.repository_selection === 'selected') {
      // To list repositories for an installation, we need an installation token
      const installationTokenAuth = await auth({
        type: 'installation',
        installationId: Number(installation_id),
      });
      const installationOctokit = new Octokit({ auth: installationTokenAuth.token });
      const { data: reposResponse } = await installationOctokit.apps.listReposAccessibleToInstallation();
      accessibleRepositories = reposResponse.repositories;
    }

    // 4. Construct the payload for our service
    // The structure from Octokit should align well with our GitHubInstallationPayload's 'installation' and 'repositories' fields.
    // We cast to 'any' for 'installation' to simplify type matching for now; ideally, map fields explicitly or ensure types are identical.
    const payload: GitHubInstallationPayload = {
      installation: installationDetails as any, 
      repositories: accessibleRepositories,
      setup_action: setup_action as string | undefined,
      code: code as string | undefined, // Pass along the code if present
    };

    // 5. Process and save the installation
    // TODO: Determine how to get supabase_user_id if the installation was initiated by an authenticated user from your app.
    // For now, passing null. This might involve a session middleware or checking `req.user`.
    const savedInstallation = await githubService.processGitHubInstallation(payload, null);
    console.log(`GitHub installation ${savedInstallation.installation_id} processed successfully.`);

    // 6. Redirect user to the frontend
    // You might want to include query params to indicate success or pass installation_id
    const redirectUrl = new URL(FRONTEND_URL || '/'); // Default to root if FRONTEND_URL is not set
    redirectUrl.pathname = '/dashboard'; // Or a specific page like '/settings/integrations'
    redirectUrl.searchParams.set('github_setup', 'success');
    redirectUrl.searchParams.set('installation_id', String(savedInstallation.installation_id));
    
    return res.redirect(redirectUrl.toString());

  } catch (error) {
    console.error('Error handling GitHub setup callback:', error);
    // Pass error to the global error handler in app.ts
    next(error); 
  }
};