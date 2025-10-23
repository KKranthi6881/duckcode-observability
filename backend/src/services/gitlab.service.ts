import axios, { AxiosInstance } from 'axios';

/**
 * GitLab Service
 * Handles interactions with GitLab API for repository operations
 */

export interface GitLabTreeItem {
  id: string;
  name: string;
  type: 'tree' | 'blob';
  path: string;
  mode: string;
}

export interface GitLabFileContent {
  file_name: string;
  file_path: string;
  size: number;
  encoding: string;
  content: string;
  content_sha256: string;
  ref: string;
  blob_id: string;
  commit_id: string;
  last_commit_id: string;
}

export class GitLabService {
  private baseUrl: string;
  private token: string;
  private client: AxiosInstance;

  constructor(token: string, baseUrl: string = 'https://gitlab.com') {
    this.baseUrl = baseUrl;
    this.token = token;
    this.client = axios.create({
      baseURL: `${baseUrl}/api/v4`,
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get repository tree (file/folder structure)
   * @param projectPath - Project path in format "owner/repo"
   * @param ref - Branch or commit ref (default: main)
   * @param path - Specific path within repository
   * @param recursive - Fetch recursively
   */
  async getRepositoryTree(
    projectPath: string,
    ref: string = 'main',
    path: string = '',
    recursive: boolean = true
  ): Promise<GitLabTreeItem[]> {
    try {
      const encodedPath = encodeURIComponent(projectPath);
      const params: any = {
        ref,
        recursive,
        per_page: 100,
      };

      if (path) {
        params.path = path;
      }

      console.log('[GitLabService] Request details:', {
        url: `/projects/${encodedPath}/repository/tree`,
        params,
        tokenPrefix: this.token.substring(0, 10) + '...',
        headers: this.client.defaults.headers
      });

      const response = await this.client.get(
        `/projects/${encodedPath}/repository/tree`,
        { params }
      );

      const allItems = response.data || [];
      console.log('[GitLabService] Success! Received', allItems.length, 'items');
      console.log('[GitLabService] Item type breakdown:', {
        total: allItems.length,
        blobs: allItems.filter((item: GitLabTreeItem) => item.type === 'blob').length,
        trees: allItems.filter((item: GitLabTreeItem) => item.type === 'tree').length
      });
      console.log('[GitLabService] First 5 items:', allItems.slice(0, 5).map((item: GitLabTreeItem) => ({ name: item.name, type: item.type, path: item.path })));
      
      return allItems;
    } catch (error: any) {
      console.error('[GitLabService] Error fetching repository tree:', error.response?.data || error.message);
      
      // Provide helpful error messages for common issues
      if (error.response?.status === 403) {
        const errorData = error.response?.data;
        if (errorData?.error === 'insufficient_scope') {
          throw new Error(
            `GitLab token has insufficient permissions. Required scopes: 'api' or 'read_api'. ` +
            `Current scopes: ${errorData.scope}. Please regenerate your GitLab Personal Access Token with the required scopes.`
          );
        }
        throw new Error(`GitLab API access forbidden. Please check token permissions.`);
      }
      
      if (error.response?.status === 401) {
        throw new Error(`GitLab authentication failed. Please check your access token.`);
      }
      
      if (error.response?.status === 404) {
        throw new Error(`GitLab repository not found: ${error.response?.data?.message || 'Repository may be private or does not exist'}`);
      }
      
      throw new Error(`Failed to fetch GitLab repository tree: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get file content from repository
   * @param projectPath - Project path in format "owner/repo"
   * @param filePath - Path to the file
   * @param ref - Branch or commit ref
   */
  async getFileContent(
    projectPath: string,
    filePath: string,
    ref: string = 'main'
  ): Promise<GitLabFileContent> {
    try {
      const encodedPath = encodeURIComponent(projectPath);
      const encodedFilePath = encodeURIComponent(filePath);

      const response = await this.client.get(
        `/projects/${encodedPath}/repository/files/${encodedFilePath}`,
        {
          params: { ref }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('[GitLabService] Error fetching file content:', error.response?.data || error.message);
      throw new Error(`Failed to fetch GitLab file content: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get repository details
   * @param projectPath - Project path in format "owner/repo"
   */
  async getRepositoryDetails(projectPath: string): Promise<any> {
    try {
      const encodedPath = encodeURIComponent(projectPath);
      const response = await this.client.get(`/projects/${encodedPath}`);
      return response.data;
    } catch (error: any) {
      console.error('[GitLabService] Error fetching repository details:', error.response?.data || error.message);
      throw new Error(`Failed to fetch GitLab repository details: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Transform GitLab tree format to GitHub-compatible format
   * This allows frontend to use the same interface for both providers
   */
  static transformToGitHubFormat(gitlabTree: GitLabTreeItem[]): any[] {
    return gitlabTree.map(item => ({
      name: item.name,
      path: item.path,
      sha: item.id,
      size: 0, // GitLab tree doesn't include size
      type: item.type === 'blob' ? 'blob' : 'tree', // Keep GitHub-compatible types
      download_url: null, // Not available in tree endpoint
    }));
  }

  /**
   * Transform GitLab file content to GitHub-compatible format
   */
  static transformFileContentToGitHubFormat(gitlabContent: GitLabFileContent): any {
    return {
      name: gitlabContent.file_name,
      path: gitlabContent.file_path,
      sha: gitlabContent.blob_id,
      size: gitlabContent.size,
      content: gitlabContent.content,
      encoding: gitlabContent.encoding,
      download_url: null,
      html_url: null,
    };
  }
}

export default GitLabService;
