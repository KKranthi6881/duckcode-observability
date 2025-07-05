import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  File,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../features/auth/contexts/AuthContext';
import { useGitHubRepository } from '../../hooks/useGitHubRepository';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { processRepositoryForInsights, getRepositorySummaryStatus, getGitHubConnectionStatus, getProcessingStatus } from '../../services/githubService';
import { sequentialProcessingService } from '../../services/sequential-processing.service';
import { FileTree } from '../../components/FileTree';
import { EnhancedCodeViewer } from '../../components/EnhancedCodeViewer';
import { DocumentationViewer } from '../../components/DocumentationViewer';
import { RepositoryGrid } from '../../components/RepositoryGrid';

import { useProcessingStatus } from '../../context/ProcessingStatusContext';

const GITHUB_APP_NAME = 'DuckCode-Observability';
const brandColor = "#2AB7A9";

export function CodeBase() {
  const navigate = useNavigate();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { processingStatuses, clearStatus } = useProcessingStatus();

  // Debug logging
  React.useEffect(() => {
    console.log('CodeBase - Processing statuses:', processingStatuses);
    console.log('CodeBase - Number of processing statuses:', Object.keys(processingStatuses).length);
  }, [processingStatuses]);
  
  // Use custom hooks for GitHub repository management and clipboard functionality
  const {
    gitHubConnectionStatus,
    isLoadingConnection,
    connectionError,
    selectedGitHubRepo,
    activeBranch,
    fileTree,
    isLoadingTree,
    treeError,
    selectedFile,
    selectedFileContent,
    isLoadingFileContent,
    fileContentError,
    selectedFileSummary,
    isLoadingFileSummary,
    fileSummaryError,
    handleRepositorySelect,
    handleTreeItemClick,
    toggleFolderExpansion,
    fetchFileSummary
  } = useGitHubRepository();
  
  const { copyToClipboard, isTextCopied } = useCopyToClipboard();

  // UI State
  const [view, setView] = useState<'repos' | 'browser'>('repos');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'code' | 'documentation' | 'lineage' | 'visual' | 'alerts'>('code');
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] = useState(false);
  const [autoPollingStarted, setAutoPollingStarted] = useState<string[]>([]);
  
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
    navigate('/dashboard/settings?tab=github');
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
      const repo = gitHubConnectionStatus?.details?.accessibleRepos?.find(
        (r: any) => r.full_name === repoFullName
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
    if (!gitHubConnectionStatus?.details?.accessibleRepos) return;

    try {
      const statusPromises = gitHubConnectionStatus.details.accessibleRepos.map(async (repo: any) => {
        try {
          const [owner, repoName] = repo.full_name.split('/');
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
    if (!gitHubConnectionStatus?.details?.accessibleRepos) return;

    try {
      const statusPromises = gitHubConnectionStatus.details.accessibleRepos.map(async (repo: any) => {
        try {
          const processingStatus = await getProcessingStatus(repo.full_name);
          console.log(`Status for ${repo.full_name}:`, processingStatus);
          
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

  // Auto-start polling for repositories that are currently processing
  const autoStartPollingForActiveProcessing = async () => {
    if (!gitHubConnectionStatus?.details?.accessibleRepos) return;

    for (const repo of gitHubConnectionStatus.details.accessibleRepos) {
      const repoId = repo.id.toString();
      const currentStatus = repoProgressStatus[repoId];
      
      // Check if this repo is currently processing but not being polled
      if (currentStatus && !currentStatus.isPolling) {
                 // Check for legacy processing (more comprehensive)
         const hasActiveProcessing = currentStatus.pending > 0 || 
           (currentStatus.progress > 0 && currentStatus.progress < 100) ||
           ((currentStatus as any).documentation?.pending > 0) ||
           ((currentStatus as any).vectors?.pending > 0) ||
           ((currentStatus as any).lineage?.pending > 0);
         
         // Check for sequential processing
         const hasActiveSequential = currentStatus.sequentialStatus === 'processing' ||
           currentStatus.sequentialJobId;
        
                 if (hasActiveProcessing) {
           console.log(`🔄 Auto-starting legacy polling for ${repo.full_name}`);
           startProgressPolling(repoId, repo.full_name);
           setAutoPollingStarted(prev => [...prev, `${repo.full_name}-legacy`]);
         }
         
         if (hasActiveSequential) {
           console.log(`🔄 Auto-starting sequential polling for ${repo.full_name}`);
           startSequentialPolling(repoId, repo.full_name);
           setAutoPollingStarted(prev => [...prev, `${repo.full_name}-sequential`]);
         }
      }
    }
  };

  // Load repository summary status when GitHub connection status changes
  React.useEffect(() => {
    if (gitHubConnectionStatus?.isConnected && gitHubConnectionStatus?.details?.accessibleRepos) {
      console.log('🔄 Loading repository statuses on mount/connection change...');
      loadRepositorySummaryStatus();
      loadRepositoryProcessingStatus();
    }
  }, [gitHubConnectionStatus]);

     // Auto-start polling after loading processing status
   React.useEffect(() => {
     if (gitHubConnectionStatus?.isConnected && Object.keys(repoProgressStatus).length > 0) {
       // Start polling immediately for active processes
       autoStartPollingForActiveProcessing();
     }
   }, [gitHubConnectionStatus, repoProgressStatus]);

     // Background refresh to detect processing started from other tabs/windows
   React.useEffect(() => {
     if (!gitHubConnectionStatus?.isConnected) return;

     // Initial quick refresh after 5 seconds, then every 30 seconds
     const initialTimer = setTimeout(async () => {
       console.log('🔄 Initial background refresh of processing status...');
       setIsBackgroundRefreshing(true);
       try {
         await loadRepositoryProcessingStatus();
       } catch (error) {
         console.error('Initial background refresh error:', error);
       } finally {
         setIsBackgroundRefreshing(false);
       }
     }, 5000);

     // Regular background refresh every 30 seconds
     const backgroundRefresh = setInterval(async () => {
       console.log('🔄 Regular background refresh of processing status...');
       setIsBackgroundRefreshing(true);
       try {
         await loadRepositoryProcessingStatus();
       } catch (error) {
         console.error('Background refresh error:', error);
       } finally {
         setIsBackgroundRefreshing(false);
       }
     }, 30000);

     return () => {
       clearTimeout(initialTimer);
       clearInterval(backgroundRefresh);
     };
   }, [gitHubConnectionStatus]);

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center text-center">
            <Loader2 className="h-12 w-12 animate-spin text-[#2AB7A9] mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading GitHub Connection</h3>
            <p className="text-gray-600">Checking your repository access...</p>
          </div>
        </div>
      </div>
    );
  }

  if (connectionError && (!gitHubConnectionStatus || !gitHubConnectionStatus.isConnected)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg border border-red-200 p-8 max-w-2xl w-full">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">GitHub Connection Error</h3>
              <p className="text-gray-700 mb-4">{connectionError}</p>
              <p className="text-gray-600 text-sm mb-6">
                Please ensure your GitHub account is connected via the <strong>{GITHUB_APP_NAME}</strong> GitHub App and that it has the necessary permissions to access your repositories.
              </p>
              <button
                onClick={() => navigate('/dashboard/settings?tab=github')}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg border border-yellow-200 p-8 max-w-2xl w-full">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Github className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">GitHub Not Connected</h3>
              <p className="text-gray-700 mb-6">
                To browse your repositories and their code, please connect your GitHub account.
              </p>
              <button
                onClick={() => navigate('/dashboard/settings?tab=integrations')}
                className="inline-flex items-center px-5 py-2.5 bg-[#2AB7A9] text-white rounded-lg hover:bg-[#24a497] transition-colors shadow-sm"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#2AB7A9] to-[#24a497] rounded-lg flex items-center justify-center">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Code Repository</h1>
                  <p className="text-xs text-gray-500">Explore and analyze your codebase</p>
                </div>
              </div>
              
              {/* Breadcrumb Navigation */}
              {selectedGitHubRepo && (
                <div className="flex items-center space-x-2 text-sm text-gray-500 ml-4">
                  <ChevronRight className="h-4 w-4" />
                  <button 
                    onClick={() => setView('repos')}
                    className="hover:text-[#2AB7A9] font-medium transition-colors"
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
              {/* Auto-refresh indicator */}
              {isBackgroundRefreshing && (
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Refreshing...</span>
                </div>
              )}
              
              {/* Manual refresh button */}
              <button
                onClick={async () => {
                  setIsBackgroundRefreshing(true);
                  try {
                    await loadRepositoryProcessingStatus();
                    await loadRepositorySummaryStatus();
                  } catch (error) {
                    console.error('Manual refresh error:', error);
                  } finally {
                    setIsBackgroundRefreshing(false);
                  }
                }}
                disabled={isBackgroundRefreshing}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                title="Refresh status"
              >
                <RefreshCw className={`h-4 w-4 ${isBackgroundRefreshing ? 'animate-spin' : ''}`} />
              </button>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search repositories, files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent bg-white shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isAuthLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
              <div className="flex flex-col items-center text-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#2AB7A9] mb-4" />
                <span className="text-gray-600 font-medium">Loading...</span>
              </div>
            </div>
          </div>
        ) : !session ? (
          <div className="flex items-center justify-center h-96">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 text-center max-w-md">
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Authentication Required</h3>
              <p className="text-gray-600 mb-6">Please log in to access your repositories.</p>
              <button
                onClick={() => navigate('/auth/signin')}
                className="inline-flex items-center px-6 py-2.5 bg-[#2AB7A9] text-white rounded-lg hover:bg-[#24a497] transition-colors shadow-sm"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Repository List View */}
            {view === 'repos' && (
              <div className="space-y-6">
                {/* Header Section */}
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-[#2AB7A9] to-[#24a497] px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <Database className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">Your Repositories</h2>
                          <p className="text-[#a8f0e6] text-sm">Connected GitHub repositories</p>
                        </div>
                      </div>
                      {gitHubConnectionStatus?.isConnected && (
                        <div className="flex items-center space-x-4">
                          {/* Active polling indicator */}
                          {Object.values(repoProgressStatus).some(status => status?.isPolling) && (
                            <div className="flex items-center space-x-2 text-sm text-white bg-white/10 rounded-full px-3 py-1">
                              <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
                              <span>Auto-refreshing</span>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-2 text-sm text-white bg-white/10 rounded-full px-3 py-1">
                            <div className="h-2 w-2 bg-white rounded-full"></div>
                            <span>{gitHubConnectionStatus.details?.account?.login}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <RepositoryGrid 
                gitHubConnectionStatus={gitHubConnectionStatus}
                summaryGenerationError={summaryGenerationError}
                isLoadingConnection={isLoadingConnection}
                connectionError={connectionError}
                repoSummaryStatus={repoSummaryStatus}
                reposStatus={repoProgressStatus}
                processingRepos={[]}
                queuedRepos={[]}
                generatingSummaries={[]}
                brandColor={brandColor}
                onConnectGitHub={handleConnectGitHub}
                onRepoClick={handleGitHubRepoClick}
                onAnalyzeRepository={handleAnalyzeRepository}
                onStatusModalOpen={handleStatusModalOpen}
                onClearSummaryError={handleClearSummaryError}
                      fetchGitHubConnectionStatus={async () => {
                        try {
                          const connectionStatus = await getGitHubConnectionStatus();
                          // This will trigger the useEffect to reload summary statuses
                          console.log('Refreshed GitHub connection status:', connectionStatus);
                        } catch (error) {
                          console.error('Error refreshing GitHub connection status:', error);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Browser View */}
            {view === 'browser' && (
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden" style={{ height: 'calc(100vh - 8rem)' }}>
                <div className="flex h-full w-full">
                  {/* Left Sidebar - File Tree */}
                  <div className="w-60 min-w-60 max-w-72 border-r border-gray-200 bg-gray-50 flex-shrink-0">
                    <FileTree 
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
                      onFolderToggle={toggleFolderExpansion}
                    />
                  </div>
                  
                  {/* Right Content Area */}
                  <div className="flex-1 flex flex-col bg-white min-w-0">
                    {selectedFile ? (
                      <>
                        {/* File Content Tabs */}
                        <div className="border-b border-gray-200 bg-white flex-shrink-0 px-6 py-2">
                          <nav className="flex space-x-6" aria-label="Tabs">
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
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                                            ${activeTab === tabName
                                              ? 'border-[#2AB7A9] text-[#2AB7A9]'
                                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                              >
                                {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
                              </button>
                            ))}
                          </nav>
                        </div>
                        
                        {/* File Content */}
                        <div className="flex-1 overflow-auto bg-gray-50 min-h-0">
                          <div className="h-full w-full">
                            {activeTab === 'code' && selectedFile && (
                              <div className="h-full w-full p-6">
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
                            {activeTab === 'documentation' && (
                              <div className="h-full w-full p-6">
                                <DocumentationViewer 
                                  isLoadingFileSummary={isLoadingFileSummary}
                                  fileSummaryError={fileSummaryError}
                                  selectedFileSummary={selectedFileSummary}
                                  selectedFileName={selectedFile?.name}
                                  selectedFilePath={selectedFile?.path}
                                  brandColor={brandColor}
                                  copyToClipboard={copyToClipboard}
                                  isTextCopied={isTextCopied}
                                  onUpdateDocumentation={handleUpdateDocumentation}
                                />
                              </div>
                            )}
                            {activeTab === 'lineage' && (
                              <div className="h-full w-full p-6 flex items-center justify-center">
                                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <File className="h-6 w-6 text-gray-400" />
                                  </div>
                                  <h3 className="text-lg font-medium text-gray-900 mb-2">Lineage View</h3>
                                  <p className="text-gray-500">Lineage view for {selectedFile?.path} - Coming soon!</p>
                                </div>
                              </div>
                            )}
                            {activeTab === 'visual' && (
                              <div className="h-full w-full p-6 flex items-center justify-center">
                                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <File className="h-6 w-6 text-gray-400" />
                                  </div>
                                  <h3 className="text-lg font-medium text-gray-900 mb-2">Visual Analysis</h3>
                                  <p className="text-gray-500">Visual tab content not yet implemented.</p>
                                </div>
                              </div>
                            )}
                            {activeTab === 'alerts' && (
                              <div className="h-full w-full p-6 flex items-center justify-center">
                                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="h-6 w-6 text-gray-400" />
                                  </div>
                                  <h3 className="text-lg font-medium text-gray-900 mb-2">Code Alerts</h3>
                                  <p className="text-gray-500">Alerts tab content not yet implemented.</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-md">
                          <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-6">
                            <File className="h-8 w-8 text-gray-400" />
                          </div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-3">Select a file to view</h3>
                          <p className="text-gray-500 leading-relaxed">
                            Choose a file from the tree on the left to view its content, documentation, and analysis.
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
      </div>
    </div>
  );
} 