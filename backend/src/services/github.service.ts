import supabaseAdmin from '@/config/supabaseClient';
import {
  GitHubAppInstallation,
  GitHubAccessibleRepository,
  GitHubInstallationPayload,
} from '@/types/github.types';

const GITHUB_MODULE_SCHEMA = 'github_module';

/**
 * Processes the GitHub App installation event and saves/updates the installation
 * and accessible repository data in the database.
 *
 * @param payload - The installation event payload from GitHub.
 * @param supabaseUserId - Optional UUID of the user in your app who initiated the installation.
 * @returns The saved GitHubAppInstallation record from the database.
 * @throws Error if database operation fails.
 */
export const processGitHubInstallation = async (
  payload: GitHubInstallationPayload,
  supabaseUserId?: string | null
): Promise<GitHubAppInstallation> => {
  const { installation, repositories, setup_action } = payload;

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

// TODO: Add other service functions as needed, e.g.:
// - getInstallationAccessToken(installationId: number): Promise<string>
// - getInstalledRepositories(installationId: number): Promise<GitHubAccessibleRepository[]>
// - getRepositoryFileTree(installationId: number, owner: string, repo: string, path: string): Promise<any>
// - getFileContent(installationId: number, owner: string, repo: string, path: string): Promise<string>
