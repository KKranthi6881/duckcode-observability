import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  File, 
  Copy, 
  Code2, 
  BookOpen, 
  GitBranch, 
  Eye, 
  AlertTriangle,
  FolderOpen,
  Search,
  Github,
  Lock,
  Loader2,
  ExternalLink,
  Star,
  GitFork,
  CornerLeftUp,
  Inbox,
  Settings,
  Calendar,
  Users,
  Database,
  TrendingUp,
  Activity,
  BarChart3,
  FileText,
  Zap,
  PanelLeft,
  PanelLeftClose
} from 'lucide-react';
import { useAuth } from '../../features/auth/contexts/AuthContext';
import { 
  getGitHubConnectionStatus, 
  getRepositoryContents,
  getFileContent,
  decodeFileContent,
  processRepositoryForInsights,
  getProcessingStatus, // Import the new service function
  type GitHubConnectionStatus,
  type GitHubRepository,
  type GitHubFileItem
} from '../../services/githubService';

// FileItem interface for UI state
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

const GITHUB_APP_NAME = import.meta.env.VITE_GITHUB_APP_NAME || 'DuckCode-Observability';
const brandColor = "#2AB7A9";

export function CodeBase() {
  const navigate = useNavigate();
  const { session, isLoading: isAuthLoading } = useAuth();

  // GitHub Connection State
  const [gitHubConnectionStatus, setGitHubConnectionStatus] = useState<GitHubConnectionStatus | null>(null);
  const [isLoadingConnection, setIsLoadingConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Selected GitHub Repository and its File Tree State
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<GitHubRepository | null>(null);
  const [currentGitHubPath, setCurrentGitHubPath] = useState<string[]>([]); // Path segments, e.g., ['src', 'components']
  const [repoFiles, setRepoFiles] = useState<FileItem[]>([]); // Flat list of files/dirs for the current path in selected repo
  const [isLoadingRepoFiles, setIsLoadingRepoFiles] = useState(false);
  const [repoFilesError, setRepoFilesError] = useState<string | null>(null);

  // Selected File and its Content State
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [fileContentError, setFileContentError] = useState<string | null>(null);

  // UI State
  const [view, setView] = useState<'repos' | 'browser'>('repos'); // Simplified to repos and browser
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBranch, setActiveBranch] = useState('main');
  const [activeTab, setActiveTab] = useState<'code' | 'documentation' | 'lineage' | 'visual' | 'alerts'>('code');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  // State for repository processing
  const [processingRepos, setProcessingRepos] = useState<string[]>([]);
  const [queuedRepos, setQueuedRepos] = useState<string[]>([]);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // New state for detailed status
  interface RepoStatus {
    progress: number;
    totalFiles: number;
    completed: number;
    failed: number;
    pending: number;
    detailedStatus: {
      filePath: string;
      status: 'completed' | 'pending' | 'failed';
      errorMessage: string | null;
      startedAt?: string;
      completedAt?: string;
      duration?: number; // in milliseconds
    }[];
    isProcessing: boolean;
    repositoryFullName: string;
    startedAt?: string; // ISO timestamp when processing started
    estimatedCompletion?: string; // Estimated completion time
    averageFileProcessingTime?: number; // Average time per file in ms
  }
  const [reposStatus, setReposStatus] = useState<Record<string, RepoStatus>>({});
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedRepoForStatusModal, setSelectedRepoForStatusModal] = useState<GitHubRepository | null>(null);

  // Fetch GitHub connection status
  const fetchGitHubConnectionStatus = useCallback(async () => {
    if (isLoadingConnection) return; // Prevent multiple simultaneous calls
    
    console.log('[CodeBase] Starting GitHub connection status fetch');
    setIsLoadingConnection(true);
    setConnectionError(null);
    
    try {
      const connectionStatus = await getGitHubConnectionStatus();
      console.log('[CodeBase] GitHub connection status:', connectionStatus);
      setGitHubConnectionStatus(connectionStatus);
    } catch (error: any) {
      console.error('[CodeBase] Error fetching GitHub connection status:', error);
      setConnectionError(error.message || 'Failed to fetch GitHub connection status');
    } finally {
      setIsLoadingConnection(false);
    }
  }, []); // Remove isLoadingConnection dependency to prevent infinite loop

  // Load GitHub status on mount and when session changes
  useEffect(() => {
    if (session) {
      fetchGitHubConnectionStatus();
    } else {
      // Clear GitHub data when no session
      setGitHubConnectionStatus(null);
      setSelectedGitHubRepo(null);
      setRepoFiles([]);
      setSelectedFile(null);
      setIsLoadingConnection(false);
    }
  }, [session]); // Remove fetchGitHubConnectionStatus dependency to prevent infinite loop

  // Initialize processing status on page load/refresh
  useEffect(() => {
    const initializeProcessingStatus = async () => {
      if (!gitHubConnectionStatus?.isConnected || !gitHubConnectionStatus.details?.accessibleRepos) {
        return;
      }

      console.log('[CodeBase] Initializing processing status for accessible repos...');
      
      // Check processing status for all accessible repositories
      const reposToCheck = gitHubConnectionStatus.details.accessibleRepos;
      const activeProcessingRepos: string[] = [];
      const statusUpdates: { [key: string]: RepoStatus } = {};

      for (const repo of reposToCheck) {
        try {
          const [owner, repoName] = repo.full_name.split('/');
          const status = await getProcessingStatus(owner, repoName);
          
          // If there's active processing (progress < 100), add to queued repos
          if (status && status.progress < 100 && status.progress > 0) {
            console.log(`[CodeBase] Found active processing for ${repo.full_name}:`, status);
            activeProcessingRepos.push(repo.full_name);
            statusUpdates[repo.full_name] = status;
          }
        } catch (error) {
          // Ignore errors for repos that haven't been processed yet
          console.log(`[CodeBase] No processing status found for ${repo.full_name}`);
        }
      }

      // Update state with found active processing
      if (activeProcessingRepos.length > 0) {
        console.log(`[CodeBase] Restoring ${activeProcessingRepos.length} active processing jobs:`, activeProcessingRepos);
        setQueuedRepos(activeProcessingRepos);
        setReposStatus(statusUpdates);
      }
    };

    initializeProcessingStatus();
  }, [gitHubConnectionStatus]); // Run when GitHub connection status is loaded

  // Fetch GitHub Repository File Tree
  const fetchGitHubRepoTree = useCallback(async (repo: GitHubRepository, path: string, branch: string) => {
    console.log(`Fetching tree for ${repo.full_name}, path: '${path}', branch: ${branch}`);
    setIsLoadingRepoFiles(true);
    setRepoFilesError(null);
    
    try {
      const [owner, repoName] = repo.full_name.split('/');
      const contents = await getRepositoryContents(owner, repoName, path, branch);
      
      // Convert to FileItem format
      const fileItems: FileItem[] = contents.map(item => ({
        id: item.sha,
        name: item.name,
        path: item.path,
        type: item.type === 'dir' ? 'folder' : 'file',
        size: item.size,
        modified: '', // GitHub API doesn't provide this in contents endpoint
      }));
      
      setRepoFiles(fileItems);
      setCurrentGitHubPath(path.split('/').filter(Boolean));
      console.log(`Successfully fetched ${fileItems.length} items for path: ${path}`);
    } catch (error: any) {
      console.error(`Error fetching repo tree for ${repo.full_name}:`, error);
      
      // Handle different types of errors
      if (error.message?.includes('Not Found') || error.message?.includes('404')) {
        const folderName = path.split('/').pop() || 'root';
        setRepoFilesError(`Folder "${folderName}" not found or is empty`);
      } else if (error.message?.includes('rate limit')) {
        setRepoFilesError('GitHub API rate limit exceeded. Please try again later.');
      } else {
        setRepoFilesError(error.message || 'Failed to fetch repository contents');
      }
      
      setRepoFiles([]);
    } finally {
      setIsLoadingRepoFiles(false);
    }
  }, []);

  // Fetch File Content
  const fetchFileContent = useCallback(async (file: FileItem) => {
    if (!selectedGitHubRepo || !session?.access_token) return;

    console.log('[CodeBase] fetchFileContent called for:', file.path);
    console.log('[CodeBase] Using activeBranch:', activeBranch);
    console.log('[CodeBase] Using repo default_branch:', selectedGitHubRepo.default_branch);

    setSelectedFile(file);
    setSelectedFileContent('');
    setIsLoadingFileContent(true);
    setFileContentError(null);

    try {
      const [owner, repoName] = selectedGitHubRepo.full_name.split('/');
      
      // Use the repo's default branch like we do for folders
      const branchToUse = selectedGitHubRepo.default_branch || activeBranch;
      console.log('[CodeBase] Final branch to use for file content:', branchToUse);
      
      const fileData = await getFileContent(owner, repoName, file.path, branchToUse);
      
      // Decode the file content if it's base64 encoded
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

  // Fetch entire repository tree structure
  const fetchRepositoryTree = useCallback(async (repo: GitHubRepository, branch: string) => {
    if (!session?.access_token) return;

    console.log('[CodeBase] Fetching repository tree for:', repo.full_name, 'branch:', branch);
    setIsLoadingTree(true);
    setTreeError(null);

    try {
      // Split fullName into owner and repo
      const [owner, repoName] = repo.full_name.split('/');
      
      // First get the root directory contents
      const rootContents = await getRepositoryContents(owner, repoName, '', branch);
      console.log('[CodeBase] Root contents:', rootContents);

      // Build the tree structure
      const tree = await buildTreeStructure(rootContents, owner, repoName, branch, 0);
      setFileTree(tree);
      console.log('[CodeBase] Built tree structure:', tree);
    } catch (error: any) {
      console.error('[CodeBase] Error fetching repository tree:', error);
      setTreeError(error.message || 'Failed to fetch repository tree');
      setFileTree([]);
    } finally {
      setIsLoadingTree(false);
    }
  }, [session?.access_token]);

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
      
      // For folders, we'll load children on demand when expanded
      tree.push(node);
    }
    
    return tree;
  };

  // Toggle folder expansion
  const toggleFolderExpansion = async (nodePath: string) => {
    // First, find the node to check if we need to load children
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

    // If expanding and no children loaded, load them first
    if (!targetNode.isExpanded && targetNode.children.length === 0) {
      try {
        const [owner, repoName] = selectedGitHubRepo!.full_name.split('/');
        const contents = await getRepositoryContents(owner, repoName, targetNode.path, activeBranch);
        const children = await buildTreeStructure(contents, owner, repoName, activeBranch, targetNode.level + 1);
        
        // Update the tree with both children and expansion state
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
      // Just toggle expansion state
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

  // Flatten tree for rendering with proper indentation
  const flattenTree = (tree: TreeNode[]): TreeNode[] => {
    const flattened: TreeNode[] = [];
    
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        flattened.push(node);
        if (node.isExpanded && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    
    traverse(tree);
    return flattened;
  };

  // Filter tree based on search query
  const getFilteredTree = (): TreeNode[] => {
    if (!searchQuery) return flattenTree(fileTree);
    
    const filtered: TreeNode[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          filtered.push(node);
        }
        if (node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    
    traverse(fileTree);
    return filtered;
  };

  // Handle GitHub Connection
  const handleConnectGitHub = () => {
    navigate('/dashboard/settings?tab=github');
  };

  // Event Handlers
  const handleGitHubRepoClick = async (repo: any) => {
    console.log('[CodeBase] Repository clicked:', repo);
    
    const defaultBranch = repo.default_branch || 'main';
    console.log('[CodeBase] Using default branch:', defaultBranch);
    
    const fullRepo: GitHubRepository = {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      html_url: repo.html_url,
      description: null,
      created_at: '',
      updated_at: '',
      pushed_at: '',
      clone_url: '',
      ssh_url: '',
      stargazers_count: repo.stargazers_count || 0,
      watchers_count: 0,
      forks_count: repo.forks_count || 0,
      language: null,
      languages_url: '',
      default_branch: defaultBranch,
      topics: [],
      permissions: {
        admin: false,
        maintain: false,
        push: false,
        triage: false,
        pull: true
      }
    };
    
    setSelectedGitHubRepo(fullRepo);
    setSelectedFile(null);
    setSelectedFileContent(null);
    setView('browser');
    setActiveBranch(defaultBranch);
    
    // Fetch the tree structure
    fetchRepositoryTree(fullRepo, defaultBranch);
  };

  const handleTreeItemClick = (node: TreeNode) => {
    if (node.type === 'folder') {
      toggleFolderExpansion(node.path);
    } else {
      // File clicked - convert to FileItem for compatibility
      const fileItem: FileItem = {
        id: node.id,
        name: node.name,
        path: node.path,
        type: node.type,
        size: node.size
      };
      setSelectedFile(fileItem);
      setActiveTab('code');
      fetchFileContent(fileItem);
    }
  };

  const handleGitHubFileItemClick = (item: FileItem) => {
    console.log('[CodeBase] File item clicked:', item);
    console.log('[CodeBase] Item type:', item.type, 'Item path:', item.path);
    console.log('[CodeBase] Current activeBranch:', activeBranch);
    console.log('[CodeBase] Current selectedGitHubRepo:', selectedGitHubRepo?.full_name);
    console.log('[CodeBase] Current path segments:', currentGitHubPath);
    
    if (item.type === 'folder') {
      console.log('[CodeBase] Navigating to folder:', item.path, 'with branch:', activeBranch);
      console.log('[CodeBase] selectedGitHubRepo default_branch:', selectedGitHubRepo?.default_branch);
      
      // Use the repo's default branch instead of activeBranch as a safety check
      const branchToUse = selectedGitHubRepo?.default_branch || activeBranch;
      console.log('[CodeBase] Final branch to use:', branchToUse);
      
      fetchGitHubRepoTree(selectedGitHubRepo!, item.path, branchToUse);
      setView('files');
    } else {
      console.log('[CodeBase] Opening file:', item.path);
      setSelectedFile(item);
      setView('code');
      setActiveTab('code'); // Default to code tab
      fetchFileContent(item);
    }
  };

  const navigateToGitHubPath = (pathIndex: number) => {
    if (!selectedGitHubRepo) return;
    const newPathArray = currentGitHubPath.slice(0, pathIndex + 1);
    const newPathString = newPathArray.join('/');
    fetchGitHubRepoTree(selectedGitHubRepo, newPathString, activeBranch);
  };

  const goToParentGitHubDirectory = () => {
    if (!selectedGitHubRepo || currentGitHubPath.length === 0) return;
    const newPathArray = currentGitHubPath.slice(0, -1);
    const newPathString = newPathArray.join('/');
    fetchGitHubRepoTree(selectedGitHubRepo, newPathString, activeBranch);
  };

  // Helper Functions
  const getCurrentDirectoryContents = (): FileItem[] => {
    // In this flat list model, repoFiles already represents the current directory's content.
    // Filtering by searchQuery if needed.
    if (!searchQuery) return repoFiles;
    return repoFiles.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };
  
  const getFileIcon = (fileName: string | undefined, itemType: 'file' | 'folder') => {
    if (itemType === 'folder') return <Folder className="h-4 w-4 mr-2 text-yellow-500 flex-shrink-0" />;
    
    // Handle undefined/null fileName
    if (!fileName) return <File className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />;
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch(extension) {
      case 'sql': return <Code2 className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />;
      case 'json': return <File className="h-4 w-4 mr-2 text-purple-500 flex-shrink-0" />;
      case 'ts': case 'tsx': case 'js': case 'jsx': return <Code2 className="h-4 w-4 mr-2 text-sky-500 flex-shrink-0" />;
      case 'py': return <Code2 className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />;
      case 'md': return <BookOpen className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0" />;
      case 'sh': case 'bash': return <File className="h-4 w-4 mr-2 text-red-500 flex-shrink-0" />;
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return <File className="h-4 w-4 mr-2 text-indigo-500 flex-shrink-0" />;
      case 'zip': case 'tar': case 'gz': return <File className="h-4 w-4 mr-2 text-orange-500 flex-shrink-0" />;
      default: return <File className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />;
    }
  };

  const getLanguageBadge = (language: string | null | undefined, color?: string) => {
    if (!language) return null;
    // Basic color mapping, can be expanded
    const langColor = color || (language.toLowerCase() === 'typescript' ? 'bg-blue-100 text-blue-700' : 
                                language.toLowerCase() === 'javascript' ? 'bg-yellow-100 text-yellow-700' :
                                language.toLowerCase() === 'python' ? 'bg-green-100 text-green-700' :
                                'bg-gray-100 text-gray-700');
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${langColor}`}>
        {language}
      </span>
    );
  };

  const getLanguageColors = (fileExtension?: string) => {
    switch (fileExtension) {
      case 'sql':
        return {
          keywords: 'text-blue-400 font-semibold',        // SELECT, FROM, WHERE
          functions: 'text-purple-400 font-medium',       // COUNT, SUM, AVG
          operators: 'text-red-400 font-medium',          // =, >, <, AND, OR
          strings: 'text-green-300',                      // 'quoted strings'
          numbers: 'text-orange-400 font-medium',         // 123, 45.67
          comments: 'text-gray-500 italic',               // -- comments
          identifiers: 'text-cyan-300',                   // table.column names
          types: 'text-yellow-400 font-medium'            // INT, VARCHAR, etc.
        };
      case 'py':
      case 'ipynb':
        return {
          keywords: 'text-blue-400 font-semibold',        // def, class, if, etc.
          functions: 'text-yellow-300 font-medium',       // function names
          strings: 'text-green-300',                      // "strings"
          numbers: 'text-orange-400 font-medium',         // 123
          comments: 'text-gray-500 italic',               // # comments
          decorators: 'text-pink-400 font-medium',        // @decorator
          booleans: 'text-purple-400 font-medium',        // True, False, None
          operators: 'text-red-400'                       // +, -, *, /
        };
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return {
          keywords: 'text-blue-400 font-semibold',        // function, const, let
          functions: 'text-yellow-300 font-medium',       // function names
          strings: 'text-green-300',                      // "strings"
          numbers: 'text-orange-400 font-medium',         // 123
          comments: 'text-gray-500 italic',               // // comments
          booleans: 'text-purple-400 font-medium',        // true, false, null
          operators: 'text-red-400',                      // +, -, *, /
          types: 'text-cyan-400 font-medium'              // TypeScript types
        };
      case 'json':
        return {
          keys: 'text-blue-300 font-medium',              // "key":
          strings: 'text-green-300',                      // "value"
          numbers: 'text-orange-400 font-medium',         // 123
          booleans: 'text-purple-400 font-medium',        // true, false, null
          comments: 'text-gray-500 italic'
        };
      default:
        return {
          keywords: 'text-blue-400 font-semibold',
          strings: 'text-green-300',
          comments: 'text-gray-500 italic',
          numbers: 'text-orange-400 font-medium',
          operators: 'text-red-400',
          functions: 'text-yellow-300 font-medium',
          identifiers: 'text-cyan-300'
        };
    }
  };

  const formatCodeWithSyntaxHighlighting = (code: string, fileName?: string) => {
    const lines = code.split('\n');
    const fileExtension = fileName?.split('.').pop()?.toLowerCase();
    const colors = getLanguageColors(fileExtension);
    
    const highlightSyntax = (line: string, lineNumber: number) => {
      if (line.trim() === '') {
        return <span>&nbsp;</span>;
      }

      // Handle different comment types - return styled JSX directly
      if (line.trim().startsWith('--') || line.trim().startsWith('#') || line.trim().startsWith('//')) {
        return <span className={colors.comments}>{line}</span>;
      }
      
      // Handle block comments
      if (line.includes('/*') || line.includes('*/') || line.includes('"""') || line.includes("'''")) {
        return <span className={colors.comments}>{line}</span>;
      }

      // Enhanced tokenization with better operator handling
      const tokens = line.split(/(\s+|[().,;=<>!+\-*/%]|['"``].*?['"``])/);
      
      return (
        <span>
          {tokens.map((token, index) => {
            if (!token.trim()) {
              return <span key={index}>{token}</span>;
            }

            // SQL Highlighting
            if (fileExtension === 'sql') {
              // SQL Keywords (blue)
              const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'ON', 'GROUP', 'ORDER', 'BY', 'HAVING', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'DISTINCT', 'TOP', 'LIMIT', 'OFFSET', 'FETCH', 'FIRST', 'WITH', 'RECURSIVE', 'CTE'];
              if (sqlKeywords.includes(token.toUpperCase())) {
                return <span key={index} className={colors.keywords}>{token}</span>;
              }
              
              // SQL Functions (purple)
              const sqlFunctions = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'SQRT', 'POWER', 'LEN', 'LENGTH', 'SUBSTRING', 'SUBSTR', 'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'CONCAT', 'COALESCE', 'ISNULL', 'NULLIF', 'CAST', 'CONVERT', 'DATEPART', 'DATEDIFF', 'GETDATE', 'NOW', 'CURRENT_TIMESTAMP', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'FIRST_VALUE', 'LAST_VALUE'];
              if (sqlFunctions.includes(token.toUpperCase())) {
                return <span key={index} className={colors.functions}>{token}</span>;
              }
              
              // SQL Operators (red)
              const sqlOperators = ['=', '>', '<', '>=', '<=', '!=', '<>', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', '+', '-', '*', '/', '%'];
              if (sqlOperators.includes(token.toUpperCase()) || ['=', '>', '<', '>=', '<=', '!=', '<>', '+', '-', '*', '/', '%'].includes(token)) {
                return <span key={index} className={colors.operators}>{token}</span>;
              }
              
              // SQL Data Types (yellow)
              const sqlTypes = ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'VARCHAR', 'CHAR', 'TEXT', 'NVARCHAR', 'NCHAR', 'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'TIMESTAMP', 'BOOLEAN', 'BIT', 'BINARY', 'VARBINARY', 'UUID', 'UNIQUEIDENTIFIER'];
              if (sqlTypes.includes(token.toUpperCase())) {
                return <span key={index} className={colors.types}>{token}</span>;
              }
              
              // SQL Identifiers (table.column format) (cyan)
              if (token.includes('.') && !token.startsWith('.') && !token.endsWith('.')) {
                return <span key={index} className={colors.identifiers}>{token}</span>;
              }
            }
            
            // Python Highlighting
            else if (fileExtension === 'py' || fileExtension === 'ipynb') {
              // Python Keywords (blue)
              const pythonKeywords = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'import', 'from', 'return', 'yield', 'break', 'continue', 'pass', 'raise', 'assert', 'global', 'nonlocal', 'lambda', 'async', 'await'];
              if (pythonKeywords.includes(token)) {
                return <span key={index} className={colors.keywords}>{token}</span>;
              }
              
              // Python Booleans/None (purple)
              const pythonBooleans = ['True', 'False', 'None'];
              if (pythonBooleans.includes(token)) {
                return <span key={index} className={colors.booleans}>{token}</span>;
              }
              
              // Python Decorators (pink)
              if (token.startsWith('@')) {
                return <span key={index} className={colors.decorators}>{token}</span>;
              }
              
              // Python Operators (red)
              const pythonOperators = ['+', '-', '*', '/', '//', '%', '**', '=', '==', '!=', '<', '>', '<=', '>=', 'and', 'or', 'not', 'in', 'is'];
              if (pythonOperators.includes(token)) {
                return <span key={index} className={colors.operators}>{token}</span>;
              }
            }
            
            // JavaScript/TypeScript Highlighting
            else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExtension || '')) {
              // JS/TS Keywords (blue)
              const jsKeywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'typeof', 'instanceof', 'class', 'extends', 'import', 'export', 'from', 'as', 'async', 'await', 'Promise'];
              if (jsKeywords.includes(token)) {
                return <span key={index} className={colors.keywords}>{token}</span>;
              }
              
              // JS/TS Booleans (purple)
              const jsBooleans = ['true', 'false', 'null', 'undefined'];
              if (jsBooleans.includes(token)) {
                return <span key={index} className={colors.booleans}>{token}</span>;
              }
              
              // JS/TS Types (cyan) - TypeScript specific
              const jsTypes = ['string', 'number', 'boolean', 'object', 'array', 'void', 'any', 'unknown', 'never', 'interface', 'type', 'enum'];
              if (jsTypes.includes(token) && (fileExtension === 'ts' || fileExtension === 'tsx')) {
                return <span key={index} className={colors.types}>{token}</span>;
              }
              
              // JS/TS Operators (red)
              const jsOperators = ['+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '!', '&', '|', '^', '<<', '>>', '>>>', '+=', '-=', '*=', '/=', '%='];
              if (jsOperators.includes(token)) {
                return <span key={index} className={colors.operators}>{token}</span>;
              }
            }

            // JSON Highlighting
            else if (fileExtension === 'json') {
              // JSON Keys (blue) - quoted strings followed by colon
              if (token.match(/^".*":$/)) {
                return <span key={index} className={colors.keys}>{token}</span>;
              }
              
              // JSON Booleans (purple)
              if (['true', 'false', 'null'].includes(token)) {
                return <span key={index} className={colors.booleans}>{token}</span>;
              }
            }

            // Universal patterns for all languages
            
            // Strings (green) - enhanced detection
            if ((token.startsWith('"') && token.endsWith('"')) || 
                (token.startsWith("'") && token.endsWith("'")) || 
                (token.startsWith('`') && token.endsWith('`'))) {
              return <span key={index} className={colors.strings}>{token}</span>;
            }

            // Numbers (orange) - enhanced detection
            if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(token)) {
              return <span key={index} className={colors.numbers}>{token}</span>;
            }

            // Function calls (yellow) - words followed by parentheses
            if (colors.functions && /^[a-zA-Z_][a-zA-Z0-9_]*(?=\()/.test(token)) {
              return <span key={index} className={colors.functions}>{token}</span>;
            }

            // Default: return token as-is
            return <span key={index}>{token}</span>;
          })}
        </span>
      );
    };

    return (
      <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-sm text-gray-400 ml-4">{fileName || 'code'}</span>
          </div>
          <div className="text-xs text-gray-500">
            {fileExtension?.toUpperCase() || 'TEXT'}
          </div>
        </div>
        <pre className="text-xs font-mono leading-normal">
          {lines.map((line, index) => (
            <div key={index} className="flex hover:bg-gray-800/30 transition-colors">
              <span className="text-right pr-3 py-1 text-gray-400 select-none w-10 bg-gray-800/20 border-r border-gray-600 flex-shrink-0 text-xs font-medium">
                {index + 1}
              </span>
              <span className="flex-1 px-3 py-0.5 whitespace-pre-wrap">
                {line.trim() === '' ? ' ' : highlightSyntax(line, index + 1)}
              </span>
            </div>
          ))}
        </pre>
      </div>
    );
  };

  // Polling for status updates
  useEffect(() => {
    const reposToPoll = queuedRepos.filter(
      (repoName) => reposStatus[repoName]?.progress < 100
    );

    if (reposToPoll.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      reposToPoll.forEach(async (repoFullName) => {
        try {
          const [owner, repo] = repoFullName.split('/');
          const status = await getProcessingStatus(owner, repo);
          setReposStatus((prevStatus) => ({
            ...prevStatus,
            [repoFullName]: status,
          }));
        } catch (error) {
          console.error(`[CodeBase] Failed to poll status for ${repoFullName}:`, error);
        }
      });
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [queuedRepos, reposStatus]);

  // Main Render Logic
  console.log('[CodeBase] Render - isLoadingConnection:', isLoadingConnection, 'gitHubConnectionStatus:', gitHubConnectionStatus);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Maybe show a small notification "Copied!"
      console.log("Copied to clipboard");
    }).catch(err => {
      console.error("Failed to copy: ", err);
    });
  };

  // Mock data/renderers for other tabs - these can be expanded later
  const getMockDocumentation = (filePath: string) => `<h3>Documentation for ${filePath}</h3><p>This is placeholder documentation. Real documentation could be fetched or generated based on the file type or comments within the code.</p>`;
  const renderLineage = (filePath: string) => <div>Lineage data for {filePath} would be displayed here. (Not Implemented)</div>;

  const handleProcessRepo = async (repoFullName: string) => {
    setProcessingError(null);
    setProcessingRepos(prev => [...prev, repoFullName]);

    try {
      console.log(`[CodeBase] Starting processing for repository: ${repoFullName}`);
      await processRepositoryForInsights(repoFullName);
      
      // Add to queued list for polling
      setQueuedRepos(prev => [...prev, repoFullName]);
      
      // Initialize status to show progress bar immediately
      setReposStatus(prev => ({
        ...prev,
        [repoFullName]: {
          progress: 0,
          totalFiles: 0, // Will be updated by the first poll
          completed: 0,
          failed: 0,
          pending: 0, // Will be updated
          detailedStatus: [],
          isProcessing: true,
          repositoryFullName: repoFullName
        }
      }));

      // Start polling immediately for this repository
      const [owner, repo] = repoFullName.split('/');
      try {
        const initialStatus = await getProcessingStatus(owner, repo);
        setReposStatus(prev => ({
          ...prev,
          [repoFullName]: {
            ...initialStatus,
            isProcessing: initialStatus.progress < 100
          }
        }));
        console.log(`[CodeBase] Initial status for ${repoFullName}:`, initialStatus);
      } catch (statusError) {
        console.warn(`[CodeBase] Could not get initial status for ${repoFullName}, will retry with polling:`, statusError);
      }

    } catch (error: any) {
      console.error(`[CodeBase] Error processing repository ${repoFullName}:`, error);
      setProcessingError(`Failed to process ${repoFullName}: ${error.message}`);
      
      // Remove from queued repos if processing failed to start
      setQueuedRepos(prev => prev.filter(r => r !== repoFullName));
      setReposStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[repoFullName];
        return newStatus;
      });
    } finally {
      // Remove from processing list regardless of outcome
      setProcessingRepos(prev => prev.filter(r => r !== repoFullName));
    }
  };

  if (isLoadingConnection) {
    return (
      <div className="flex items-center justify-center h-screen p-6">
        <Loader2 className="h-12 w-12 animate-spin text-gray-500" />
        <p className="ml-4 text-xl text-gray-600">Loading GitHub Connection...</p>
      </div>
    );
  }

  if (connectionError && (!gitHubConnectionStatus || !gitHubConnectionStatus.isConnected)) {
    return (
      <div className="p-6 max-w-2xl mx-auto mt-10 font-sans">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-md shadow-md">
          <div className="flex items-start">
            <AlertTriangle className="h-8 w-8 text-red-700 mr-4 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-semibold text-red-800">GitHub Connection Error</h3>
              <p className="text-red-700 mt-2">{connectionError}</p>
              <p className="text-red-600 mt-3 text-sm">
                Please ensure your GitHub account is connected via the <strong>{GITHUB_APP_NAME}</strong> GitHub App and that it has the necessary permissions to access your repositories.
              </p>
              <button
                onClick={() => navigate('/dashboard/settings?tab=github')}
                className="mt-6 px-5 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-150 text-sm font-medium flex items-center shadow-sm hover:shadow-md"
              >
                <Settings className="h-4 w-4 mr-2" />
                Go to GitHub Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!gitHubConnectionStatus?.isConnected) {
     return (
      <div className="p-6 max-w-2xl mx-auto mt-10 font-sans">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-md shadow-md">
          <div className="flex items-start">
            <AlertTriangle className="h-8 w-8 text-yellow-700 mr-4 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-semibold text-yellow-800">GitHub Not Connected</h3>
              <p className="text-yellow-700 mt-2 text-base">
                To browse your repositories and their code, please connect your GitHub account.
              </p>
              <button
                onClick={() => navigate('/dashboard/settings?tab=integrations')}
                className="mt-6 px-5 py-2.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors duration-150 text-sm font-medium flex items-center shadow-sm hover:shadow-md"
              >
                <Github className="h-4 w-4 mr-2" />
                Connect to GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connected State
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Database className="h-6 w-6 text-[#2AB7A9]" />
                <h1 className="text-xl font-bold text-gray-900">Code Repository</h1>
              </div>
              
              {/* Breadcrumb Navigation */}
              {selectedGitHubRepo && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <ChevronRight className="h-4 w-4" />
                  <button 
                    onClick={() => setView('repos')}
                    className="hover:underline font-medium text-gray-700 whitespace-nowrap truncate"
                  >
                    Repositories
                  </button>
                  {view !== 'repos' && (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <button 
                        onClick={() => setView('files')}
                        className="hover:underline font-medium text-gray-700 whitespace-nowrap truncate"
                      >
                        {selectedGitHubRepo.name}
                      </button>
                    </>
                  )}
                  {selectedFile && view === 'code' && (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <span className="text-gray-700 font-medium">{selectedFile.name}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Search and Actions */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search repositories, files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:ring-[#2AB7A9] focus:border-transparent"
                />
              </div>
              
              {view === 'browser' && (
                <button
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  {isSidebarCollapsed ? <PanelLeft className="h-4 w-4 mr-2" /> : <PanelLeftClose className="h-4 w-4 mr-2" />}
                  {isSidebarCollapsed ? 'Show' : 'Hide'} Files
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isAuthLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        ) : !session ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto text-orange-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Authentication Required</h3>
            <p className="text-gray-600 mt-2">Please log in to access your repositories.</p>
            <button
              onClick={() => navigate('/auth/signin')}
              className="mt-4 inline-flex items-center px-4 py-2 bg-[#2AB7A9] text-white rounded-lg hover:bg-[#24a497] transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : (
          <>
            {/* Repository Grid View */}
            {view === 'repos' && (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Your Repositories</h2>
                    <p className="text-gray-600 mt-1">Manage and explore your connected GitHub repositories</p>
                  </div>
                  
                  {gitHubConnectionStatus?.isConnected && (
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <span>Connected as {gitHubConnectionStatus.details?.account?.login}</span>
                      </div>
                      <button
                        onClick={handleConnectGitHub}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Manage
                      </button>
                    </div>
                  )}
                </div>

                {isLoadingConnection ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : connectionError ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <div className="flex items-center">
                      <AlertTriangle className="h-6 w-6 text-red-500 mr-3" />
                      <div>
                        <h3 className="text-lg font-medium text-red-900">Connection Error</h3>
                        <p className="text-red-700 mt-1">{connectionError}</p>
                      </div>
                    </div>
                    <button
                      onClick={fetchGitHubConnectionStatus}
                      className="mt-4 inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : !gitHubConnectionStatus?.isConnected ? (
                  <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                    <Github className="h-16 w-16 mx-auto text-gray-300 mb-6" />
                    <h3 className="text-xl font-medium text-gray-900 mb-2">Connect Your GitHub Account</h3>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                      Connect your GitHub account to access and analyze your repositories with our data observability tools.
                    </p>
                    <button
                      onClick={handleConnectGitHub}
                      className="inline-flex items-center px-6 py-3 bg-[#2AB7A9] text-white text-lg font-medium rounded-lg hover:bg-[#24a497] transition-colors"
                    >
                      <Github className="h-5 w-5 mr-2" />
                      Connect GitHub Account
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {gitHubConnectionStatus.details?.accessibleRepos?.map((repo) => (
                      <div
                        key={repo.id}
                        onClick={() => handleGitHubRepoClick(repo)}
                        className="bg-white rounded-lg border border-gray-200 p-6 hover:border-[#2AB7A9] hover:shadow-lg transition-all duration-200 cursor-pointer group"
                      >
                        <div className="flex items-center space-x-3 mb-4">
                          <img 
                            src={repo.owner?.avatar_url || `https://github.com/${repo.full_name?.split('/')[0]}.png`} 
                            alt={repo.owner?.login || repo.full_name?.split('/')[0]} 
                            className="h-10 w-10 rounded-full"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#2AB7A9] transition-colors truncate">
                              {repo.name}
                            </h3>
                            <p className="text-sm text-gray-600 truncate">{repo.full_name}</p>
                          </div>
                          {repo.private && (
                            <Lock className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                          {repo.description || 'No description available'}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4" />
                              <span>{repo.stargazers_count || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <GitFork className="h-4 w-4" />
                              <span>{repo.forks_count || 0}</span>
                            </div>
                          </div>
                          <div className="w-48 text-right">
                            {(() => {
                              const status = reposStatus[repo.full_name];
                              const isProcessing = processingRepos.includes(repo.full_name);
                              const isQueued = queuedRepos.includes(repo.full_name);

                              if (isQueued && status) {
                                return (
                                  <div 
                                    className="cursor-pointer group" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRepoForStatusModal(repo);
                                      setIsStatusModalOpen(true);
                                    }}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-gray-700 group-hover:text-brand-600">Processing...</span>
                                      <span className="text-xs font-medium text-gray-700 group-hover:text-brand-600">{status.progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                      <div 
                                        className="bg-brand-600 h-2.5 rounded-full text-white flex items-center justify-center text-xs font-bold" 
                                        style={{ width: `${status.progress}%`, backgroundColor: brandColor }}
                                      >
                                        {status.progress > 10 ? `${status.progress}%` : ''}
                                      </div>
                                    </div>
                                  </div>
                                );
                              } else {
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleProcessRepo(repo.full_name);
                                    }}
                                    disabled={isProcessing}
                                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 ${
                                      isProcessing
                                        ? 'bg-yellow-100 text-yellow-800 cursor-wait'
                                        : 'text-white bg-brand-600 hover:bg-brand-700'
                                    }`}
                                    style={!isProcessing ? { backgroundColor: brandColor } : {}}
                                  >
                                    {isProcessing ? (
                                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                                    ) : (
                                      'Process for Summary'
                                    )}
                                  </button>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* File List / Code View Area */}
            {view === 'files' && (
              <div>
                {/* Header: Breadcrumbs, Search, Branch */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-[calc(3.5rem+1px)] z-10"> {/* Adjust top if header height changes */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Your Files</h2>
                      <p className="text-gray-600 mt-1">Manage and explore your connected GitHub files</p>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search files..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-offset-1 focus:ring-[#2AB7A9] focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* File List */}
                <div className="flex-grow overflow-y-auto">
                  {isLoadingRepoFiles ? (
                    <div className="flex items-center justify-center h-full p-6">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                      <p className="ml-3 text-gray-600">Loading files for {currentGitHubPath.join('/') || selectedGitHubRepo.name}...</p>
                    </div>
                  ) : repoFilesError ? (
                    <div className="p-6 text-red-700 bg-red-50 border border-red-200 rounded-md m-4">
                      <h4 className="font-semibold text-lg mb-1">Error Loading Files</h4>
                      <p>{repoFilesError}</p>
                    </div>
                  ) : (
                    <div className="p-0">
                      {currentGitHubPath.length > 0 && (
                        <div
                          onClick={goToParentGitHubDirectory}
                          className="flex items-center p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 text-sm text-gray-700"
                        >
                          <CornerLeftUp className="h-4 w-4 mr-2 text-gray-500" />
                          ..
                        </div>
                      )}
                      {getCurrentDirectoryContents().length === 0 ? (
                          <div className="p-10 text-center text-gray-500">
                              <Inbox className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                              <p className="font-medium text-lg">This directory is empty.</p>
                              {searchQuery && <p className="text-sm mt-1">No files or folders match your search "{searchQuery}".</p>}
                          </div>
                      ) : (
                        getCurrentDirectoryContents().map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleGitHubFileItemClick(item)}
                            className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 text-sm ${selectedFile?.id === item.id ? 'bg-[#2AB7A9] bg-opacity-10 border-[#2AB7A9]' : ''}`}
                          >
                            <div className="flex items-center truncate">
                              {getFileIcon(item.name, item.type)}
                              <span className={`truncate ${selectedFile?.id === item.id ? 'text-[#2AB7A9] font-medium' : 'text-gray-800'}`} title={item.name}>{item.name}</span>
                            </div>
                            <div className="text-sm text-gray-400 ml-4 flex-shrink-0">
                              {item.type === 'file' && item.size !== undefined ? `${(item.size / 1024).toFixed(1)} KB` : ''}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Code View */}
            {view === 'code' && selectedFile && (
              <div className="flex flex-col h-full">
                <div className="border-b border-gray-200 bg-gray-50 sticky top-[calc(3.5rem+1px)] z-10">
                  <nav className="-mb-px flex space-x-px px-4" aria-label="Tabs">
                    {['code', 'documentation', 'lineage', 'visual', 'alerts'].map((tabName) => (
                      <button
                        key={tabName}
                        onClick={() => setActiveTab(tabName as any)}
                        className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm 
                                    ${activeTab === tabName
                                      ? 'text-brand-600'
                                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                        style={{borderColor: brandColor, color: brandColor}}
                      >
                        {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
                      </button>
                    ))}
                  </nav>
                </div>
                
                <div className="flex-grow overflow-auto p-1 bg-gray-50 relative">
                  {isLoadingFileContent ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        <p className="ml-3 text-gray-600">Loading content for {selectedFile.name}...</p>
                    </div>
                  ) : fileContentError ? (
                    <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md">
                        <h4 className="font-semibold text-lg mb-1">Error Loading File Content</h4>
                        <p>{fileContentError}</p>
                    </div>
                  ) : selectedFileContent && activeTab === 'code' ? (
                    <div className="relative">
                      <button
                        onClick={() => copyToClipboard(selectedFileContent)}
                        className="absolute top-2 right-2 p-1.5 bg-gray-200 hover:bg-gray-300 rounded text-gray-600 hover:text-gray-800 transition-colors z-20"
                        title="Copy code"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      {formatCodeWithSyntaxHighlighting(selectedFileContent, selectedFile.name)}
                    </div>
                  ) : activeTab === 'documentation' ? (
                    <div className="p-4 prose max-w-none" dangerouslySetInnerHTML={{ __html: getMockDocumentation(selectedFile.path) }}></div>
                  ) : activeTab === 'lineage' ? (
                    <div className="p-4">{renderLineage(selectedFile.path)}</div>
                  ) : activeTab === 'visual' ? (
                    <div className="p-4 text-gray-500">Visual tab content not yet implemented.</div>
                  ) : activeTab === 'alerts' ? (
                    <div className="p-4 text-gray-500">Alerts tab content not yet implemented.</div>
                  ) : null}
                </div>
              </div>
            )}
            {view === 'browser' && (
              <div className="flex h-full">
                {/* Left Sidebar - File Tree */}
                <div className={`bg-gray-50 border-r border-gray-200 transition-all duration-300 ${isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-80'}`}>
                  {/* File Tree Header */}
                  <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center text-sm text-gray-600 overflow-hidden">
                        <button onClick={() => fetchGitHubRepoTree(selectedGitHubRepo, '', activeBranch)} className="hover:underline font-medium text-gray-700 whitespace-nowrap truncate">
                          {selectedGitHubRepo?.name}
                        </button>
                        {currentGitHubPath.map((segment, index) => (
                          <React.Fragment key={index}>
                            <span className="mx-1.5 text-gray-400">/</span>
                            <button
                              onClick={() => navigateToGitHubPath(index)}
                              className="hover:underline truncate whitespace-nowrap"
                              title={segment}
                            >
                              {segment}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <button className="flex items-center text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2" style={{borderColor: brandColor, color: brandColor}}>
                            <GitBranch className="h-4 w-4 mr-1.5" style={{color: brandColor}} />
                            {activeBranch}
                            <ChevronDown className="h-4 w-4 ml-1 text-gray-400" />
                          </button>
                          {/* TODO: Branch selection dropdown */}
                        </div>
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 pr-2 py-1.5 border border-gray-300 rounded-md text-sm w-full focus:ring-1 focus:outline-none"
                            style={{borderColor: brandColor}}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* File List */}
                  <div className="flex-grow overflow-y-auto">
                    {isLoadingTree ? (
                      <div className="flex items-center justify-center h-32 p-6">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                        <p className="ml-3 text-sm text-gray-600">Loading repository tree...</p>
                      </div>
                    ) : treeError ? (
                      <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md m-4">
                        <h4 className="font-semibold text-sm mb-1">Error Loading Repository Tree</h4>
                        <p className="text-xs">{treeError}</p>
                      </div>
                    ) : (
                      <div className="p-0">
                        {getFilteredTree().length === 0 ? (
                          <div className="p-6 text-center text-gray-500">
                            <Inbox className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                            <p className="font-medium text-sm">No files found.</p>
                            {searchQuery && <p className="text-xs mt-1">No files match "{searchQuery}".</p>}
                          </div>
                        ) : (
                          getFilteredTree().map((node) => (
                            <div
                              key={node.id}
                              onClick={() => handleTreeItemClick(node)}
                              className={`flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-50 text-sm ${selectedFile?.path === node.path ? 'bg-[#2AB7A9] bg-opacity-10 border-[#2AB7A9]' : ''}`}
                              style={{ paddingLeft: `${8 + node.level * 16}px` }}
                            >
                              <div className="flex items-center truncate">
                                {node.type === 'folder' && (
                                  <button className="mr-1 p-0.5 hover:bg-gray-200 rounded">
                                    {node.isExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-gray-500" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-gray-500" />
                                    )}
                                  </button>
                                )}
                                {node.type === 'file' && <div className="w-4 mr-1" />}
                                {getFileIcon(node.name, node.type)}
                                <span 
                                  className={`truncate ${selectedFile?.path === node.path ? 'text-[#2AB7A9] font-medium' : 'text-gray-800'}`} 
                                  title={node.name}
                                >
                                  {node.name}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 ml-4 flex-shrink-0">
                                {node.type === 'file' && node.size !== undefined ? `${(node.size / 1024).toFixed(1)} KB` : ''}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Right Content Area */}
                <div className="flex-1 bg-white overflow-hidden">
                  {selectedFile ? (
                    <div className="flex flex-col h-full">
                      {/* File Content Tabs */}
                      <div className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                        <nav className="-mb-px flex space-x-px px-4" aria-label="Tabs">
                          {['code', 'documentation', 'lineage', 'visual', 'alerts'].map((tabName) => (
                            <button
                              key={tabName}
                              onClick={() => setActiveTab(tabName as any)}
                              className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm 
                                          ${activeTab === tabName
                                            ? 'text-brand-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                              style={activeTab === tabName ? { borderColor: brandColor, color: brandColor } : {}}
                            >
                              {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
                            </button>
                          ))}
                        </nav>
                      </div>
                      
                      {/* File Content */}
                      <div className="flex-grow overflow-auto p-4 bg-gray-50 relative">
                        {isLoadingFileContent ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
                              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                              <p className="ml-3 text-gray-600">Loading content for {selectedFile.name}...</p>
                          </div>
                        ) : fileContentError ? (
                          <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md">
                              <h4 className="font-semibold text-lg mb-1">Error Loading File Content</h4>
                              <p>{fileContentError}</p>
                          </div>
                        ) : selectedFileContent && activeTab === 'code' ? (
                          <div className="relative">
                            <button
                              onClick={() => copyToClipboard(selectedFileContent)}
                              className="absolute top-2 right-2 p-1.5 bg-gray-200 hover:bg-gray-300 rounded text-gray-600 hover:text-gray-800 transition-colors z-20"
                              title="Copy code"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            {formatCodeWithSyntaxHighlighting(selectedFileContent, selectedFile.name)}
                          </div>
                        ) : activeTab === 'documentation' ? (
                          <div className="p-4 prose max-w-none" dangerouslySetInnerHTML={{ __html: getMockDocumentation(selectedFile.path) }}></div>
                        ) : activeTab === 'lineage' ? (
                          <div className="p-4">{renderLineage(selectedFile.path)}</div>
                        ) : activeTab === 'visual' ? (
                          <div className="p-4 text-gray-500">Visual tab content not yet implemented.</div>
                        ) : activeTab === 'alerts' ? (
                          <div className="p-4 text-gray-500">Alerts tab content not yet implemented.</div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <File className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a file to view</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">
                          Choose a file from the tree on the left to view its content, documentation, and analysis.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // Status Modal
  if (isStatusModalOpen && selectedRepoForStatusModal && reposStatus[selectedRepoForStatusModal.full_name]) {
    const status = reposStatus[selectedRepoForStatusModal.full_name];
    const isCompleted = status.progress >= 100;
    const startTime = status.startedAt ? new Date(status.startedAt) : null;
    const currentTime = new Date();
    const elapsedTime = startTime ? currentTime.getTime() - startTime.getTime() : 0;
    
    // Calculate estimated completion time
    const avgTimePerFile = status.averageFileProcessingTime || (elapsedTime / Math.max(status.completed, 1));
    const remainingFiles = status.pending;
    const estimatedRemainingTime = remainingFiles * avgTimePerFile;
    const estimatedCompletion = new Date(currentTime.getTime() + estimatedRemainingTime);
    
    // Format duration helper
    const formatDuration = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
      return `${seconds}s`;
    };
    
    // Sort files by status for better organization
    const sortedFiles = [...status.detailedStatus].sort((a, b) => {
      const statusOrder = { 'failed': 0, 'pending': 1, 'completed': 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={() => setIsStatusModalOpen(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-brand-100">
                    <Activity className="h-6 w-6 text-brand-600" style={{ color: brandColor }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Processing Status</h2>
                    <p className="text-gray-600 font-mono text-sm">{selectedRepoForStatusModal.full_name}</p>
                  </div>
                </div>
                
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {isCompleted ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      Completed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      <Loader2 className="w-3 h-3 animate-spin mr-2" />
                      Processing
                    </span>
                  )}
                  
                  {/* Timing Information */}
                  <div className="text-sm text-gray-600">
                    {startTime && (
                      <span>Started {startTime.toLocaleTimeString()} • </span>
                    )}
                    <span>Duration: {formatDuration(elapsedTime)}</span>
                    {!isCompleted && remainingFiles > 0 && (
                      <span> • ETA: {estimatedCompletion.toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setIsStatusModalOpen(false)} 
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Progress Overview */}
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-lg font-semibold text-gray-800">Overall Progress</span>
                  <span className="text-2xl font-bold text-gray-900">{status.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                  <div 
                    className={`h-4 rounded-full transition-all duration-500 flex items-center justify-center text-xs font-bold text-white ${
                      isCompleted ? 'bg-green-500' : 'bg-brand-600'
                    }`}
                    style={{ 
                      width: `${status.progress}%`, 
                      backgroundColor: isCompleted ? '#10B981' : brandColor 
                    }}
                  >
                    {status.progress > 15 ? `${status.progress}%` : ''}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {status.completed} of {status.totalFiles} files processed
                </div>
              </div>
              
              {/* Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-green-600">{status.completed}</div>
                  <div className="text-sm text-gray-600 font-medium">Completed</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-red-600">{status.failed}</div>
                  <div className="text-sm text-gray-600 font-medium">Failed</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-yellow-600">{status.pending}</div>
                  <div className="text-sm text-gray-600 font-medium">Pending</div>
                </div>
              </div>
            </div>
            
            {/* Success Banner */}
            {isCompleted && status.failed === 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800">
                      🎉 Processing completed successfully!
                    </h3>
                    <div className="mt-1 text-sm text-green-700">
                      All {status.totalFiles} files have been processed without errors in {formatDuration(elapsedTime)}.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* File Details Table */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 bg-white border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                File Processing Details ({sortedFiles.length} files)
              </h3>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      File Path
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedFiles.map((file, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getFileIcon(file.filePath.split('/').pop(), 'file')}
                          <span className="text-sm font-mono text-gray-900 truncate max-w-xs" title={file.filePath}>
                            {file.filePath}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {file.status === 'completed' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Completed
                          </span>
                        )}
                        {file.status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Pending
                          </span>
                        )}
                        {file.status === 'failed' && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {file.duration ? formatDuration(file.duration) : 
                         file.status === 'completed' ? 'N/A' : 
                         file.status === 'pending' ? '-' : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {file.errorMessage ? (
                          <div className="group relative">
                            <span className="text-red-600 cursor-help">View Error</span>
                            <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded-lg py-2 px-3 z-20 w-80 break-words shadow-lg -top-2 left-0">
                              <div className="font-semibold mb-1">Error Details:</div>
                              {file.errorMessage}
                            </div>
                          </div>
                        ) : file.status === 'completed' ? (
                          <span className="text-green-600">✓ Success</span>
                        ) : file.status === 'pending' ? (
                          <span className="text-gray-500">Waiting...</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              {isCompleted && (
                <button
                  onClick={() => {
                    // Navigate to insights or summary view
                    setIsStatusModalOpen(false);
                    // Could add navigation to insights page here
                  }}
                  className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors"
                  style={{ backgroundColor: brandColor }}
                >
                  View Insights
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to format file sizes
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper function to format file sizes
  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
}
