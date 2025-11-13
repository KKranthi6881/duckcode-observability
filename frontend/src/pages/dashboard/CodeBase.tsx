import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ChevronRight, 
  Search,
  Github,
  Lock,
  Loader2,
  Star,
  GitFork,
  Settings,
  Database,
  AlertTriangle,
  File
} from 'lucide-react';
import { useAuth } from '../../features/auth/contexts/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { getOrganizationRepositories } from '../../services/repositoryService';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { processRepositoryForInsights, getRepositorySummaryStatus, getProcessingStatus } from '../../services/githubService';
import { sequentialProcessingService } from '../../services/sequential-processing.service';
import { FileTreeModern } from '../../components/FileTreeModern';
import { EnhancedCodeViewer } from '../../components/EnhancedCodeViewer';
import { DocumentationViewer } from '../../components/DocumentationViewer';
import { RepositoryGrid } from '../../components/RepositoryGrid';
import { CodeLineageView } from '../../components/lineage/CodeLineageView';
import { ExtractionStatus } from '../../components/metadata/ExtractionStatus';
import { ManifestUploadModal } from '../../components/metadata/ManifestUploadModal';

import { useProcessingStatus } from '../../context/ProcessingStatusContext';

const brandColor = "#2AB7A9";

export function CodeBase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { processingStatuses, clearStatus } = useProcessingStatus();

  // Debug logging
  React.useEffect(() => {
    console.log('CodeBase - Processing statuses:', processingStatuses);
    console.log('CodeBase - Number of processing statuses:', Object.keys(processingStatuses).length);
  }, [processingStatuses]);
  
  // State for admin-connected repositories
  const [repositories, setRepositories] = useState<any[]>([]);
  const [isLoadingConnection, setIsLoadingConnection] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<any>(null);
  
  // Fetch admin-connected repositories
  useEffect(() => {
    const fetchRepositories = async () => {
      if (!session?.access_token) {
        setIsLoadingConnection(false);
        return;
      }

      try {
        setIsLoadingConnection(true);
        setConnectionError(null);
        
        const repos = await getOrganizationRepositories(session.access_token);
        console.log('CodeBase - Fetched admin-connected repositories:', repos);
        console.log('CodeBase - Number of repositories:', repos.length);
        console.log('CodeBase - Repository details:', JSON.stringify(repos, null, 2));
        setRepositories(repos);
      } catch (err) {
        console.error('Error fetching repositories:', err);
        setConnectionError('Failed to load repositories. Please try again.');
      } finally {
        setIsLoadingConnection(false);
      }
    };

    fetchRepositories();
  }, [session]);

  const { copyToClipboard, isTextCopied } = useCopyToClipboard();

  // File tree state
  const [activeBranch, setActiveBranch] = useState('main');
  const [fileTree, setFileTree] = useState<any>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [fileContentError, setFileContentError] = useState<string | null>(null);
  const [selectedFileSummary, setSelectedFileSummary] = useState<any>(null);
  const [isLoadingFileSummary, setIsLoadingFileSummary] = useState(false);
  const [fileSummaryError, setFileSummaryError] = useState<string | null>(null);
  
  const handleRepositorySelect = async (repo: any) => {
    setSelectedGitHubRepo(repo);
    setView('browser');
    setFileTree(null);
    setIsLoadingTree(true);
    setTreeError(null);
    
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      // Fetch file tree from universal API (works for both GitHub and GitLab)
      const owner = repo.repository_owner;
      const repoName = repo.repository_name;
      const branch = repo.branch || 'main';
      const provider = repo.provider || 'github';
      
      // Update active branch to match repository's branch
      setActiveBranch(branch);
      
      console.log(`[CodeBase] Fetching tree for ${provider} repo: ${owner}/${repoName}, branch: ${branch}`);
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${API_BASE_URL}/api/repos/${owner}/${repoName}/tree?ref=${branch}&recursive=true`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file tree: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle different response formats
      const treeData = data.tree || data;
      console.log(`[CodeBase] ===== TREE DATA DEBUG =====`);
      console.log(`[CodeBase] Raw response:`, data);
      console.log(`[CodeBase] Tree data length:`, treeData?.length);
      console.log(`[CodeBase] First 5 items:`, treeData?.slice(0, 5));
      console.log(`[CodeBase] Item types:`, treeData?.slice(0, 10).map((item: any) => ({ name: item.name, type: item.type, path: item.path })));
      
      // Transform tree data into our file tree format
      const tree = buildFileTree(treeData);
      console.log(`[CodeBase] Built tree:`, tree);
      console.log(`[CodeBase] Tree children count:`, tree?.[0]?.children?.length);
      console.log(`[CodeBase] ===== END DEBUG =====`);
      setFileTree(tree);
    } catch (error) {
      console.error('Error fetching file tree:', error);
      setTreeError('Failed to load repository files');
    } finally {
      setIsLoadingTree(false);
    }
  };
  
  // Helper function to build file tree from tree data (works for both GitHub and GitLab)
  const buildFileTree = (githubTree: any[], level: number = 0): any[] => {
    const root: any = { name: '/', path: '', type: 'folder', children: [], isExpanded: true, level: 0 };
    
    githubTree.forEach((item: any) => {
      // Process both files (blob) and directories (tree)
      if (item.type === 'blob' || item.type === 'file') {
        // It's a file
        const parts = item.path.split('/');
        let current = root;
        
        // Build folder structure
        for (let i = 0; i < parts.length - 1; i++) {
          const folderName = parts[i];
          const folderPath = parts.slice(0, i + 1).join('/');
          let folder = current.children.find((c: any) => c.name === folderName && c.type === 'folder');
          
          if (!folder) {
            folder = {
              id: folderPath,
              name: folderName,
              path: folderPath,
              type: 'folder',
              children: [],
              isExpanded: false,
              level: i + 1
            };
            current.children.push(folder);
          }
          current = folder;
        }
        
        // Add file
        current.children.push({
          id: item.path,
          name: parts[parts.length - 1],
          path: item.path,
          type: 'file',
          size: item.size,
          isExpanded: false,
          children: [],
          level: parts.length
        });
      } else if (item.type === 'tree' || item.type === 'dir') {
        // It's a directory - add it directly to root
        root.children.push({
          id: item.path,
          name: item.name,
          path: item.path,
          type: 'folder',
          children: [],
          isExpanded: false,
          level: 1
        });
      }
    });
    
    // Sort: folders first, then files, both alphabetically
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'folder' ? -1 : 1;
      });
      nodes.forEach(node => {
        if (node.children.length > 0) {
          sortNodes(node.children);
        }
      });
    };
    
    sortNodes(root.children);
    return root.children;
  };
  
  // Helper function to toggle folder expansion
  const toggleFolderExpansion = (tree: any[], folderPath: string): any[] => {
    return tree.map(node => {
      if (node.path === folderPath && node.type === 'folder') {
        return { ...node, isExpanded: !node.isExpanded };
      }
      if (node.children && node.children.length > 0) {
        return { ...node, children: toggleFolderExpansion(node.children, folderPath) };
      }
      return node;
    });
  };
  
  // Helper function to load folder contents
  const loadFolderContents = async (folder: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const owner = selectedGitHubRepo.repository_owner;
      const repoName = selectedGitHubRepo.repository_name;
      const branch = selectedGitHubRepo.branch || 'main';
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await fetch(
        `${API_BASE_URL}/api/repos/${owner}/${repoName}/tree?ref=${branch}&path=${folder.path}&recursive=false`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch folder contents: ${response.statusText}`);
      }
      
      const data = await response.json();
      const treeData = data.tree || data;
      
      // Build children for this folder
      const children: any[] = [];
      treeData.forEach((item: any) => {
        if (item.type === 'blob' || item.type === 'file') {
          children.push({
            id: item.path,
            name: item.name,
            path: item.path,
            type: 'file',
            size: item.size,
            isExpanded: false,
            children: [],
            level: folder.level + 1
          });
        } else if (item.type === 'tree' || item.type === 'dir') {
          children.push({
            id: item.path,
            name: item.name,
            path: item.path,
            type: 'folder',
            children: [],
            isExpanded: false,
            childrenLoaded: false,
            level: folder.level + 1
          });
        }
      });
      
      // Sort children
      children.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'folder' ? -1 : 1;
      });
      
      // Update the tree with the new children
      const updateTreeWithChildren = (tree: any[], folderPath: string, newChildren: any[]): any[] => {
        return tree.map(node => {
          if (node.path === folderPath && node.type === 'folder') {
            return { ...node, children: newChildren, childrenLoaded: true, isExpanded: true };
          }
          if (node.children && node.children.length > 0) {
            return { ...node, children: updateTreeWithChildren(node.children, folderPath, newChildren) };
          }
          return node;
        });
      };
      
      setFileTree(updateTreeWithChildren(fileTree, folder.path, children));
    } catch (error) {
      console.error('Error loading folder contents:', error);
      setTreeError('Failed to load folder contents');
    }
  };
  
  // Wrapper for folder toggle that matches FileTree signature
  const handleFolderToggle = (folderPath: string) => {
    const updatedTree = toggleFolderExpansion(fileTree, folderPath);
    setFileTree(updatedTree);
  };

  const handleTreeItemClick = async (file: any) => {
    if (file.type === 'folder') {
      // It's a folder - toggle expansion and fetch contents if not loaded
      const updatedTree = toggleFolderExpansion(fileTree, file.path);
      setFileTree(updatedTree);
      
      // If folder hasn't been loaded yet, fetch its contents
      if (!file.childrenLoaded) {
        await loadFolderContents(file);
      }
    } else if (file.type === 'file' || file.type === 'blob') {
      // It's a file, fetch its content
      setSelectedFile(file);
      setIsLoadingFileContent(true);
      setFileContentError(null);
      
      try {
        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No active session');
        }

        const owner = selectedGitHubRepo.repository_owner;
        const repoName = selectedGitHubRepo.repository_name;
        const branch = selectedGitHubRepo.branch || 'main';
        
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(
          `${API_BASE_URL}/api/repos/${owner}/${repoName}/file/${file.path}?ref=${branch}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch file content: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Decode base64 content
        const content = atob(data.content.replace(/\s/g, ''));
        setSelectedFileContent(content);
      } catch (error) {
        console.error('Error fetching file content:', error);
        setFileContentError('Failed to load file content');
      } finally {
        setIsLoadingFileContent(false);
      }
    }
  };
  
  const fetchFileSummary = async (owner: string, repo: string, filePath: string) => {
    // TODO: Implement documentation fetching
    console.log('Fetching summary for:', owner, repo, filePath);
  };

  // Handle URL parameters - auto-select repo and file
  useEffect(() => {
    const repoId = searchParams.get('repo');
    
    if (repoId && repositories.length > 0 && !selectedGitHubRepo) {
      console.log('[CodeBase] Auto-selecting repo from URL:', repoId);
      const repo = repositories.find(r => r.id === repoId);
      if (repo) {
        console.log('[CodeBase] Found repo:', repo);
        handleRepositorySelect(repo);
      } else {
        console.warn('[CodeBase] Repo not found:', repoId);
      }
    }
  }, [searchParams, repositories, selectedGitHubRepo, handleRepositorySelect]);

  // Auto-select file when tree is loaded
  useEffect(() => {
    const filePath = searchParams.get('file');
    if (filePath && fileTree && !selectedFile) {
      console.log('[CodeBase] Auto-selecting file from URL:', filePath);
      // Find the file in the tree
      const file = fileTree.find((item: any) => item.path === filePath);
      if (file) {
        console.log('[CodeBase] Found file, selecting:', file);
        handleTreeItemClick(file);
      } else {
        console.warn('[CodeBase] File not found in tree:', filePath);
      }
    }
  }, [searchParams, fileTree, selectedFile, handleTreeItemClick]);

  // UI State
  const [view, setView] = useState<'repos' | 'browser'>('repos');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'documentation' | 'code-lineage'>('code');
  
  // Metadata extraction state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  
  // State has been moved to AnalysisSetup.tsx or is no longer needed here
  const [repoSummaryStatus, setRepoSummaryStatus] = useState<Record<string, { hasSummaries: boolean; summaryCount: number; lastSummaryDate?: string }>>({});
  const [summaryGenerationError, setSummaryGenerationError] = useState<string | null>(null);
  
  // Progress tracking state
  const [repoProgressStatus, setRepoProgressStatus] = useState<Record<string, {
    progress: number;
    totalFiles: number;
    completed: number;
    failed: number;
    pending: number;
    isPolling: boolean;
    // Sequential processing fields
    sequentialJobId?: string;
    sequentialStatus?: 'pending' | 'processing' | 'completed' | 'error';
    sequentialCurrentPhase?: string;
    sequentialPhases?: {
      documentation?: { status: string; progress: number };
      vectors?: { status: string; progress: number };
      lineage?: { status: string; progress: number };
      dependencies?: { status: string; progress: number };
      analysis?: { status: string; progress: number };
    };
  }>>({});
  
  // Polling intervals for tracking progress
  const [pollingIntervals, setPollingIntervals] = useState<Record<string, NodeJS.Timeout>>({});
  
  // Sequential processing intervals
  const [sequentialPollingIntervals, setSequentialPollingIntervals] = useState<Record<string, NodeJS.Timeout>>({});

  // Handle GitHub Connection
  const handleConnectGitHub = () => {
    navigate('/admin'); // GitHub settings moved to admin portal
  };

  // Handle repository selection with view change
  const handleGitHubRepoClick = (repo: any) => {
    handleRepositorySelect(repo);
    setView('browser');
  };

  // Start polling for repository processing progress
  const startProgressPolling = (repoId: string, repoFullName: string) => {
    console.log(`Starting progress polling for ${repoFullName}`);
    
    // Initialize progress state
    setRepoProgressStatus(prev => ({
      ...prev,
      [repoId]: {
        progress: 0,
        totalFiles: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        isPolling: true
      }
    }));

    const pollProgress = async () => {
      try {
        const status = await getProcessingStatus(repoFullName);
        console.log(`Progress update for ${repoFullName}:`, status);
        
        // Handle both legacy and new comprehensive status formats
        let formattedStatus;
        if (status.overallProgress !== undefined) {
          // New comprehensive format
          formattedStatus = {
            ...status,
            isPolling: true,
            // Legacy compatibility for existing UI
            progress: status.overallProgress,
            completed: status.overallCompleted,
            totalFiles: status.totalFiles,
            failed: (status.documentation?.failed || 0) + (status.vectors?.failed || 0),
            pending: (status.documentation?.pending || 0) + (status.vectors?.pending || 0)
          };
        } else {
          // Legacy format
          formattedStatus = {
            progress: status.progress || 0,
            totalFiles: status.totalFiles || 0,
            completed: status.completed || 0,
            failed: status.failed || 0,
            pending: status.pending || 0,
            isPolling: true
          };
        }
        
        setRepoProgressStatus(prev => ({
          ...prev,
          [repoId]: formattedStatus
        }));

        // Enhanced completion detection for separate tracking
        let isComplete = false;
        
        if (status.overallProgress !== undefined) {
          // New comprehensive format - check if BOTH documentation and vectors are complete
          const docComplete = status.documentation?.progress >= 100 && status.documentation?.pending === 0;
          const vectorComplete = status.vectors?.progress >= 100 && status.vectors?.pending === 0;
          const overallComplete = status.overallProgress >= 100;
          
          // Stop polling only when everything is truly complete
          isComplete = overallComplete && docComplete && vectorComplete;
          
          console.log(`Completion check for ${repoFullName}:`, {
            overallProgress: status.overallProgress,
            docComplete,
            vectorComplete,
            overallComplete,
            finalDecision: isComplete
          });
        } else {
          // Legacy format
          const overallProgress = formattedStatus.progress;
          isComplete = overallProgress >= 100 || 
            (formattedStatus.totalFiles > 0 && formattedStatus.pending === 0);
        }
        
        if (isComplete) {
          console.log(`Processing complete for ${repoFullName}, stopping polling`);
          
          // Mark as completed and stop polling
          setRepoProgressStatus(prev => ({
            ...prev,
            [repoId]: {
              ...formattedStatus,
              progress: 100,
              pending: 0,
              isPolling: false
            }
          }));
          
          stopProgressPolling(repoId);
          
          // Update repository summary status
          const [owner, repoName] = repoFullName.split('/');
          try {
            const summaryStatus = await getRepositorySummaryStatus(owner, repoName);
            setRepoSummaryStatus(prev => ({
              ...prev,
              [repoId]: summaryStatus
            }));
          } catch (error) {
            console.error('Error updating summary status:', error);
          }
        }
      } catch (error) {
        console.error(`Error polling progress for ${repoFullName}:`, error);
        // If it's a 404 error, the repository hasn't been processed yet, continue polling
        // For other errors, continue polling but maybe reduce frequency in the future
        if (error instanceof Error && error.message.includes('404')) {
          console.log(`Repository ${repoFullName} not yet in processing queue, continuing to poll...`);
        }
      }
    };

    // Poll immediately, then every 3 seconds (reduced frequency for better performance)
    pollProgress();
    const interval = setInterval(pollProgress, 3000);
    
    setPollingIntervals(prev => ({
      ...prev,
      [repoId]: interval
    }));
  };

  // Stop polling for repository processing progress
  const stopProgressPolling = (repoId: string) => {
    const interval = pollingIntervals[repoId];
    if (interval) {
      clearInterval(interval);
      setPollingIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[repoId];
        return newIntervals;
      });
    }
    
    setRepoProgressStatus(prev => ({
      ...prev,
      [repoId]: {
        ...prev[repoId],
        isPolling: false
      }
    }));
  };

  // Handle repository analysis - navigate to setup page for language selection
  const handleAnalyzeRepository = async (repoFullName: string, useSequential: boolean = true) => {
    console.log(`🎯 handleAnalyzeRepository called for: ${repoFullName}, useSequential: ${useSequential}`);
    
    // Always navigate to setup page for language and prompt configuration
    const [owner, repo] = repoFullName.split('/');
    navigate(`/dashboard/code/analyze/${owner}/${repo}`);
  };

  // Handle sequential processing
  const handleSequentialProcessing = async (repoFullName: string) => {
    try {
      console.log(`🚀 Starting sequential processing for ${repoFullName}`);
      console.log('Session access token exists:', !!session?.access_token);
      
      if (!session?.access_token) {
        console.error('❌ No authentication token available');
        alert('Authentication required. Please log in again.');
        return;
      }

      console.log('📡 Calling sequential processing service...');
      console.log('🔍 DEBUG: About to call startSequentialProcessing with:', {
        repoFullName,
        hasToken: !!session.access_token,
        tokenLength: session.access_token?.length
      });
      
      // Start sequential processing
      const response = await sequentialProcessingService.startSequentialProcessing(
        repoFullName, 
        session.access_token
      );
      
      console.log('🔍 DEBUG: Sequential processing response received:', response);

      console.log('✅ Sequential processing started successfully:', response);

      // Find repo ID for status tracking
      const repo = repositories.find(
        (r) => `${r.repository_owner}/${r.repository_name}` === repoFullName
      );
      
      if (!repo) {
        throw new Error('Repository not found');
      }

      const repoId = repo.id.toString();

      // Update status with sequential processing info
      setRepoProgressStatus(prev => ({
        ...prev,
        [repoId]: {
          ...prev[repoId],
          sequentialJobId: response.jobId,
          sequentialStatus: 'processing',
          sequentialCurrentPhase: response.currentPhase,
          sequentialPhases: {
            documentation: { status: 'processing', progress: 0 },
            vectors: { status: 'pending', progress: 0 },
            lineage: { status: 'pending', progress: 0 },
            dependencies: { status: 'pending', progress: 0 },
            analysis: { status: 'pending', progress: 0 }
          },
          isPolling: true
        }
      }));

      // Start polling for sequential status
      startSequentialPolling(repoId, repoFullName);

    } catch (error) {
      console.error('❌ Error starting sequential processing:', error);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        alert(`Failed to start processing: ${error.message}`);
      } else {
        alert('Failed to start processing. Please check the console for details.');
      }
    }
  };

  // Start sequential processing polling
  const startSequentialPolling = (repoId: string, repoFullName: string) => {
    console.log(`Starting sequential polling for ${repoFullName}`);
    
    const pollSequentialStatus = async () => {
      try {
        if (!session?.access_token) return;

        const status = await sequentialProcessingService.getSequentialStatus(
          repoFullName, 
          session.access_token
        );

        console.log(`Sequential status update for ${repoFullName}:`, status);
        
        setRepoProgressStatus(prev => ({
          ...prev,
          [repoId]: {
            ...prev[repoId],
            sequentialJobId: status.jobId,
            sequentialStatus: status.status,
            sequentialCurrentPhase: status.currentPhase,
            sequentialPhases: status.phases,
            isPolling: status.status === 'processing'
          }
        }));

        // Stop polling if completed or error
        if (status.status === 'completed' || status.status === 'error') {
          console.log(`Sequential processing ${status.status} for ${repoFullName}, stopping polling`);
          stopSequentialPolling(repoId);
        }

      } catch (error) {
        console.error('Error polling sequential status:', error);
        stopSequentialPolling(repoId);
      }
    };

    // Start polling
    pollSequentialStatus();
    const interval = setInterval(pollSequentialStatus, 5000);
    
    setSequentialPollingIntervals(prev => ({
      ...prev,
      [repoId]: interval
    }));
  };

  // Stop sequential processing polling
  const stopSequentialPolling = (repoId: string) => {
    const interval = sequentialPollingIntervals[repoId];
    if (interval) {
      clearInterval(interval);
      setSequentialPollingIntervals(prev => {
        const newIntervals = { ...prev };
        delete newIntervals[repoId];
        return newIntervals;
      });
    }
  };

  // Handle status modal
  const handleStatusModalOpen = (repoFullName: string) => {
    console.log('Opening status modal for repo:', repoFullName);
    // You can implement a modal here to show detailed status
  };

  // Clear summary error
  const handleClearSummaryError = () => {
    setSummaryGenerationError(null);
  };

  // Handle documentation updates
  const handleUpdateDocumentation = async (filePath: string, section: string, updatedContent: any) => {
    console.log('=== HANDLE UPDATE DOCUMENTATION DEBUG ===');
    console.log('FilePath:', filePath);
    console.log('Section:', section);
    console.log('Updated content:', updatedContent);
    console.log('Selected GitHub repo:', selectedGitHubRepo);
    console.log('Session access token exists:', !!session?.access_token);
    
    if (!selectedGitHubRepo) {
      console.error('No selected GitHub repo');
      return;
    }

    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const [owner, repo] = selectedGitHubRepo.full_name.split('/');
    
    console.log('API call details:', {
      url: `${API_BASE_URL}/api/documentation/update`,
      owner,
      repo,
      filePath,
      section,
      contentType: typeof updatedContent,
      contentPreview: JSON.stringify(updatedContent).substring(0, 100)
    });
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/documentation/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          owner,
          repo,
          filePath,
          section,
          content: updatedContent,
        }),
      });

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to update documentation: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Documentation updated successfully:', result);
      
      // Refresh the documentation data to show the updated content
      console.log('Refreshing documentation data after successful update...');
      await fetchFileSummary(owner, repo, filePath);
      
    } catch (error) {
      console.error('Error updating documentation:', error);
      throw error;
    }
  };

  // Load repository summary status for all repositories
  const loadRepositorySummaryStatus = async () => {
    if (repositories.length === 0) return;

    try {
      const statusPromises = repositories.map(async (repo) => {
        try {
          const owner = repo.repository_owner;
          const repoName = repo.repository_name;
          const summaryStatus = await getRepositorySummaryStatus(owner, repoName);
          return { repoId: repo.id.toString(), status: summaryStatus };
        } catch (error) {
          console.error(`Error loading summary status for ${repo.full_name}:`, error);
          return { repoId: repo.id.toString(), status: { hasSummaries: false, summaryCount: 0 } };
        }
      });

      const results = await Promise.all(statusPromises);
      
      const statusMap = results.reduce((acc, { repoId, status }) => {
        acc[repoId] = status;
        return acc;
      }, {} as Record<string, { hasSummaries: boolean; summaryCount: number; lastSummaryDate?: string }>);

      setRepoSummaryStatus(statusMap);
    } catch (error) {
      console.error('Error loading repository summary statuses:', error);
    }
  };

  // Load processing status for repositories that might have been previously processed
  const loadRepositoryProcessingStatus = async () => {
    if (repositories.length === 0) return;

    try {
      const statusPromises = repositories.map(async (repo) => {
        try {
          const repoFullName = `${repo.repository_owner}/${repo.repository_name}`;
          const processingStatus = await getProcessingStatus(repoFullName);
          console.log(`Status for ${repoFullName}:`, processingStatus);
          
          // Handle both legacy and new comprehensive status formats
          let formattedStatus;
          if (processingStatus.overallProgress !== undefined || processingStatus.documentation) {
            // New comprehensive format with lineage support
            formattedStatus = {
              ...processingStatus,
              isPolling: false,
              // Legacy compatibility fields
              progress: processingStatus.overallProgress || 0,
              completed: processingStatus.overallCompleted || 0,
              totalFiles: processingStatus.totalFiles || 0,
              failed: (processingStatus.documentation?.failed || 0) + (processingStatus.vectors?.failed || 0) + (processingStatus.lineage?.failed || 0),
              pending: (processingStatus.documentation?.pending || 0) + (processingStatus.vectors?.pending || 0) + (processingStatus.lineage?.pending || 0)
            };
          } else {
            // Legacy format - add empty lineage data for consistency
            formattedStatus = {
              ...processingStatus,
              isPolling: false,
              lineage: null  // Explicitly set to null for legacy repos
            };
          }
          
          return { 
            repoId: repo.id.toString(), 
            status: formattedStatus
          };
        } catch (error) {
          // If repository hasn't been processed, that's expected
          console.log(`No processing status found for ${repo.full_name} (expected if not processed)`);
          return null;
        }
      });

      const results = await Promise.all(statusPromises);
      
      const progressMap = results.reduce((acc, result) => {
        if (result) {
          acc[result.repoId] = result.status;
        }
        return acc;
      }, {} as Record<string, any>);

      setRepoProgressStatus(progressMap);
    } catch (error) {
      console.error('Error loading repository processing statuses:', error);
    }
  };

  // Load repository summary status when repositories are fetched
  React.useEffect(() => {
    if (repositories.length > 0) {
      loadRepositorySummaryStatus();
      loadRepositoryProcessingStatus();
    }
  }, [repositories]);

  // Cleanup polling intervals on unmount
  React.useEffect(() => {
    return () => {
      Object.values(pollingIntervals).forEach(interval => {
        clearInterval(interval);
      });
      Object.values(sequentialPollingIntervals).forEach(interval => {
        clearInterval(interval);
      });
    };
  }, [pollingIntervals, sequentialPollingIntervals]);

  // Basic loading state
  if (isLoadingConnection) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#ff6a3c] mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Loading GitHub Connection</h3>
            <p className="text-muted-foreground">Checking your repository access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (connectionError) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-xl p-8 max-w-2xl w-full">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-600/20 border border-red-600/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">Failed to Load Repositories</h3>
              <p className="text-muted-foreground mb-4">{connectionError}</p>
              <p className="text-muted-foreground text-sm mb-6">
                Contact your administrator if repositories should be available.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Settings className="h-4 w-4 mr-2" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Empty state - no repositories connected
  if (repositories.length === 0 && !isLoadingConnection) {
     return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-xl p-8 max-w-2xl w-full">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-600/20 border border-blue-600/30 rounded-full flex items-center justify-center">
                <Database className="h-6 w-6 text-blue-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">No Repositories Connected</h3>
              <p className="text-muted-foreground mb-6">
                Your organization hasn't connected any GitHub repositories yet. Contact your administrator to add repositories.
              </p>
              <button
                onClick={() => navigate('/admin')}
                className="inline-flex items-center px-5 py-2.5 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#d94a1e] transition-colors"
              >
                <Settings className="h-4 w-4 mr-2" />
                Go to Admin Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connected State
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* AI-Style Central Search - Always visible */}
      <div className={`flex-shrink-0 flex items-center justify-center px-6 transition-all duration-300 py-4`}>
        {isAuthLoading ? (
          <div className="bg-card border border-border rounded-xl p-8">
            <div className="flex flex-col items-center text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff6a3c] mb-4" />
              <span className="text-foreground font-medium">Loading...</span>
            </div>
          </div>
        ) : !session ? (
          <div className="flex items-center justify-center h-96">
            <div className="bg-card border border-border rounded-xl p-8 text-center max-w-md">
              <div className="w-12 h-12 bg-orange-600/20 border border-orange-600/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Authentication Required</h3>
              <p className="text-muted-foreground mb-6">Please log in to access your repositories.</p>
              <button
                onClick={() => navigate('/auth/signin')}
                className="inline-flex items-center px-6 py-2.5 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#d94a1e] transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Repository List View */}
            {view === 'repos' && (
              <>
                {/* Header */}
                <div className="flex justify-between items-center">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Code Intelligence</h1>
                    <p className="text-muted-foreground">Browse and analyze your connected repositories</p>
                  </div>
                </div>

                {/* Repository Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {repositories.map((repo) => (
                    <div key={repo.id} className="space-y-3">
                      {/* Repository Card */}
                      <div
                        onClick={() => handleRepositorySelect(repo)}
                        className="bg-card border border-border rounded-xl p-6 hover:border-[#ff6a3c]/50 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-600/20 border border-blue-600/30 rounded-lg">
                              <Database className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{repo.repository_name}</h3>
                              <p className="text-sm text-muted-foreground">{repo.repository_owner}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{repo.total_objects || 0} objects</span>
                          <span>{repo.total_files || 0} files</span>
                        </div>
                      </div>
                      
                      {/* Extraction Status */}
                      <ExtractionStatus
                        connection={{
                          id: repo.id,
                          repository_name: repo.repository_name,
                          status: (repo.status as any) || 'connected',
                          error_message: repo.error_message,
                          manifest_uploaded: repo.manifest_uploaded,
                          extraction_tier: (repo.extraction_tier as any),
                          models_count: repo.models_count,
                          sources_count: repo.sources_count,
                          column_lineage_count: repo.column_lineage_count
                        }}
                        onUploadManifest={(connectionId) => {
                          setSelectedConnectionId(connectionId);
                          setUploadModalOpen(true);
                        }}
                        onRetry={async (connectionId) => {
                          try {
                            const response = await fetch(
                              `/api/metadata/extract/${connectionId}`,
                              {
                                method: 'POST',
                                credentials: 'include'
                              }
                            );
                            if (response.ok) {
                              const repos = await getOrganizationRepositories(session?.access_token || '');
                              setRepositories(repos);
                            } else {
                              console.error('Extraction retry failed');
                            }
                          } catch (error) {
                            console.error('Retry extraction error:', error);
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Browser View - Full Code Browser */}
            {view === 'browser' && selectedGitHubRepo && (
              <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 40px)' }}>
                <div className="flex h-full w-full">
                  {/* Modern File Tree with Built-in Resize */}
                  {fileTree ? (
                    <FileTreeModern 
                      fileTree={fileTree}
                      isLoadingTree={isLoadingTree}
                      treeError={treeError}
                      selectedFile={selectedFile}
                      searchQuery={searchQuery}
                      activeBranch={activeBranch}
                      selectedGitHubRepo={selectedGitHubRepo}
                      brandColor={brandColor}
                      onTreeItemClick={handleTreeItemClick}
                      onSearchChange={setSearchQuery}
                      onFolderToggle={handleFolderToggle}
                    />
                  ) : (
                    <div className="w-80 min-w-[240px] h-full border-r border-border bg-card flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-[#2AB7A9] mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Loading files...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Right Content Area */}
                  <div className="flex-1 flex flex-col bg-card min-w-0">
                    {selectedFile ? (
                      <>
                        {/* File Content Tabs */}
                        <div className="border-b border-border bg-card flex-shrink-0 px-3 py-1">
                          <nav className="flex space-x-3" aria-label="Tabs">
                            {[
                              { id: 'code', label: 'Code' },
                              { id: 'documentation', label: 'Documentation' },
                              { id: 'code-lineage', label: 'Code Lineage' }
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                onClick={() => {
                                  setActiveTab(tab.id as any);
                                  if (tab.id === 'documentation' && selectedFile && selectedGitHubRepo) {
                                    const owner = selectedGitHubRepo.repository_owner;
                                    const repo = selectedGitHubRepo.repository_name;
                                    fetchFileSummary(owner, repo, selectedFile.path);
                                  }
                                }}
                                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors
                                            ${activeTab === tab.id
                                              ? 'border-[#2AB7A9] text-[#2AB7A9]'
                                              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </nav>
                        </div>
                        
                        {/* File Content */}
                        <div className="flex-1 overflow-auto bg-muted min-h-0">
                          <div className="h-full w-full">
                            {activeTab === 'code' && selectedFile && (
                              <div className="h-full w-full p-2">
                                <EnhancedCodeViewer 
                                  selectedFile={selectedFile}
                                  selectedFileContent={selectedFileContent || ''}
                                  isLoadingFileContent={isLoadingFileContent}
                                  fileContentError={fileContentError}
                                  brandColor={brandColor}
                                  copyToClipboard={copyToClipboard}
                                  isTextCopied={isTextCopied}
                                />
                              </div>
                            )}
                            {activeTab === 'documentation' && selectedFile && (
                              <div className="h-full w-full p-2">
                                <DocumentationViewer 
                                  selectedFileName={selectedFile.name}
                                  selectedFilePath={selectedFile.path}
                                  selectedFileSummary={selectedFileSummary}
                                  isLoadingFileSummary={isLoadingFileSummary}
                                  fileSummaryError={fileSummaryError}
                                  brandColor={brandColor}
                                  copyToClipboard={copyToClipboard}
                                  isTextCopied={isTextCopied}
                                />
                              </div>
                            )}
                            {activeTab === 'code-lineage' && selectedGitHubRepo && (
                              <div className="h-full w-full">
                                <CodeLineageView 
                                  connectionId={selectedGitHubRepo.id}
                                  fileName={selectedFile?.name}
                                  filePath={selectedFile?.path}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-md">
                          <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mx-auto mb-6">
                            <File className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-xl font-semibold text-foreground mb-3">Select a file to view</h3>
                          <p className="text-muted-foreground leading-relaxed">
                            Choose a file from the tree on the left to view its content, documentation, and lineage.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {/* Manifest Upload Modal */}
        <ManifestUploadModal
          connectionId={selectedConnectionId || ''}
          repositoryName={
            repositories.find(r => r.id === selectedConnectionId)?.repository_name || ''
          }
          isOpen={uploadModalOpen}
          onClose={() => {
            setUploadModalOpen(false);
            setSelectedConnectionId(null);
          }}
          onSuccess={async () => {
            try {
              const repos = await getOrganizationRepositories(session?.access_token || '');
              setRepositories(repos);
            } catch (error) {
              console.error('Failed to refresh repositories:', error);
            }
          }}
        />
      </div>
    </div>
  );
}