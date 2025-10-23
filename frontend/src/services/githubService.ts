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
  console.log('[GitHubService] Session check:', { 
    hasSession: !!session, 
    hasAccessToken: !!session?.access_token,
    tokenLength: session?.access_token?.length 
  });
  
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

export const processRepositoryForInsights = async (repositoryFullName: string, selectedLanguage?: string): Promise<any> => {
  console.log(`[GitHubService] Requesting to process repository: ${repositoryFullName}${selectedLanguage ? ` with language: ${selectedLanguage}` : ''}`);
  console.log(`[GitHubService] API_BASE_URL: ${API_BASE_URL}`);
  console.log(`[GitHubService] Full URL: ${API_BASE_URL}/api/insights/process-repository`);
  
  try {
    const headers = await getAuthHeaders();
    console.log(`[GitHubService] Request headers:`, Object.keys(headers));
    console.log(`[GitHubService] Request payload:`, { repositoryFullName, selectedLanguage });
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/insights/process-repository`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repositoryFullName, selectedLanguage }),
    });

    console.log(`[GitHubService] Response status: ${response.status} ${response.statusText}`);
    console.log(`[GitHubService] Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[GitHubService] Error response body:`, errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: response.statusText };
      }
      throw new Error(`Failed to start repository processing: ${errorData.message || errorText}`);
    }

    const result = await response.json();
    console.log(`[GitHubService] Success response:`, result);
    return result;
  } catch (error) {
    console.error(`[GitHubService] Error processing repository ${repositoryFullName}:`, error);
    throw error;
  }
};

export const getProcessingStatus = async (repositoryFullName: string): Promise<any> => {
  console.log(`[GitHubService] Getting SEQUENTIAL processing status for: ${repositoryFullName}`);
  
  // First try the NEW sequential status endpoint
  const sequentialUrl = `${API_BASE_URL}/api/sequential/status/${encodeURIComponent(repositoryFullName)}`;
  console.log(`[GitHubService] Sequential API URL: ${sequentialUrl}`);
  
  try {
    const headers = await getAuthHeaders();
    console.log(`[GitHubService] Request headers:`, Object.keys(headers));
    
    const response = await fetchWithTimeout(sequentialUrl, {
      method: 'GET',
      headers,
    });

    console.log(`[GitHubService] Sequential status response: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`[GitHubService] Sequential processing status success:`, data);
      
      // Map sequential status to RepositoryCard expected format
      const mappedData = {
        sequentialJobId: data.jobId,
        sequentialStatus: data.status,
        sequentialCurrentPhase: data.currentPhase,
        sequentialPhases: data.phases,
        isPolling: data.status === 'processing',
        overallProgress: data.progress || 0,
        
        // Enhanced file counts from backend
        totalFiles: data.totalFiles || 0,
        fileCounts: data.fileCounts,
        
        // For backwards compatibility, still provide basic status
        progress: data.progress || 0,
        completed: data.status === 'completed' ? data.totalFiles || 1 : 0,
        pending: data.status === 'processing' ? data.totalFiles || 1 : 0,
        failed: data.status === 'error' ? data.totalFiles || 1 : 0
      };
      
      console.log(`[GitHubService] Mapped sequential status:`, mappedData);
      return mappedData;
    }
    
    // If sequential endpoint doesn't exist or fails, fall back to old endpoint
    console.log(`[GitHubService] Sequential endpoint failed, falling back to old comprehensive endpoint`);
  } catch (error) {
    console.error(`[GitHubService] Error with sequential endpoint, falling back:`, error);
  }
  
  // FALLBACK: Use the old comprehensive lineage endpoint
  const [owner, repo] = repositoryFullName.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repository full name: ${repositoryFullName}`);
  }
  
  const url = `${API_BASE_URL}/api/lineage/phase2c/status/${owner}/${repo}`;
  console.log(`[GitHubService] Fallback API URL: ${url}`);
  
  try {
    const headers = await getAuthHeaders();
    console.log(`[GitHubService] Request headers:`, Object.keys(headers));
    
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    console.log(`[GitHubService] Processing status response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      // If 404, try the legacy endpoint for backward compatibility
      if (response.status === 404) {
        console.log(`[GitHubService] Repository not found in lineage endpoint, trying legacy endpoint`);
        return await getLegacyProcessingStatus(repositoryFullName);
      }
      
      const errorText = await response.text();
      console.error(`[GitHubService] Processing status error response:`, errorText);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: response.statusText };
      }
      throw new Error(`Failed to get processing status: ${errorData.message}`);
    }

    const result = await response.json();
    console.log(`[GitHubService] Comprehensive processing status success:`, result);
    
    // Transform the response to match the expected format for the frontend
    if (result.success && result.data) {
      const data = result.data;
      return {
        // Overall status fields
        totalFiles: data.repository.totalFiles,
        overallCompleted: data.processing.documentation.completed + data.processing.vector.completed + data.processing.lineage.completed,
        overallProgress: Math.round((data.processing.documentation.progress + data.processing.vector.progress + data.processing.lineage.progress) / 3),
        isPolling: false, // Set based on any active processing
        
        // Documentation status
        documentation: {
          completed: data.processing.documentation.completed,
          failed: data.processing.documentation.failed,
          pending: data.processing.documentation.pending,
          progress: data.processing.documentation.progress
        },
        
        // Vector status
        vectors: {
          completed: data.processing.vector.completed,
          failed: data.processing.vector.failed,
          pending: data.processing.vector.pending,
          progress: data.processing.vector.progress
        },
        
        // Lineage status - This is the key addition!
        lineage: {
          completed: data.processing.lineage.completed,
          failed: data.processing.lineage.failed,
          pending: data.processing.lineage.pending,
          progress: data.processing.lineage.progress,
          eligible: data.processing.lineage.eligible
        },
        
        // Additional metadata for detailed status view
        detailedStatus: [], // This would need to be populated from file_details if needed
        
        // Raw data for other uses
        _rawData: data
      };
    }
    
    return result;
  } catch (error) {
    console.error(`[GitHubService] Error getting processing status for ${repositoryFullName}:`, error);
    throw error;
  }
};

// Legacy fallback function for repositories not yet in the new system
const getLegacyProcessingStatus = async (repositoryFullName: string): Promise<any> => {
  const [owner, repo] = repositoryFullName.split('/');
  const url = `${API_BASE_URL}/api/insights/processing-status/${owner}/${repo}`;
  
  try {
    const headers = await getAuthHeaders();
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Legacy endpoint failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`[GitHubService] Legacy processing status:`, result);
    
    // Transform legacy format to new format (no lineage data)
    return {
      totalFiles: result.totalFiles || 0,
      overallCompleted: result.completed || 0,
      overallProgress: result.progress || 0,
      isPolling: result.isPolling || false,
      
      documentation: {
        completed: result.completed || 0,
        failed: result.failed || 0,
        pending: result.pending || 0,
        progress: result.progress || 0
      },
      
      vectors: {
        completed: 0,
        failed: 0,
        pending: 0,
        progress: 0
      },
      
      // No lineage data for legacy repositories
      lineage: null,
      
      _legacy: true
    };
  } catch (error) {
    console.error(`[GitHubService] Legacy endpoint also failed:`, error);
    throw error;
  }
};

export const getFileSummary = async (owner: string, repo: string, filePath: string): Promise<any> => {
  try {
    const headers = await getAuthHeaders();
    // Don't encode the file path since the backend route uses wildcard to capture the full path
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/insights/file-summary/${owner}/${repo}/${filePath}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to get file summary: ${errorData.message}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[GitHubService] Error getting file summary for ${owner}/${repo}/${filePath}:`, error);
    throw error;
  }
};

export const generateRepositorySummaries = async (owner: string, repo: string, selectedLanguage?: string): Promise<any> => {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/github/repos/${owner}/${repo}/generate-summaries`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ selectedLanguage }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate summaries: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[GitHubService] Error generating summaries:', error);
    throw error;
  }
};

// Check if a repository has been summarized/documented
export const getRepositoryDetails = async (owner: string, repo: string): Promise<GitHubRepository> => {
  console.log('[GitHubService] getRepositoryDetails called with:', { owner, repo });
  
  try {
    const headers = await getAuthHeaders();
    
    const url = `${API_BASE_URL}/api/github/repos/${owner}/${repo}`;
    
    console.log('[GitHubService] Making API request to:', url);

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers,
    });

    console.log('[GitHubService] Repository details response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GitHubService] Repository details error response:', errorText);
      throw new Error(`Failed to fetch repository details: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[GitHubService] Repository details data:', data);
    
    return data;
  } catch (error) {
    console.error('[GitHubService] Error in getRepositoryDetails:', error);
    throw error;
  }
};

export const getRepositorySummaryStatus = async (owner: string, repo: string): Promise<{ hasSummaries: boolean; summaryCount: number; lastSummaryDate?: string }> => {
  try {
    const headers = await getAuthHeaders();
    const repositoryFullName = `${owner}/${repo}`;
    
    // Use sequential processing status instead of GitHub-specific endpoint
    // This works for both GitHub and GitLab repos
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/sequential/status/${encodeURIComponent(repositoryFullName)}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      // If 404, repository hasn't been processed yet
      if (response.status === 404) {
        return { hasSummaries: false, summaryCount: 0 };
      }
      throw new Error(`Failed to get summary status: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Convert sequential processing status to summary status format
    const hasSummaries = data.status === 'completed' || data.currentPhase === 'analysis';
    const summaryCount = data.totalFiles || 0;
    
    return { 
      hasSummaries, 
      summaryCount,
      lastSummaryDate: data.completedAt 
    };
  } catch (error) {
    console.error('[GitHubService] Error getting summary status:', error);
    // Return default status on error
    return { hasSummaries: false, summaryCount: 0 };
  }
};

export type {
  GitHubRepository,
  GitHubConnectionStatus,
  GitHubFileItem,
  GitHubFileContent,
  GitHubUser,
};
