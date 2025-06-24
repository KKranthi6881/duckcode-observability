import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  File, 
  Copy, 
  Code2,  
  GitBranch, 
  Eye, 
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
  PanelLeftClose,
  Info,
  Package,
  Code,
  Layers,
  Lightbulb,
  BookOpen,
  AlertTriangle,
  X,
  Play,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../features/auth/contexts/AuthContext';
import { 
  getGitHubConnectionStatus, 
  getRepositoryContents,
  getFileContent,
  decodeFileContent,
  processRepositoryForInsights,
  getProcessingStatus, 
  getFileSummary,
  generateRepositorySummaries,
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

const GITHUB_APP_NAME = 'DuckCode-Observability';
const brandColor = "#2AB7A9";

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

  const [reposStatus, setReposStatus] = useState<Record<string, RepoStatus>>({});
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedRepoForStatusModal, setSelectedRepoForStatusModal] = useState<GitHubRepository | null>(null);

  // New state for file summary data
  const [selectedFileSummary, setSelectedFileSummary] = useState<any | null>(null);
  const [isLoadingFileSummary, setIsLoadingFileSummary] = useState(false);
  const [fileSummaryError, setFileSummaryError] = useState<string | null>(null);
  const [summaryGenerationError, setSummaryGenerationError] = useState<string | null>(null);

  // Copy status state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Language selection and summary generation state
  const [selectedLanguages, setSelectedLanguages] = useState<Record<string, string>>({});
  const [generatingSummaries, setGeneratingSummaries] = useState<string[]>([]);

  // Available languages for selection
  const availableLanguages = [
    { value: 'default', label: 'General Analysis' },
    { value: 'postgres', label: 'PostgreSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'dbt', label: 'dbt ' },
    { value: 'tsql', label: 'T-SQL (SQL Server)' },
    { value: 'plsql', label: 'PL/SQL (Oracle)' },
    { value: 'pyspark', label: 'PySpark' },
    { value: 'python', label: 'Python' },
  ];

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

  // Enhanced copy to clipboard function with status feedback
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      console.log("Copied to clipboard");
      
      // Reset the copied status after 2 seconds
      setTimeout(() => {
        setCopiedText(null);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedText(text);
        setTimeout(() => {
          setCopiedText(null);
        }, 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed: ', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  // Helper function to check if text is currently copied
  const isTextCopied = (text: string) => copiedText === text;

  // Fetch file summary for documentation
  const fetchFileSummary = async (owner: string, repo: string, filePath: string) => {
    setIsLoadingFileSummary(true);
    setFileSummaryError(null);
    setSelectedFileSummary(null);

    try {
      console.log(`[CodeBase] Fetching file summary for: ${owner}/${repo}/${filePath}`);
      
      const summary = await getFileSummary(owner, repo, filePath);
      setSelectedFileSummary(summary);
      console.log(`[CodeBase] File summary fetched successfully:`, summary);
    } catch (error: any) {
      console.error(`[CodeBase] Error fetching file summary:`, error);
      
      // Provide more specific error messages based on the error type
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
      
      console.log('[CodeBase] Raw contents from API:', contents);
      console.log('[CodeBase] Converted file items:', fileItems);
      
      setRepoFiles(fileItems);
      setCurrentGitHubPath(path.split('/').filter(Boolean));
      console.log(`[CodeBase] Successfully fetched ${fileItems.length} items for path: ${path}`);
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

  // Handle GitHub Connection
  const handleConnectGitHub = () => {
    navigate('/dashboard/settings?tab=github');
  };

  // Event Handlers
  const handleGitHubRepoClick = async (repo: any) => {
    console.log('[CodeBase] Repository clicked:', repo);
    
    const defaultBranch = repo.default_branch || 'main';
    console.log('[CodeBase] Using default branch:', defaultBranch);
    
    const fullRepo = {
      ...repo,
      default_branch: defaultBranch,
    } as GitHubRepository;
    
    console.log('[CodeBase] Setting selected repo:', fullRepo);
    setSelectedGitHubRepo(fullRepo);
    setSelectedFile(null);
    setSelectedFileContent(null);
    setView('browser');
    setActiveBranch(defaultBranch);
    
    console.log('[CodeBase] About to fetch repo tree for:', fullRepo.full_name, 'branch:', defaultBranch);
    // Fetch the repository tree structure
    fetchRepositoryTree(fullRepo, defaultBranch);
  };

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

  // Navigation helper for GitHub paths
  const navigateToGitHubPath = (index: number) => {
    const newPath = currentGitHubPath.slice(0, index + 1);
    setCurrentGitHubPath(newPath);
    if (selectedGitHubRepo) {
      fetchGitHubRepoTree(selectedGitHubRepo, newPath.join('/'), activeBranch);
    }
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

  // Handle tree item click
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
      
      // Fetch file summary for documentation tab
      if (selectedGitHubRepo) {
        const [owner, repo] = selectedGitHubRepo.full_name.split('/');
        fetchFileSummary(owner, repo, fileItem.path);
      }
    }
  };

  // Fetch GitHub file content
  const fetchGitHubFileContent = async (owner: string, repo: string, path: string, branch: string) => {
    setIsLoadingFileContent(true);
    setFileContentError(null);
    setSelectedFileContent(null);

    try {
      const fileData = await getFileContent(owner, repo, path, branch);
      const decodedContent = decodeFileContent(fileData.content, fileData.encoding);
      setSelectedFileContent(decodedContent);
    } catch (error: any) {
      console.error(`Error fetching file content for ${path}:`, error);
      setFileContentError(error.message || 'Failed to fetch file content');
    } finally {
      setIsLoadingFileContent(false);
    }
  };

  // Get file icon based on file type
  const getFileIcon = (fileName: string, type: string) => {
    if (type === 'folder') {
      return <Folder className="h-4 w-4 text-blue-500 mr-2" />;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconClass = "h-4 w-4 mr-2";
    
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <File className={`${iconClass} text-yellow-500`} />;
      case 'py':
        return <File className={`${iconClass} text-blue-600`} />;
      case 'java':
        return <File className={`${iconClass} text-red-600`} />;
      case 'html':
      case 'htm':
        return <File className={`${iconClass} text-orange-500`} />;
      case 'css':
      case 'scss':
      case 'sass':
        return <File className={`${iconClass} text-blue-400`} />;
      case 'json':
        return <File className={`${iconClass} text-green-600`} />;
      case 'md':
      case 'markdown':
        return <File className={`${iconClass} text-gray-600`} />;
      case 'yml':
      case 'yaml':
        return <File className={`${iconClass} text-purple-600`} />;
      default:
        return <File className={`${iconClass} text-gray-500`} />;
    }
  };

  // Simple and reliable syntax highlighting function
  const formatCodeWithSyntaxHighlighting = (code: string, fileName?: string): React.ReactNode => {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    const lines = code.split('\n');
    
    const highlightLine = (line: string): React.ReactNode => {
      if (!line.trim()) return <span>&nbsp;</span>;
      
      // Simple word-based highlighting that works reliably
      const words = line.split(/(\s+)/); // Split on whitespace but keep the whitespace
      
      return (
        <span>
          {words.map((word, i) => {
            const trimmedWord = word.trim();
            
            // JavaScript/TypeScript keywords
            if ((extension === 'js' || extension === 'jsx' || extension === 'ts' || extension === 'tsx') && 
                ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'extends', 'implements', 'interface', 'type', 'enum'].includes(trimmedWord)) {
              return <span key={i} style={{color: '#ff79c6'}}>{word}</span>;
            }
            
            // SQL keywords
            if (extension === 'sql' && 
                ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'UNION', 'ALL', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'IN', 'EXISTS', 'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'].includes(trimmedWord.toUpperCase())) {
              return <span key={i} style={{color: '#ff79c6'}}>{word}</span>;
            }
            
            // Python keywords
            if (extension === 'py' && 
                ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'import', 'from', 'as', 'return', 'yield', 'lambda', 'with', 'assert', 'break', 'continue', 'pass', 'global', 'nonlocal', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'].includes(trimmedWord)) {
              return <span key={i} style={{color: '#ff79c6'}}>{word}</span>;
            }
            
            // Strings (simple detection)
            if ((trimmedWord.startsWith('"') && trimmedWord.endsWith('"')) ||
                (trimmedWord.startsWith("'") && trimmedWord.endsWith("'")) ||
                (trimmedWord.startsWith('`') && trimmedWord.endsWith('`'))) {
              return <span key={i} style={{color: '#f1fa8c'}}>{word}</span>;
            }
            
            // Comments
            if (trimmedWord.startsWith('//') || trimmedWord.startsWith('#') || trimmedWord.startsWith('--')) {
              return <span key={i} style={{color: '#6272a4', fontStyle: 'italic'}}>{word}</span>;
            }
            
            // Numbers
            if (/^\d+\.?\d*$/.test(trimmedWord)) {
              return <span key={i} style={{color: '#bd93f9'}}>{word}</span>;
            }
            
            // Default
            return <span key={i}>{word}</span>;
          })}
        </span>
      );
    };
    
    return lines.map((line, index) => (
      <div key={index}>
        {highlightLine(line)}
      </div>
    ));
  };

  // Helper function to safely render content that might be objects or strings
  const renderSafeContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      return <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>;
    }
    
    if (typeof content === 'object' && content !== null) {
      return (
        <div className="space-y-3">
          {Object.entries(content).map(([key, value], index) => (
            <div key={index} className="border-l-4 border-blue-200 pl-4">
              <h5 className="font-semibold text-gray-800 mb-2 capitalize">
                {key.replace(/_/g, ' ')}
              </h5>
              <div className="text-gray-700">
                {typeof value === 'string' ? (
                  <p className="leading-relaxed whitespace-pre-wrap">{value}</p>
                ) : Array.isArray(value) ? (
                  <ul className="list-disc list-inside space-y-1">
                    {value.map((item, idx) => (
                      <li key={idx}>{String(item)}</li>
                    ))}
                  </ul>
                ) : (
                  <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback for other types
    return <p className="text-gray-700 leading-relaxed">{String(content)}</p>;
  };

  // Render documentation tab content
  const renderDocumentation = () => {
    if (isLoadingFileSummary) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">Loading documentation...</span>
        </div>
      );
    }

    if (fileSummaryError) {
      return (
        <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-700 mr-2" />
            <h4 className="font-semibold">Error Loading Documentation</h4>
          </div>
          <p className="mt-1">{fileSummaryError}</p>
        </div>
      );
    }

    if (!selectedFileSummary) {
      return (
        <div className="p-4 text-gray-500 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            <span>No documentation available for this file.</span>
          </div>
        </div>
      );
    }

    // The backend returns: { filePath, language, lastProcessed, summary: {summary, dependencies, description}, summaryCreatedAt }
    const apiResponse = selectedFileSummary;
    const summaryContent = apiResponse.summary;

    return (
      <div className="space-y-6">
        {/* File Information Header */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <FileText className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold text-blue-900">File Documentation</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="font-medium text-gray-700">File:</span> <span className="text-gray-900">{apiResponse.filePath}</span></div>
            {apiResponse.language && <div><span className="font-medium text-gray-700">Language:</span> <span className="text-gray-900">{apiResponse.language}</span></div>}
            {apiResponse.lastProcessed && <div><span className="font-medium text-gray-700">Processed:</span> <span className="text-gray-900">{new Date(apiResponse.lastProcessed).toLocaleDateString()}</span></div>}
            {apiResponse.summaryCreatedAt && <div><span className="font-medium text-gray-700">Generated:</span> <span className="text-gray-900">{new Date(apiResponse.summaryCreatedAt).toLocaleDateString()}</span></div>}
          </div>
        </div>

        {/* Rich Structured Documentation */}
        {summaryContent?.business_logic || summaryContent?.technical_details || summaryContent?.code_blocks || summaryContent?.summary ? (
          <div className="space-y-6">
            {/* Summary Section */}
            {summaryContent.summary && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <FileText className="h-6 w-6 text-blue-600 mr-3" />
                  <h4 className="text-xl font-bold text-gray-900">File Summary</h4>
                </div>
                <div className="prose max-w-none">
                  {renderSafeContent(summaryContent.summary)}
                </div>
              </div>
            )}

            {/* Business Logic Section */}
            {summaryContent.business_logic && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center mb-4">
                  <TrendingUp className="h-6 w-6 text-green-600 mr-3" />
                  <h4 className="text-xl font-bold text-gray-900">Business Logic & Impact</h4>
                </div>
                
                {summaryContent.business_logic.main_objectives && (
                  <div className="mb-4">
                    <h5 className="font-semibold text-gray-800 mb-2">📋 Main Objectives</h5>
                    <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                      {summaryContent.business_logic.main_objectives.map((obj: string, idx: number) => (
                        <li key={idx}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {summaryContent.business_logic.data_transformation && (
                  <div className="mb-4">
                    <h5 className="font-semibold text-gray-800 mb-2">🔄 Data Transformation</h5>
                    <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-green-400">{summaryContent.business_logic.data_transformation}</p>
                  </div>
                )}
                
                {summaryContent.business_logic.stakeholder_impact && (
                  <div className="mb-4">
                    <h5 className="font-semibold text-gray-800 mb-2">👥 Stakeholder Impact</h5>
                    <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400">{summaryContent.business_logic.stakeholder_impact}</p>
                  </div>
                )}
              </div>
            )}

                         {/* Code Blocks - Step by Step Explanation */}
             {summaryContent.code_blocks && summaryContent.code_blocks.length > 0 && (
               <div className="bg-white border border-gray-200 rounded-lg p-6">
                 <div className="flex items-center mb-4">
                   <Code className="h-6 w-6 text-purple-600 mr-3" />
                   <h4 className="text-xl font-bold text-gray-900">Step-by-Step Code Walkthrough</h4>
                 </div>
                 
                 <div className="space-y-6">
                   {summaryContent.code_blocks.map((block: any, idx: number) => (
                     <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                       <div className="flex items-center mb-3">
                         <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold mr-3">
                           Step {idx + 1}
                         </span>
                         <h5 className="text-lg font-semibold text-gray-900">{block.section}</h5>
                       </div>
                       
                       {/* Enhanced Code Block */}
                       <div className="mb-4">
                         <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                           {/* Code Block Header */}
                           <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                             <div className="flex items-center">
                               <Code className="h-4 w-4 text-blue-600 mr-2" />
                               <span className="text-sm font-medium text-gray-700">Code Block</span>
                             </div>
                             <button
                               onClick={() => copyToClipboard(block.code)}
                               className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded transition-colors ${
                                 isTextCopied(block.code) 
                                   ? 'text-green-700 bg-green-50 border-green-300' 
                                   : 'text-gray-700 bg-white hover:bg-gray-50'
                               } focus:outline-none focus:ring-1 focus:ring-offset-1`}
                               style={{borderColor: isTextCopied(block.code) ? '#10b981' : brandColor}}
                               title={isTextCopied(block.code) ? "Copied!" : "Copy code"}
                             >
                               {isTextCopied(block.code) ? (
                                 <CheckCircle className="h-3 w-3 mr-1" />
                               ) : (
                                 <Copy className="h-3 w-3 mr-1" />
                               )}
                               {isTextCopied(block.code) ? 'Copied!' : 'Copy'}
                             </button>
                           </div>
                           
                           {/* Code Content with Line Numbers and Syntax Highlighting */}
                           <div className="flex">
                             {/* Line Numbers */}
                             <div className="bg-gray-800 text-gray-400 px-3 py-4 text-sm font-mono leading-6 select-none border-r border-gray-700 min-w-[3rem]">
                               {block.code.split('\n').map((_: string, index: number) => (
                                 <div key={index} className="text-right pr-2">
                                   {index + 1}
                                 </div>
                               ))}
                             </div>
                             
                             {/* Code Content */}
                             <div className="flex-1 bg-gray-900 text-gray-100 p-4 overflow-x-auto">
                               <pre className="text-sm font-mono leading-6 whitespace-pre">
                                 <code>
                                   {formatCodeWithSyntaxHighlighting(block.code, selectedFile?.name)}
                                 </code>
                               </pre>
                             </div>
                           </div>
                         </div>
                       </div>
                       
                       {/* Technical Explanation */}
                       <div className="mb-3">
                         <h6 className="font-semibold text-gray-800 mb-2">🔧 Technical Explanation</h6>
                         <p className="text-gray-700 bg-blue-50 p-3 rounded border-l-4 border-blue-400">{block.explanation}</p>
                       </div>
                       
                       {/* Business Context */}
                       <div>
                         <h6 className="font-semibold text-gray-800 mb-2">💼 Business Context</h6>
                         <p className="text-gray-700 bg-green-50 p-3 rounded border-l-4 border-green-400">{block.business_context}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             {/* Technical Details */}
             {summaryContent.technical_details && (
               <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                 <div className="flex items-center mb-4">
                   <Settings className="h-6 w-6 text-gray-600 mr-3" />
                   <h4 className="text-xl font-bold text-gray-900">Technical Implementation</h4>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {summaryContent.technical_details.materialization && (
                     <div>
                       <h5 className="font-semibold text-gray-800 mb-2">🏗️ Materialization</h5>
                       <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                         {summaryContent.technical_details.materialization}
                       </span>
                     </div>
                   )}
                   
                   {summaryContent.technical_details.source_tables && summaryContent.technical_details.source_tables.length > 0 && (
                     <div>
                       <h5 className="font-semibold text-gray-800 mb-2">📊 Source Tables</h5>
                       <div className="space-y-1">
                         {summaryContent.technical_details.source_tables.map((table: string, idx: number) => (
                           <span key={idx} className="block bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">
                             {table}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}
                   
                   {summaryContent.technical_details.sql_operations && summaryContent.technical_details.sql_operations.length > 0 && (
                     <div>
                       <h5 className="font-semibold text-gray-800 mb-2">🔍 SQL Operations</h5>
                       <div className="space-y-1">
                         {summaryContent.technical_details.sql_operations.map((op: string, idx: number) => (
                           <span key={idx} className="block bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
                             {op}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}
                   
                   {summaryContent.technical_details.incremental_strategy && (
                     <div>
                       <h5 className="font-semibold text-gray-800 mb-2">⚡ Incremental Strategy</h5>
                       <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                         {summaryContent.technical_details.incremental_strategy}
                       </span>
                     </div>
                   )}
                 </div>
               </div>
             )}
          </div>
        ) : (
          /* Fallback: Basic Documentation for non-structured responses */
          <div className="space-y-6">
            {/* Summary Section */}
            {summaryContent?.summary && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <Info className="h-5 w-5 text-green-600 mr-2" />
                  <h4 className="text-lg font-semibold text-gray-900">Summary</h4>
                </div>
                {renderSafeContent(summaryContent.summary)}
              </div>
            )}

            {/* Description Section */}
            {summaryContent?.description && (
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <BookOpen className="h-5 w-5 text-purple-600 mr-2" />
                  <h4 className="text-lg font-semibold text-gray-900">Description</h4>
                </div>
                <p className="text-gray-700 leading-relaxed">{summaryContent.description}</p>
              </div>
            )}
          </div>
        )}

                 {/* Dependencies Section */}
         {summaryContent?.dependencies && Array.isArray(summaryContent.dependencies) && summaryContent.dependencies.length > 0 && (
           <div className="bg-white border border-gray-200 rounded-lg p-4">
             <div className="flex items-center mb-3">
               <Package className="h-5 w-5 text-orange-600 mr-2" />
               <h4 className="text-lg font-semibold text-gray-900">Dependencies</h4>
             </div>
             <div className="flex flex-wrap gap-2">
               {summaryContent.dependencies.map((dep: any, index: number) => (
                 <span key={index} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                   {dep}
                 </span>
               ))}
             </div>
           </div>
         )}

         {/* Execution Flow Section */}
         {summaryContent?.execution_flow && Array.isArray(summaryContent.execution_flow) && summaryContent.execution_flow.length > 0 && (
           <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <Play className="h-6 w-6 text-blue-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">Execution Flow</h4>
             </div>
             <div className="space-y-3">
               {summaryContent.execution_flow.map((step: any, idx: number) => (
                 <div key={idx} className="flex items-start">
                   <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold mr-4 mt-1 flex-shrink-0">
                     {idx + 1}
                   </span>
                   <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400 flex-1">{step}</p>
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Performance Considerations Section */}
         {summaryContent?.performance_considerations && Array.isArray(summaryContent.performance_considerations) && summaryContent.performance_considerations.length > 0 && (
           <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <Zap className="h-6 w-6 text-orange-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">Performance Considerations</h4>
             </div>
             <div className="space-y-2">
               {summaryContent.performance_considerations.map((consideration: any, idx: number) => (
                 <div key={idx} className="flex items-start">
                   <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                   <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-orange-400">{consideration}</p>
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Best Practices Section */}
         {summaryContent?.best_practices && Array.isArray(summaryContent.best_practices) && summaryContent.best_practices.length > 0 && (
           <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">Best Practices</h4>
             </div>
             <div className="space-y-2">
               {summaryContent.best_practices.map((practice: any, idx: number) => (
                 <div key={idx} className="flex items-start">
                   <CheckCircle className="h-4 w-4 text-green-500 mt-1 mr-3 flex-shrink-0" />
                   <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-green-400">{practice}</p>
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* T-SQL Features Section */}
         {summaryContent?.tsql_features && Array.isArray(summaryContent.tsql_features) && summaryContent.tsql_features.length > 0 && (
           <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <Database className="h-6 w-6 text-purple-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">T-SQL Features Used</h4>
             </div>
             <div className="flex flex-wrap gap-2">
               {summaryContent.tsql_features.map((feature: any, idx: number) => (
                 <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                   {feature}
                 </span>
               ))}
             </div>
           </div>
         )}

         {/* Maintenance Notes Section */}
         {summaryContent?.maintenance_notes && Array.isArray(summaryContent.maintenance_notes) && summaryContent.maintenance_notes.length > 0 && (
           <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <AlertTriangle className="h-6 w-6 text-yellow-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">Maintenance Notes</h4>
             </div>
             <div className="space-y-2">
               {summaryContent.maintenance_notes.map((note: any, idx: number) => (
                 <div key={idx} className="flex items-start">
                   <AlertTriangle className="h-4 w-4 text-yellow-500 mt-1 mr-3 flex-shrink-0" />
                   <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-yellow-400">{note}</p>
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Functions Section */}
         {summaryContent?.functions && Array.isArray(summaryContent.functions) && summaryContent.functions.length > 0 && (
           <div className="bg-white border border-gray-200 rounded-lg p-4">
             <div className="flex items-center mb-3">
               <Code className="h-5 w-5 text-blue-600 mr-2" />
               <h4 className="text-lg font-semibold text-gray-900">Functions & Methods</h4>
             </div>
             <div className="space-y-3">
               {summaryContent.functions.map((func: any, index: number) => (
                 <div key={index} className="border-l-4 border-blue-200 pl-4">
                   <h5 className="font-semibold text-gray-900">{func.name}</h5>
                   {func.description && <p className="text-gray-700 text-sm mt-1">{func.description}</p>}
                   {func.parameters && func.parameters.length > 0 && (
                     <div className="mt-2">
                       <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Parameters:</span>
                       <div className="flex flex-wrap gap-1 mt-1">
                         {func.parameters.map((param: any, paramIndex: number) => (
                           <span key={paramIndex} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                             {param}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Key Points Section */}
         {summaryContent?.keyPoints && Array.isArray(summaryContent.keyPoints) && summaryContent.keyPoints.length > 0 && (
           <div className="bg-white border border-gray-200 rounded-lg p-4">
             <div className="flex items-center mb-3">
               <Lightbulb className="h-5 w-5 text-yellow-600 mr-2" />
               <h4 className="text-lg font-semibold text-gray-900">Key Points</h4>
             </div>
             <ul className="space-y-2">
               {summaryContent.keyPoints.map((point: any, index: number) => (
                 <li key={index} className="flex items-start">
                   <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                   <span className="text-gray-700">{point}</span>
                 </li>
               ))}
             </ul>
           </div>
         )}

         {/* Usage Examples Section */}
         {summaryContent?.usageExamples && Array.isArray(summaryContent.usageExamples) && summaryContent.usageExamples.length > 0 && (
           <div className="bg-white border border-gray-200 rounded-lg p-4">
             <div className="flex items-center mb-3">
               <Layers className="h-5 w-5 text-indigo-600 mr-2" />
               <h4 className="text-lg font-semibold text-gray-900">Usage Examples</h4>
             </div>
             <div className="space-y-4">
               {summaryContent.usageExamples.map((example: any, index: number) => (
                 <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                   {/* Usage Example Header */}
                   <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                     <div className="flex items-center">
                       <Layers className="h-4 w-4 text-indigo-600 mr-2" />
                       <span className="text-sm font-medium text-gray-700">Usage Example {index + 1}</span>
                     </div>
                                            <button
                         onClick={() => copyToClipboard(example)}
                         className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded transition-colors ${
                           isTextCopied(example) 
                             ? 'text-green-700 bg-green-50 border-green-300' 
                             : 'text-gray-700 bg-white hover:bg-gray-50'
                         } focus:outline-none focus:ring-1 focus:ring-offset-1`}
                         style={{borderColor: isTextCopied(example) ? '#10b981' : brandColor}}
                         title={isTextCopied(example) ? "Copied!" : "Copy example"}
                       >
                         {isTextCopied(example) ? (
                           <CheckCircle className="h-3 w-3 mr-1" />
                         ) : (
                           <Copy className="h-3 w-3 mr-1" />
                         )}
                         {isTextCopied(example) ? 'Copied!' : 'Copy'}
                       </button>
                   </div>
                   
                                        {/* Example Content */}
                     <div className="flex">
                       <div className="bg-gray-800 text-gray-400 px-3 py-4 text-sm font-mono leading-6 select-none border-r border-gray-700 min-w-[3rem]">
                         {example.split('\n').map((_: string, idx: number) => (
                           <div key={idx} className="text-right pr-2">
                             {idx + 1}
                           </div>
                         ))}
                       </div>
                       <div className="flex-1 bg-gray-900 text-gray-100 p-4 overflow-x-auto">
                         <pre className="text-sm font-mono leading-6 whitespace-pre">
                           <code>
                             {formatCodeWithSyntaxHighlighting(example, selectedFile?.name)}
                           </code>
                         </pre>
                       </div>
                     </div>
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* SQL Queries Section */}
         {summaryContent?.sql_queries && Array.isArray(summaryContent.sql_queries) && summaryContent.sql_queries.length > 0 && (
           <div className="bg-white border border-gray-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <Database className="h-6 w-6 text-blue-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">SQL Queries</h4>
             </div>
             <div className="space-y-4">
               {summaryContent.sql_queries.map((query: any, idx: number) => (
                 <div key={idx} className="border border-gray-200 rounded-lg p-4">
                   {query.title && (
                     <h5 className="text-lg font-semibold text-gray-900 mb-2">{query.title}</h5>
                   )}
                   {query.description && (
                     <p className="text-gray-700 mb-3 bg-blue-50 p-3 rounded border-l-4 border-blue-400">{query.description}</p>
                   )}
                                       <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      {/* SQL Query Header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center">
                          <Database className="h-4 w-4 text-blue-600 mr-2" />
                          <span className="text-sm font-medium text-gray-700">SQL Query</span>
                        </div>
                                                 <button
                           onClick={() => copyToClipboard(query.query || query.code || query)}
                           className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded transition-colors ${
                             isTextCopied(query.query || query.code || query) 
                               ? 'text-green-700 bg-green-50 border-green-300' 
                               : 'text-gray-700 bg-white hover:bg-gray-50'
                           } focus:outline-none focus:ring-1 focus:ring-offset-1`}
                           style={{borderColor: isTextCopied(query.query || query.code || query) ? '#10b981' : brandColor}}
                           title={isTextCopied(query.query || query.code || query) ? "Copied!" : "Copy SQL"}
                         >
                           {isTextCopied(query.query || query.code || query) ? (
                             <CheckCircle className="h-3 w-3 mr-1" />
                           ) : (
                             <Copy className="h-3 w-3 mr-1" />
                           )}
                           {isTextCopied(query.query || query.code || query) ? 'Copied!' : 'Copy'}
                         </button>
                      </div>
                      
                                             {/* SQL Content with Line Numbers and Syntax Highlighting */}
                       <div className="flex">
                         {/* Line Numbers */}
                         <div className="bg-gray-800 text-gray-400 px-3 py-4 text-sm font-mono leading-6 select-none border-r border-gray-700 min-w-[3rem]">
                           {(query.query || query.code || query).split('\n').map((_: string, index: number) => (
                             <div key={index} className="text-right pr-2">
                               {index + 1}
                             </div>
                           ))}
                         </div>
                         
                         {/* SQL Content */}
                         <div className="flex-1 bg-gray-900 text-gray-100 p-4 overflow-x-auto">
                           <pre className="text-sm font-mono leading-6 whitespace-pre">
                             <code>
                               {formatCodeWithSyntaxHighlighting(query.query || query.code || query, 'query.sql')}
                             </code>
                           </pre>
                         </div>
                       </div>
                    </div>
                   {query.explanation && (
                     <div className="mt-3">
                       <h6 className="font-semibold text-gray-800 mb-2">💡 Explanation</h6>
                       <p className="text-gray-700 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">{query.explanation}</p>
                     </div>
                   )}
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Data Flow Section */}
         {summaryContent?.data_flow && Array.isArray(summaryContent.data_flow) && summaryContent.data_flow.length > 0 && (
           <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <TrendingUp className="h-6 w-6 text-cyan-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">Data Flow</h4>
             </div>
             <div className="space-y-4">
               {summaryContent.data_flow.map((flow: any, idx: number) => (
                 <div key={idx} className="bg-white p-4 rounded-lg border border-cyan-200">
                   <div className="flex items-center mb-2">
                     <span className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full text-sm font-semibold mr-3">
                       Flow {idx + 1}
                     </span>
                     {flow.source && flow.target && (
                       <span className="text-gray-600 text-sm">
                         {flow.source} → {flow.target}
                       </span>
                     )}
                   </div>
                   <p className="text-gray-700">{flow.description || flow}</p>
                   {flow.transformations && flow.transformations.length > 0 && (
                     <div className="mt-2">
                       <h6 className="font-semibold text-gray-800 mb-1">Transformations:</h6>
                       <div className="flex flex-wrap gap-1">
                         {flow.transformations.map((transform: string, tIdx: number) => (
                           <span key={tIdx} className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded text-xs">
                             {transform}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Error Handling Section */}
         {summaryContent?.error_handling && Array.isArray(summaryContent.error_handling) && summaryContent.error_handling.length > 0 && (
           <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">Error Handling</h4>
             </div>
             <div className="space-y-3">
               {summaryContent.error_handling.map((error: any, idx: number) => (
                 <div key={idx} className="bg-white p-4 rounded-lg border border-red-200">
                   {typeof error === 'string' ? (
                     <p className="text-gray-700">{error}</p>
                   ) : (
                     <>
                       {error.scenario && (
                         <h6 className="font-semibold text-gray-900 mb-2">{error.scenario}</h6>
                       )}
                       {error.handling && (
                         <p className="text-gray-700 mb-2">{error.handling}</p>
                       )}
                       {error.code && (
                         <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-3">
                           {/* Error Code Header */}
                           <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                             <div className="flex items-center">
                               <Code className="h-4 w-4 text-red-600 mr-2" />
                               <span className="text-sm font-medium text-gray-700">Error Handling Code</span>
                             </div>
                                                            <button
                                 onClick={() => copyToClipboard(error.code)}
                                 className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded transition-colors ${
                                   isTextCopied(error.code) 
                                     ? 'text-green-700 bg-green-50 border-green-300' 
                                     : 'text-gray-700 bg-white hover:bg-gray-50'
                                 } focus:outline-none focus:ring-1 focus:ring-offset-1`}
                                 style={{borderColor: isTextCopied(error.code) ? '#10b981' : brandColor}}
                                 title={isTextCopied(error.code) ? "Copied!" : "Copy code"}
                               >
                                 {isTextCopied(error.code) ? (
                                   <CheckCircle className="h-3 w-3 mr-1" />
                                 ) : (
                                   <Copy className="h-3 w-3 mr-1" />
                                 )}
                                 {isTextCopied(error.code) ? 'Copied!' : 'Copy'}
                               </button>
                           </div>
                           
                                                        {/* Code Content */}
                             <div className="flex">
                               <div className="bg-gray-800 text-gray-400 px-3 py-4 text-sm font-mono leading-6 select-none border-r border-gray-700 min-w-[3rem]">
                                 {error.code.split('\n').map((_: string, index: number) => (
                                   <div key={index} className="text-right pr-2">
                                     {index + 1}
                                   </div>
                                 ))}
                               </div>
                               <div className="flex-1 bg-gray-900 text-gray-100 p-4 overflow-x-auto">
                                 <pre className="text-sm font-mono leading-6 whitespace-pre">
                                   <code>
                                     {formatCodeWithSyntaxHighlighting(error.code, selectedFile?.name)}
                                   </code>
                                 </pre>
                               </div>
                             </div>
                         </div>
                       )}
                     </>
                   )}
                 </div>
               ))}
             </div>
           </div>
         )}

         {/* Testing Section */}
         {summaryContent?.testing && Array.isArray(summaryContent.testing) && summaryContent.testing.length > 0 && (
           <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg p-6">
             <div className="flex items-center mb-4">
               <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
               <h4 className="text-xl font-bold text-gray-900">Testing Approach</h4>
             </div>
             <div className="space-y-3">
               {summaryContent.testing.map((test: any, idx: number) => (
                 <div key={idx} className="bg-white p-4 rounded-lg border border-green-200">
                   {typeof test === 'string' ? (
                     <p className="text-gray-700">{test}</p>
                   ) : (
                     <>
                       {test.type && (
                         <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium mb-2 inline-block">
                           {test.type}
                         </span>
                       )}
                       {test.description && (
                         <p className="text-gray-700 mb-2">{test.description}</p>
                       )}
                       {test.example && (
                         <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-3">
                           {/* Test Code Header */}
                           <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                             <div className="flex items-center">
                               <Code className="h-4 w-4 text-green-600 mr-2" />
                               <span className="text-sm font-medium text-gray-700">Test Example</span>
                             </div>
                                                            <button
                                 onClick={() => copyToClipboard(test.example)}
                                 className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded transition-colors ${
                                   isTextCopied(test.example) 
                                     ? 'text-green-700 bg-green-50 border-green-300' 
                                     : 'text-gray-700 bg-white hover:bg-gray-50'
                                 } focus:outline-none focus:ring-1 focus:ring-offset-1`}
                                 style={{borderColor: isTextCopied(test.example) ? '#10b981' : brandColor}}
                                 title={isTextCopied(test.example) ? "Copied!" : "Copy test code"}
                               >
                                 {isTextCopied(test.example) ? (
                                   <CheckCircle className="h-3 w-3 mr-1" />
                                 ) : (
                                   <Copy className="h-3 w-3 mr-1" />
                                 )}
                                 {isTextCopied(test.example) ? 'Copied!' : 'Copy'}
                               </button>
                           </div>
                           
                                                        {/* Test Code Content */}
                             <div className="flex">
                               <div className="bg-gray-800 text-gray-400 px-3 py-4 text-sm font-mono leading-6 select-none border-r border-gray-700 min-w-[3rem]">
                                 {test.example.split('\n').map((_: string, index: number) => (
                                   <div key={index} className="text-right pr-2">
                                     {index + 1}
                                   </div>
                                 ))}
                               </div>
                               <div className="flex-1 bg-gray-900 text-gray-100 p-4 overflow-x-auto">
                                 <pre className="text-sm font-mono leading-6 whitespace-pre">
                                   <code>
                                     {formatCodeWithSyntaxHighlighting(test.example, selectedFile?.name)}
                                   </code>
                                 </pre>
                               </div>
                             </div>
                         </div>
                       )}
                     </>
                   )}
                 </div>
               ))}
             </div>
           </div>
         )}
      </div>
    );
  };

  // Basic loading state
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
            <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <h3 className="text-xl font-bold text-red-900">GitHub Connection Error</h3>
              <p className="text-red-700 mt-1">{connectionError}</p>
              <p className="text-red-600 mt-3 text-sm">
                Please ensure your GitHub account is connected via the <strong>{GITHUB_APP_NAME}</strong> GitHub App and that it has the necessary permissions to access your repositories.
              </p>
              <button
                onClick={() => navigate('/dashboard/settings?tab=github')}
                className="mt-6 inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
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
              <h3 className="text-xl font-bold text-yellow-800">GitHub Not Connected</h3>
              <p className="text-yellow-700 mt-2 text-base">
                To browse your repositories and their code, please connect your GitHub account.
              </p>
              <button
                onClick={() => navigate('/dashboard/settings?tab=integrations')}
                className="mt-6 inline-flex items-center px-5 py-2.5 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
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
                      <span className="text-gray-700 font-medium">{selectedGitHubRepo?.name}</span>
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gitHubConnectionStatus.details?.accessibleRepos?.map((repo: any) => (
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Browser View */}
            {view === 'browser' && (
              <div className="flex h-full">
                {/* Left Sidebar - File Tree */}
                <div className={`bg-gray-50 border-r border-gray-200 transition-all duration-300 ${isSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-80'}`}>
                  {/* File Tree Header */}
                  <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center text-sm text-gray-600 overflow-hidden">
                        <button onClick={() => fetchGitHubRepoTree(selectedGitHubRepo!, '', activeBranch)} className="hover:underline font-medium text-gray-700 whitespace-nowrap truncate">
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
                              onClick={() => {
                                setActiveTab(tabName as any);
                                // Fetch documentation when documentation tab is clicked
                                if (tabName === 'documentation' && selectedFile && selectedGitHubRepo) {
                                  const [owner, repo] = selectedGitHubRepo.full_name.split('/');
                                  fetchFileSummary(owner, repo, selectedFile.path);
                                }
                              }}
                              className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm 
                                          ${activeTab === tabName
                                            ? 'border-current text-current'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                              style={{borderColor: activeTab === tabName ? brandColor : 'transparent', color: activeTab === tabName ? brandColor : undefined}}
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
                          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            {/* Enhanced Code Header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                              <div className="flex items-center">
                                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg mr-3">
                                  {getFileIcon(selectedFile?.name || '', 'file')}
                                </div>
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900">
                                    {selectedFile?.name || 'File Content'}
                                  </h3>
                                  <p className="text-xs text-gray-500">
                                    {selectedFile?.path || 'File path'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                  {selectedFile?.name?.split('.').pop()?.toUpperCase() || 'TXT'}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(selectedFileContent)}
                                  className={`inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md transition-colors ${
                                    isTextCopied(selectedFileContent) 
                                      ? 'text-green-700 bg-green-50 border-green-300' 
                                      : 'text-gray-700 bg-white hover:bg-gray-50'
                                  } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                                  style={{borderColor: isTextCopied(selectedFileContent) ? '#10b981' : brandColor}}
                                  title={isTextCopied(selectedFileContent) ? "Copied!" : "Copy code"}
                                >
                                  {isTextCopied(selectedFileContent) ? (
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                  ) : (
                                    <Copy className="h-4 w-4 mr-1" />
                                  )}
                                  {isTextCopied(selectedFileContent) ? 'Copied!' : 'Copy'}
                                </button>
                              </div>
                            </div>
                            
                            {/* Enhanced Code Content with Line Numbers */}
                            <div className="relative flex">
                              {/* Line Numbers */}
                              <div className="bg-gray-800 text-gray-400 px-3 py-4 text-sm font-mono leading-6 select-none border-r border-gray-700 min-w-[3rem]">
                                {selectedFileContent.split('\n').map((_, index) => (
                                  <div key={index} className="text-right pr-2">
                                    {index + 1}
                                  </div>
                                ))}
                              </div>
                              
                              {/* Code Content with Syntax Highlighting */}
                              <div className="flex-1 bg-gray-900 text-gray-100 p-4 overflow-x-auto">
                                <pre className="text-sm font-mono leading-6 whitespace-pre">
                                  <code className="language-auto">
                                    {formatCodeWithSyntaxHighlighting(selectedFileContent, selectedFile?.name)}
                                  </code>
                                </pre>
                              </div>
                            </div>
                            
                            {/* Enhanced File Stats Footer */}
                            <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <span className="flex items-center">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {selectedFileContent.split('\n').length} lines
                                </span>
                                <span className="flex items-center">
                                  <Package className="h-3 w-3 mr-1" />
                                  {new Blob([selectedFileContent]).size} bytes
                                </span>
                                <span>UTF-8</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="flex items-center">
                                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                  Ready
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : activeTab === 'documentation' ? (
                          <div className="p-4 prose max-w-none">{renderDocumentation()}</div>
                        ) : activeTab === 'lineage' ? (
                          <div className="p-4 text-gray-500">Lineage view for {selectedFile.path} - Coming soon!</div>
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
} 