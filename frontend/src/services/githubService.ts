import { supabase } from '../config/supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// GitHub specific interfaces
interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  git_url: string;
  ssh_url: string;
  clone_url: string;
  svn_url: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  forks_count: number;
  mirror_url: string | null;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: {
    key: string;
    name: string;
    spdx_id: string;
    url: string | null;
    node_id: string;
  } | null;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility: 'public' | 'private' | 'internal';
  default_branch: string;
  permissions?: {
    admin: boolean;
    maintain: boolean;
    push: boolean;
    triage: boolean;
    pull: boolean;
  };
}

interface GitHubConnectionStatus {
  isConnected: boolean;
  details?: {
    installationId: number;
    account: {
      login: string;
      avatarUrl: string;
      type: string;
    };
    repositorySelection: 'all' | 'selected';
    accessibleRepos: {
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      html_url: string;
    }[];
    totalAccessibleRepoCount: number;
  };
  error?: string;
}

interface GitHubFileItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  download_url: string | null;
  html_url?: string;
  git_url?: string;
}

interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  content: string;
  encoding: string;
  download_url: string | null;
  html_url: string;
}

// Cache for connection status to prevent repeated API calls
let connectionStatusCache: any = null;
let connectionStatusCacheTime = 0;
const CACHE_DURATION = 30000; // 30 seconds cache

// Helper function to get authorization headers
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No active session found');
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
};

// Helper function to fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// API Functions
export const getGitHubConnectionStatus = async (): Promise<GitHubConnectionStatus> => {
  // Check cache first
  const now = Date.now();
  if (connectionStatusCache && (now - connectionStatusCacheTime) < CACHE_DURATION) {
    console.log('[GitHubService] Using cached connection status');
    return connectionStatusCache;
  }

  console.log('[GitHubService] Fetching fresh connection status');
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/github/connection-status`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch connection status: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Update cache
    connectionStatusCache = data;
    connectionStatusCacheTime = now;
    
    return data;
  } catch (error) {
    console.error('[GitHubService] Error fetching connection status:', error);
    throw error;
  }
};

export const getRepositoryContents = async (
  owner: string, 
  repo: string, 
  path?: string, 
  ref?: string
): Promise<GitHubFileItem[]> => {
  console.log('[GitHubService] getRepositoryContents called with:', { owner, repo, path, ref });
  
  try {
    const headers = await getAuthHeaders();
    
    let url = `${API_BASE_URL}/api/github/repos/${owner}/${repo}/contents`;
    if (path) {
      url += `/${path}`;
    }
    
    const params = new URLSearchParams();
    if (ref) {
      params.append('ref', ref);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    console.log('[GitHubService] Making API request to:', url);
    console.log('[GitHubService] Request headers:', Object.keys(headers));

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    console.log('[GitHubService] API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GitHubService] API error response:', errorText);
      throw new Error(`Failed to fetch repository contents: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[GitHubService] API response data type:', Array.isArray(data) ? 'array' : typeof data);
    console.log('[GitHubService] API response data length/keys:', Array.isArray(data) ? data.length : Object.keys(data));
    
    // Ensure we always return an array
    if (Array.isArray(data)) {
      console.log('[GitHubService] Returning array of', data.length, 'items');
      return data;
    } else {
      // If it's a single file, wrap it in an array
      console.log('[GitHubService] Single item response, wrapping in array');
      return [data];
    }
  } catch (error) {
    console.error('[GitHubService] Error in getRepositoryContents:', error);
    throw error;
  }
};

export const getFileContent = async (
  owner: string, 
  repo: string, 
  path: string, 
  ref?: string
): Promise<GitHubFileContent> => {
  console.log('[GitHubService] getFileContent called with:', { owner, repo, path, ref });
  
  try {
    const headers = await getAuthHeaders();
    
    let url = `${API_BASE_URL}/api/github/repos/${owner}/${repo}/content`;
    if (path) {
      url += `/${path}`;
    }
    
    const params = new URLSearchParams();
    if (ref) {
      params.append('ref', ref);
    }
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    console.log('[GitHubService] Making file content API request to:', url);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    console.log('[GitHubService] File content API response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GitHubService] File content API error response:', errorText);
      throw new Error(`Failed to fetch file content: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[GitHubService] File content API response - encoding:', data.encoding, 'size:', data.size);
    return data;
  } catch (error) {
    console.error('[GitHubService] Error in getFileContent:', error);
    throw error;
  }
};

// Helper function to decode base64 content
export const decodeFileContent = (content: string, encoding: string): string => {
  if (encoding === 'base64') {
    try {
      return atob(content.replace(/\s/g, ''));
    } catch (error) {
      console.error('Error decoding base64 content:', error);
      return content;
    }
  }
  return content;
};

export type {
  GitHubRepository,
  GitHubConnectionStatus,
  GitHubFileItem,
  GitHubFileContent,
  GitHubUser,
};
