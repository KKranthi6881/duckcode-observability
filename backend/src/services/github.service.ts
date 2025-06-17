import supabaseAdmin from '@/config/supabaseClient';
import {
  GitHubAppInstallation,
  GitHubAccessibleRepository,
  GitHubInstallationPayload,
} from '@/types/github.types';
import { App } from 'octokit';
import crypto from 'crypto';

const GITHUB_MODULE_SCHEMA = 'github_module';

/**
 * Saves the GitHub App installation details to the database.
 *
 * @param payload - The installation event payload from GitHub.
 * @param supabaseUserId - Optional UUID of the user in your app who initiated the installation.
 * @returns The saved GitHubAppInstallation record from the database.
 * @throws Error if database operation fails.
 */
const saveInstallationDetails = async (
  payload: GitHubInstallationPayload,
  supabaseUserId?: string | null
): Promise<GitHubAppInstallation> => {
  if (!payload) {
    throw new Error('GitHub installation payload is not provided.');
  }

  const { installation, repositories, setup_action } = payload;

  if (!installation) {
    throw new Error('Installation details are not provided in the payload.');
  }

  // 1. Prepare data for github_app_installations table
  const installationData: Omit<GitHubAppInstallation, 'id' | 'created_at' | 'updated_at'> = {
    installation_id: installation.id,
    app_id: installation.app_id,
    target_id: installation.account.id, // or installation.target_id
    target_type: installation.target_type,
    target_login: installation.account.login,
    target_avatar_url: installation.account.avatar_url,
    repository_selection: installation.repository_selection,
    permissions: installation.permissions,
    events: installation.events,
    supabase_user_id: supabaseUserId, // Link to your app's user
    suspended_at: installation.suspended_at ? new Date(installation.suspended_at).toISOString() : null,
  };

  try {
    // Upsert the installation details
    const { data: savedInstallation, error: installationError } = await supabaseAdmin
      .schema(GITHUB_MODULE_SCHEMA) // Explicitly specify schema
      .from('github_app_installations')
      .upsert(installationData, {
        onConflict: 'installation_id',
      })
      .select()
      .single();

    if (installationError) {
      console.error('Error saving GitHub installation:', installationError);
      throw new Error(`Failed to save GitHub installation: ${installationError.message}`);
    }

    console.log(`Successfully saved/updated GitHub App installation ID: ${savedInstallation.installation_id} (DB ID: ${savedInstallation.id})`);

    // 3. If repositories are explicitly listed (selected repositories), process them
    if (installation.repository_selection === 'selected' && repositories && repositories.length > 0) {
      const accessibleReposData: Omit<GitHubAccessibleRepository, 'id' | 'created_at' | 'updated_at'>[] = repositories.map(repo => ({
        installation_table_id: savedInstallation.id, // Link to our DB's installation record
        repo_id: repo.id,
        node_id: repo.node_id,
        name: repo.name,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
        description: repo.description,
        default_branch: repo.default_branch,
      }));

      // For selected repositories, it's common to:
      // a. Delete existing accessible repos for this installation that are no longer in the list.
      // b. Upsert the current list of accessible repos.

      // a. Delete repos not in the new list for this installation
      const currentRepoIds = accessibleReposData.map(r => r.repo_id);
      const { error: deleteError } = await supabaseAdmin
        .schema(GITHUB_MODULE_SCHEMA) // Explicitly specify schema
        .from('github_installation_accessible_repos')
        .delete()
        .eq('installation_table_id', savedInstallation.id)
        .not('repo_id', 'in', currentRepoIds); // Pass the array directly

      if (deleteError) {
        console.warn('Warning: Could not delete old accessible repos:', deleteError);
        // Decide if this is a critical error. For now, we'll just log it.
      }

      // b. Upsert the current list of accessible repositories
      const { error: reposError } = await supabaseAdmin
        .schema(GITHUB_MODULE_SCHEMA) // Explicitly specify schema
        .from('github_installation_accessible_repos')
        .upsert(accessibleReposData, {
          onConflict: 'installation_table_id,repo_id',
        });

      if (reposError) {
        console.error('Error saving accessible GitHub repositories:', reposError);
        // Decide if this is a critical error. For now, we'll just log it but the installation itself was saved.
        // You might want to throw an error or implement retry logic.
      } else {
        console.log(`Successfully saved/updated ${accessibleReposData.length} accessible repositories for installation ID: ${savedInstallation.installation_id}`);
      }
    } else if (installation.repository_selection === 'all') {
      // If selection is "all", we might want to clear out any "selected" entries for this installation
      // as they are no longer relevant.
      const { error: deleteAllSelectedError } = await supabaseAdmin
        .schema(GITHUB_MODULE_SCHEMA) // Explicitly specify schema
        .from('github_installation_accessible_repos')
        .delete()
        .eq('installation_table_id', savedInstallation.id);

      if (deleteAllSelectedError) {
        console.warn('Warning: Could not delete old selected accessible repos after switching to "all":', deleteAllSelectedError);
      } else {
        console.log(`Cleared any "selected" repositories for installation ID ${savedInstallation.installation_id} as it's now set to "all".`);
      }
    }

    return savedInstallation as GitHubAppInstallation;
  } catch (error) {
    console.error('An unexpected error occurred in processGitHubInstallation:', error);
    throw error; // Re-throw the original error to be caught by the controller
  }
};

/**
 * Fetches installation details from GitHub and saves them to the database.
 *
 * @param installationId The ID of the GitHub App installation.
 * @param supabaseUserId The ID of the user to associate with the installation.
 */
export const processInstallationFromId = async (installationId: number, supabaseUserId: string): Promise<void> => {
  console.log(`[Service] Processing installation ID ${installationId} for user ${supabaseUserId}`);
  const app = getApp();

  try {
    const octokit = await app.getInstallationOctokit(installationId);

    // Fetch installation details
    const { data: installationDetails } = await octokit.rest.apps.getInstallation({
      installation_id: installationId,
    });

    // Fetch accessible repositories if selection is "selected"
    let accessibleRepositories: any[] | undefined = undefined;
    if (installationDetails.repository_selection === 'selected') {
      const { data: reposResponse } = await octokit.rest.apps.listReposAccessibleToInstallation();
      accessibleRepositories = reposResponse.repositories;
    }

    const payload: GitHubInstallationPayload = {
      installation: installationDetails as any,
      repositories: accessibleRepositories,
    };

    await saveInstallationDetails(payload, supabaseUserId);
    console.log(`[Service] Successfully saved installation details for ID ${installationId}`);
  } catch (error) {
    console.error(`[Service] Failed to process installation ID ${installationId}:`, error);
    throw new Error(`Could not process GitHub installation ${installationId}.`);
  }
};

/**
 * Creates a temporary state token and associates it with a user ID to secure the GitHub App installation flow.
 * @param userId - The UUID of the Supabase user initiating the installation.
 * @returns The generated state string.
 */
export const createInstallationState = async (userId: string): Promise<string> => {
  if (!userId) {
    throw new Error('User ID is not provided.');
  }

  const state = crypto.randomBytes(24).toString('hex');

  const { error } = await supabaseAdmin
    .schema(GITHUB_MODULE_SCHEMA)
    .from('github_installation_states')
    .insert({
      state: state,
      supabase_user_id: userId,
    });

  if (error) {
    console.error('Error saving GitHub installation state:', error);
    throw new Error('Could not create installation state.');
  }

  console.log(`[Service] Created state ${state} for user ${userId}`);
  return state;
};

/**
 * Finds a state token in the database, returns the associated user ID, and deletes the token.
 *
 * @param state The state token from the GitHub callback.
 * @returns The Supabase user ID string, or null if the state is not found or invalid.
 */
export const findAndConsumeState = async (state: string): Promise<string | null> => {
  if (!state) {
    return null;
  }

  // Find the state token
  const { data: stateData, error: findError } = await supabaseAdmin
    .schema(GITHUB_MODULE_SCHEMA)
    .from('github_installation_states')
    .select('supabase_user_id')
    .eq('state', state)
    .single();

  if (findError || !stateData) {
    if (findError) console.error('[Service] Error finding state:', findError.message);
    return null; // State not found or error occurred
  }

  // State found, now delete it to prevent reuse
  const { error: deleteError } = await supabaseAdmin
    .schema(GITHUB_MODULE_SCHEMA)
    .from('github_installation_states')
    .delete()
    .eq('state', state);

  if (deleteError) {
    // This is a problematic state. The token was valid but couldn't be deleted.
    // For security, we should not proceed.
    console.error('[Service] CRITICAL: Found state token but failed to delete it. Aborting to prevent replay attacks.', deleteError.message);
    return null;
  }

  console.log(`[Service] Successfully consumed state for user ${stateData.supabase_user_id}`);
  return stateData.supabase_user_id;
};

export const getApp = () => {
  const { GITHUB_APP_ID, GITHUB_PRIVATE_KEY } = process.env;
  if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY) {
    throw new Error('GitHub App credentials are not configured.');
  }
  return new App({
    appId: GITHUB_APP_ID,
    // Correctly format the private key by replacing escaped newlines.
    privateKey: GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
};

// TODO: Add other service functions as needed, e.g.:
// - getInstallationAccessToken(installationId: number): Promise<string>
// - getInstalledRepositories(installationId: number): Promise<GitHubAccessibleRepository[]>
// - handleWebhookEvent(payload: any): Promise<void>
