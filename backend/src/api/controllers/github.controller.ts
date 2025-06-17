import { Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import * as githubService from '@/services/github.service';
import { GitHubInstallationPayload } from '@/types/github.types';
import dotenv from 'dotenv';

dotenv.config();

const {
  GITHUB_APP_ID,
  GITHUB_PRIVATE_KEY,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  FRONTEND_URL,
} = process.env;

if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.error('Missing GitHub App credentials in .env file');
  // In a real app, you might want to prevent the server from starting or handle this more gracefully.
}
if (!FRONTEND_URL) {
  console.warn('Missing FRONTEND_URL in .env file. Redirects might not work as expected.');
}

export const handleGitHubSetupCallback = async (req: Request, res: Response, next: NextFunction) => {
  const { installation_id, setup_action, code } = req.query;

  if (!installation_id) {
    return res.status(400).send('Missing installation_id query parameter.');
  }

  try {
    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY) {
        throw new Error('GitHub App ID or Private Key is not configured on the server.');
    }

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