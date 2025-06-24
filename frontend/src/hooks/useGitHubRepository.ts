import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../features/auth/contexts/AuthContext';
import { 
  getGitHubConnectionStatus, 
  getRepositoryContents,
  getFileContent,
  decodeFileContent,
  getFileSummary,
  type GitHubConnectionStatus,
  type GitHubRepository,
  type GitHubFileItem
} from '../services/githubService';

interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  isExpanded: boolean;
  children: TreeNode[];
  level: number;
}

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  isExpanded?: boolean;
  children?: FileItem[];
  modified?: string;
}

export const useGitHubRepository = () => {
  const { session } = useAuth();

  // GitHub Connection State
  const [gitHubConnectionStatus, setGitHubConnectionStatus] = useState<GitHubConnectionStatus | null>(null);
  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Selected Repository State
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<GitHubRepository | null>(null);
  const [activeBranch, setActiveBranch] = useState('main');

  // File Tree State
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // Selected File State
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [fileContentError, setFileContentError] = useState<string | null>(null);

  // File Summary State
  const [selectedFileSummary, setSelectedFileSummary] = useState<any | null>(null);
  const [isLoadingFileSummary, setIsLoadingFileSummary] = useState(false);
  const [fileSummaryError, setFileSummaryError] = useState<string | null>(null);

  // Fetch GitHub connection status
  const fetchGitHubConnectionStatus = useCallback(async () => {
    if (isLoadingConnection) return;
    
    console.log('[useGitHubRepository] Starting GitHub connection status fetch');
    setIsLoadingConnection(true);
    setConnectionError(null);
    
    try {
      const connectionStatus = await getGitHubConnectionStatus();
      console.log('[useGitHubRepository] GitHub connection status:', connectionStatus);
      setGitHubConnectionStatus(connectionStatus);
    } catch (error: any) {
      console.error('[useGitHubRepository] Error fetching GitHub connection status:', error);
      setConnectionError(error.message || 'Failed to fetch GitHub connection status');
    } finally {
      setIsLoadingConnection(false);
    }
  }, []);

  // Build tree structure recursively
  const buildTreeStructure = async (contents: GitHubFileItem[], owner: string, repoName: string, branch: string, level: number): Promise<TreeNode[]> => {
    const tree: TreeNode[] = [];
    
    for (const item of contents) {
      const node: TreeNode = {
        id: `${item.path}-${item.sha}`,
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'folder' : 'file',
        size: item.size,
        isExpanded: false,
        children: [],
        level
      };
      
      tree.push(node);
    }
    
    return tree;
  };

  // Fetch entire repository tree structure
  const fetchRepositoryTree = useCallback(async (repo: GitHubRepository, branch: string) => {
    if (!session?.access_token) return;

    console.log('[useGitHubRepository] Fetching repository tree for:', repo.full_name, 'branch:', branch);
    setIsLoadingTree(true);
    setTreeError(null);

    try {
      const [owner, repoName] = repo.full_name.split('/');
      const rootContents = await getRepositoryContents(owner, repoName, '', branch);
      console.log('[useGitHubRepository] Root contents:', rootContents);

      const tree = await buildTreeStructure(rootContents, owner, repoName, branch, 0);
      setFileTree(tree);
      console.log('[useGitHubRepository] Built tree structure:', tree);
    } catch (error: any) {
      console.error('[useGitHubRepository] Error fetching repository tree:', error);
      setTreeError(error.message || 'Failed to fetch repository tree');
      setFileTree([]);
    } finally {
      setIsLoadingTree(false);
    }
  }, [session?.access_token]);

  // Toggle folder expansion
  const toggleFolderExpansion = async (nodePath: string) => {
    const findNode = (tree: TreeNode[], targetPath: string): TreeNode | null => {
      for (const node of tree) {
        if (node.path === targetPath) return node;
        if (node.children.length > 0) {
          const found = findNode(node.children, targetPath);
          if (found) return found;
        }
      }
      return null;
    };

    const targetNode = findNode(fileTree, nodePath);
    if (!targetNode || targetNode.type !== 'folder') return;

    if (!targetNode.isExpanded && targetNode.children.length === 0) {
      try {
        const [owner, repoName] = selectedGitHubRepo!.full_name.split('/');
        const contents = await getRepositoryContents(owner, repoName, targetNode.path, activeBranch);
        const children = await buildTreeStructure(contents, owner, repoName, activeBranch, targetNode.level + 1);
        
        setFileTree(prevTree => {
          return updateTreeNode(prevTree, nodePath, (node) => {
            return {
              ...node,
              children,
              isExpanded: true
            };
          });
        });
      } catch (error) {
        console.error('Error loading folder contents:', error);
      }
    } else {
      setFileTree(prevTree => {
        return updateTreeNode(prevTree, nodePath, (node) => {
          return {
            ...node,
            isExpanded: !node.isExpanded
          };
        });
      });
    }
  };

  // Update tree node recursively
  const updateTreeNode = (tree: TreeNode[], targetPath: string, updateFn: (node: TreeNode) => TreeNode): TreeNode[] => {
    return tree.map(node => {
      if (node.path === targetPath) {
        return updateFn({ ...node });
      }
      if (node.children.length > 0) {
        return {
          ...node,
          children: updateTreeNode(node.children, targetPath, updateFn)
        };
      }
      return node;
    });
  };

  // Fetch File Content
  const fetchFileContent = useCallback(async (file: FileItem) => {
    if (!selectedGitHubRepo || !session?.access_token) return;

    console.log('[useGitHubRepository] fetchFileContent called for:', file.path);
    setSelectedFile(file);
    setSelectedFileContent('');
    setIsLoadingFileContent(true);
    setFileContentError(null);

    try {
      const [owner, repoName] = selectedGitHubRepo.full_name.split('/');
      const branchToUse = selectedGitHubRepo.default_branch || activeBranch;
      
      const fileData = await getFileContent(owner, repoName, file.path, branchToUse);
      const decodedContent = decodeFileContent(fileData.content, fileData.encoding);
      setSelectedFileContent(decodedContent);
      console.log(`Successfully fetched content for ${file.path}`);
    } catch (err: any) {
      console.error(`Error fetching file content for ${file.path}:`, err);
      setFileContentError(err.message || 'Failed to fetch file content');
    } finally {
      setIsLoadingFileContent(false);
    }
  }, [selectedGitHubRepo, session, activeBranch]);

  // Fetch file summary for documentation
  const fetchFileSummary = async (owner: string, repo: string, filePath: string) => {
    setIsLoadingFileSummary(true);
    setFileSummaryError(null);
    setSelectedFileSummary(null);

    try {
      console.log(`[useGitHubRepository] Fetching file summary for: ${owner}/${repo}/${filePath}`);
      
      const summary = await getFileSummary(owner, repo, filePath);
      setSelectedFileSummary(summary);
      console.log(`[useGitHubRepository] File summary fetched successfully:`, summary);
    } catch (error: any) {
      console.error(`[useGitHubRepository] Error fetching file summary:`, error);
      
      let errorMessage = 'Failed to fetch file summary';
      if (error.message?.includes('404') || error.message?.includes('not found')) {
        errorMessage = 'This file has not been processed yet or does not exist in the repository. Try processing the repository first.';
      } else if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
        errorMessage = 'You are not authorized to access this file summary.';
      } else if (error.message?.includes('500')) {
        errorMessage = 'Server error while fetching file summary. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setFileSummaryError(errorMessage);
    } finally {
      setIsLoadingFileSummary(false);
    }
  };

  // Handle repository selection
  const handleRepositorySelect = async (repo: any) => {
    console.log('[useGitHubRepository] Repository selected:', repo);
    
    const defaultBranch = repo.default_branch || 'main';
    const fullRepo = {
      ...repo,
      default_branch: defaultBranch,
    } as GitHubRepository;
    
    setSelectedGitHubRepo(fullRepo);
    setSelectedFile(null);
    setSelectedFileContent(null);
    setActiveBranch(defaultBranch);
    
    // Fetch the repository tree structure
    fetchRepositoryTree(fullRepo, defaultBranch);
  };

  // Handle tree item click
  const handleTreeItemClick = (node: TreeNode) => {
    if (node.type === 'folder') {
      toggleFolderExpansion(node.path);
    } else {
      const fileItem: FileItem = {
        id: node.id,
        name: node.name,
        path: node.path,
        type: node.type,
        size: node.size
      };
      
      fetchFileContent(fileItem);
      
      // Fetch file summary for documentation tab
      if (selectedGitHubRepo) {
        const [owner, repo] = selectedGitHubRepo.full_name.split('/');
        fetchFileSummary(owner, repo, fileItem.path);
      }
    }
  };

  // Reset repository data
  const resetRepositoryData = () => {
    setSelectedGitHubRepo(null);
    setFileTree([]);
    setSelectedFile(null);
    setSelectedFileContent(null);
    setSelectedFileSummary(null);
    setActiveBranch('main');
  };

  // Load GitHub status on mount and when session changes
  useEffect(() => {
    if (session) {
      fetchGitHubConnectionStatus();
    } else {
      setGitHubConnectionStatus(null);
      resetRepositoryData();
      setIsLoadingConnection(false);
    }
  }, [session]);

  return {
    // Connection State
    gitHubConnectionStatus,
    isLoadingConnection,
    connectionError,
    
    // Repository State
    selectedGitHubRepo,
    activeBranch,
    
    // Tree State
    fileTree,
    isLoadingTree,
    treeError,
    
    // File State
    selectedFile,
    selectedFileContent,
    isLoadingFileContent,
    fileContentError,
    
    // Summary State
    selectedFileSummary,
    isLoadingFileSummary,
    fileSummaryError,
    
    // Actions
    fetchGitHubConnectionStatus,
    handleRepositorySelect,
    handleTreeItemClick,
    toggleFolderExpansion,
    fetchFileContent,
    fetchFileSummary,
    resetRepositoryData,
    setActiveBranch,
    setSelectedFile
  };
}; 