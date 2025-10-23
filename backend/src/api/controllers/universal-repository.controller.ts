import { Request, Response, NextFunction } from 'express';
import * as githubService from '../../services/github.service';
import GitLabService from '../../services/gitlab.service';
import { supabaseDuckCode } from '../../config/supabase';
import { decryptGitHubToken } from '../../services/encryptionService';

/**
 * Universal Repository Controller
 * Handles repository operations for both GitHub and GitLab
 */

/**
 * Get repository connection details from database
 */
async function getRepositoryConnection(userId: string, owner: string, repo: string, organizationId?: string) {
  console.log(`[UniversalRepoController] Looking up connection: owner=${owner}, repo=${repo}, org=${organizationId}`);
  
  let query = supabaseDuckCode
    .schema('enterprise')
    .from('github_connections')
    .select('*')
    .eq('repository_owner', owner)
    .eq('repository_name', repo);

  // Filter by organization if provided
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error(`[UniversalRepoController] Database error:`, error);
    throw new Error(`Repository connection not found: ${error.message}`);
  }

  if (!data) {
    throw new Error('Repository connection not found');
  }

  console.log(`[UniversalRepoController] Found connection: id=${data.id}, provider=${data.provider}`);
  return data;
}

/**
 * Get repository tree (file/folder structure)
 * Works for both GitHub and GitLab
 */
export const getRepositoryTree = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { owner, repo } = req.params;
    const { ref, path = '', recursive = 'true' } = req.query as { 
      ref?: string; 
      path?: string;
      recursive?: string;
    };

    if (!owner || !repo) {
      res.status(400).json({ message: 'Owner and repository name are required' });
      return;
    }

    console.log(`[UniversalRepoController] Fetching tree for ${owner}/${repo}, ref: ${ref || 'default'}, path: ${path || 'root'}`);

    // Get repository connection details
    const connection = await getRepositoryConnection(userId, owner, repo, organizationId);
    const provider = connection.provider || 'github';
    const branch = ref || connection.branch || 'main';

    console.log(`[UniversalRepoController] Provider: ${provider}, Branch: ${branch}`);

    if (provider === 'gitlab') {
      // Handle GitLab
      const decryptedToken = decryptGitHubToken(connection.access_token_encrypted);
      const gitlabService = new GitLabService(decryptedToken);
      
      const projectPath = `${owner}/${repo}`;
      // GitLab's recursive=true with large repos only returns directories
      // Use recursive=false to get actual file/folder structure
      const tree = await gitlabService.getRepositoryTree(
        projectPath,
        branch,
        path,
        false // Always use non-recursive for GitLab
      );

      // Transform to GitHub-compatible format for frontend
      const transformedTree = GitLabService.transformToGitHubFormat(tree);
      
      console.log(`[UniversalRepoController] GitLab tree fetched: ${tree.length} items`);
      res.json({ tree: transformedTree });
    } else {
      // Handle GitHub
      const connectionStatus = await githubService.getInstallationConnectionDetails(userId);
      
      if (!connectionStatus.isConnected || !connectionStatus.details) {
        res.status(404).json({ message: 'GitHub connection not found' });
        return;
      }
      
      const app = githubService.getApp();
      const octokit = await app.getInstallationOctokit(connectionStatus.details.installationId);

      const { data } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: recursive === 'true' ? 'true' : undefined,
      });

      console.log(`[UniversalRepoController] GitHub tree fetched: ${data.tree.length} items`);
      res.json(data);
    }
  } catch (error: any) {
    console.error('[UniversalRepoController] Error getting repository tree:', error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      message: error.message || 'Failed to fetch repository tree',
      error: error.response?.data?.message || error.message
    });
  }
};

/**
 * Get repository contents (directory listing)
 * Works for both GitHub and GitLab
 */
export const getRepositoryContents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { owner, repo, path = '' } = req.params;
    const { ref } = req.query as { ref?: string };

    if (!owner || !repo) {
      res.status(400).json({ message: 'Owner and repository name are required' });
      return;
    }

    console.log(`[UniversalRepoController] Fetching contents for ${owner}/${repo}, path: ${path || 'root'}`);

    // Get repository connection details
    const connection = await getRepositoryConnection(userId, owner, repo, organizationId);
    const provider = connection.provider || 'github';
    const branch = ref || connection.branch || 'main';

    if (provider === 'gitlab') {
      // Handle GitLab
      const decryptedToken = decryptGitHubToken(connection.access_token_encrypted);
      const gitlabService = new GitLabService(decryptedToken);
      
      const projectPath = `${owner}/${repo}`;
      const tree = await gitlabService.getRepositoryTree(
        projectPath,
        branch,
        path,
        false // Non-recursive for directory listing
      );

      // Transform to GitHub-compatible format
      const transformedTree = GitLabService.transformToGitHubFormat(tree);
      res.json(transformedTree);
    } else {
      // Handle GitHub
      const connectionStatus = await githubService.getInstallationConnectionDetails(userId);
      
      if (!connectionStatus.isConnected || !connectionStatus.details) {
        res.status(404).json({ message: 'GitHub connection not found' });
        return;
      }
      
      const app = githubService.getApp();
      const octokit = await app.getInstallationOctokit(connectionStatus.details.installationId);

      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      res.json(data);
    }
  } catch (error: any) {
    console.error('[UniversalRepoController] Error getting repository contents:', error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      message: error.message || 'Failed to fetch repository contents',
      error: error.response?.data?.message || error.message
    });
  }
};

/**
 * Get file content
 * Works for both GitHub and GitLab
 */
export const getFileContent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { owner, repo, path } = req.params;
    const { ref } = req.query as { ref?: string };

    if (!owner || !repo || !path) {
      res.status(400).json({ message: 'Owner, repository name, and file path are required' });
      return;
    }

    console.log(`[UniversalRepoController] Fetching file content for ${owner}/${repo}/${path}`);

    // Get repository connection details
    const connection = await getRepositoryConnection(userId, owner, repo, organizationId);
    const provider = connection.provider || 'github';
    const branch = ref || connection.branch || 'main';

    if (provider === 'gitlab') {
      // Handle GitLab
      const decryptedToken = decryptGitHubToken(connection.access_token_encrypted);
      const gitlabService = new GitLabService(decryptedToken);
      
      const projectPath = `${owner}/${repo}`;
      const content = await gitlabService.getFileContent(projectPath, path, branch);

      // Transform to GitHub-compatible format
      const transformedContent = GitLabService.transformFileContentToGitHubFormat(content);
      res.json(transformedContent);
    } else {
      // Handle GitHub
      const connectionStatus = await githubService.getInstallationConnectionDetails(userId);
      
      if (!connectionStatus.isConnected || !connectionStatus.details) {
        res.status(404).json({ message: 'GitHub connection not found' });
        return;
      }
      
      const app = githubService.getApp();
      const octokit = await app.getInstallationOctokit(connectionStatus.details.installationId);

      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      res.json(data);
    }
  } catch (error: any) {
    console.error('[UniversalRepoController] Error getting file content:', error);
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      message: error.message || 'Failed to fetch file content',
      error: error.response?.data?.message || error.message
    });
  }
};
