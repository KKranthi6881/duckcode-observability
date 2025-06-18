// From our database schema: github_module.github_app_installations
export interface GitHubAppInstallation {
    id?: number; // Optional because it's auto-generated on insert
    installation_id: number; // GitHub's installation ID
    app_id: number; // Your GitHub App's ID
    target_id: number;
    target_type: string; // e.g., "User", "Organization"
    target_login: string;
    target_avatar_url?: string | null;
    repository_selection: string; // e.g., "all", "selected"
    supabase_user_id?: string | null; // UUID of the user in your app
    permissions?: Record<string, string>; // e.g., { contents: "read", metadata: "read" }
    events?: string[]; // e.g., ["push", "pull_request"]
    suspended_at?: string | null; // ISO date string
    created_at?: string; // ISO date string
    updated_at?: string; // ISO date string
  }
  
  // From our database schema: github_module.github_installation_accessible_repos
  export interface GitHubAccessibleRepository {
    id?: number; // Optional because it's auto-generated on insert
    installation_table_id: number; // FK to our github_app_installations.id
    repo_id: number; // GitHub's repository ID
    node_id?: string | null;
    name: string;
    full_name: string; // "owner/repo"
    private: boolean;
    html_url?: string | null;
    description?: string | null;
    default_branch?: string | null;
    created_at?: string; // ISO date string
    updated_at?: string; // ISO date string
  }
  
  // Simplified structure for the GitHub installation event payload (webhook or setup callback)
  // Adjust based on actual payload structure from GitHub
  export interface GitHubInstallationPayload {
    installation: {
      id: number;
      app_id: number;
      target_id: number;
      target_type: string; // "User" or "Organization"
      account: {
        login: string;
        id: number;
        avatar_url?: string;
        [key: string]: any; // Other account details
      };
      repository_selection: string; // "all" or "selected"
      permissions: Record<string, string>;
      events: string[];
      created_at: number | string; // Can be Unix timestamp or ISO string
      updated_at: number | string; // Can be Unix timestamp or ISO string
      suspended_at?: number | string | null;
      [key: string]: any; // Other installation details
    };
    repositories?: Array<{ // Present if repository_selection is "selected"
      id: number;
      node_id: string;
      name: string;
      full_name: string;
      private: boolean;
      html_url: string;
      description: string | null;
      default_branch: string;
    }>;
    setup_action?: string; // e.g., "install", "update" - from the setup redirect
    code?: string; // The temporary code from GitHub if using the web flow for setup
    [key: string]: any; // Other payload details
  }

  export interface GitHubAccountInfo {
    login: string | null;
    avatarUrl: string | null;
    type: string | null;
  }

  export interface GitHubRepositoryInfo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    // Add other fields like default_branch if needed later for CodeBase.tsx
  }

  export interface GitHubConnectionDetails {
    installationId: number;
    account: GitHubAccountInfo;
    repositorySelection: string | null; // 'all' or 'selected'
    accessibleRepos: GitHubRepositoryInfo[];
    totalAccessibleRepoCount: number;
  }

  export interface GitHubConnectionStatusResponse {
    isConnected: boolean;
    details: GitHubConnectionDetails | null;
    error?: string; // Optional error message
  }