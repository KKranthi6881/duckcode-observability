import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitFork,
  Star,
  Lock,
  CheckCircle,
  Loader2,
  Wand,
  Clock,
  AlertCircle,
  GitBranch,
  Calendar,
  GitCommit,
  Eye,
  Shield
} from 'lucide-react';
import { useProcessingStatus } from '../context/ProcessingStatusContext';
import { useRepositoryMetadata } from '../hooks/useRepositoryMetadata';

interface RepositoryCardProps {
  repo: any;
  summaryStatus?: { hasSummaries: boolean; summaryCount: number; lastSummaryDate?: string };
  repoStatus?: { 
    progress: number; 
    isPolling: boolean;
    totalFiles?: number;
    completed?: number;
    pending?: number;
    failed?: number;
  };
  isProcessing: boolean;
  isQueued: boolean;
  isGeneratingSummary: boolean;
  brandColor: string;
  onRepoClick: (repo: any) => void;
  onAnalyze: () => void;
  onStatusCheck: () => void;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repo,
  summaryStatus,
  repoStatus,
  isProcessing,
  isQueued,
  isGeneratingSummary,
  brandColor,
  onRepoClick,
  onAnalyze,
  onStatusCheck,
}) => {
  const navigate = useNavigate();
  const { processingStatuses } = useProcessingStatus();
  const processingStatus = processingStatuses[repo.full_name];
  
  // Fetch detailed repository metadata
  const { metadata, isLoading: isLoadingMetadata } = useRepositoryMetadata(repo.full_name);
  
  const isAnalyzing = isProcessing || isQueued || isGeneratingSummary || processingStatus?.isPolling;
  const hasDocumentation = summaryStatus?.hasSummaries;

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return `${months} month${months > 1 ? 's' : ''} ago`;
    } else {
      const years = Math.floor(diffInDays / 365);
      return `${years} year${years > 1 ? 's' : ''} ago`;
    }
  };

  // Get processing info
  const getProcessingInfo = () => {
    if (processingStatus?.isPolling) {
      return {
        status: 'processing',
        text: `Processing... ${Math.round(processingStatus.progress)}%`,
        progress: processingStatus.progress,
        stats: {
          total: processingStatus.totalFiles,
          completed: processingStatus.completed,
          pending: processingStatus.pending,
          failed: processingStatus.failed
        }
      };
    } else if (processingStatus && processingStatus.progress >= 100) {
      return {
        status: 'completed',
        text: 'All Files Processed',
        progress: 100,
        stats: {
          total: processingStatus.totalFiles,
          completed: processingStatus.completed,
          pending: processingStatus.pending,
          failed: processingStatus.failed
        }
      };
    } else if (repoStatus && repoStatus.progress >= 100 && !repoStatus.isPolling) {
      return {
        status: 'completed',
        text: 'All Files Processed',
        progress: 100,
        stats: {
          total: repoStatus.totalFiles || 0,
          completed: repoStatus.completed || 0,
          pending: repoStatus.pending || 0,
          failed: repoStatus.failed || 0
        }
      };
    }
    return null;
  };

  const processingInfo = getProcessingInfo();



  return (
    <div
      onClick={() => onRepoClick(repo)}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-[#2AB7A9] transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-center justify-between">
        {/* Left side - Repository Info */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="relative flex-shrink-0">
            <img 
              src={repo.owner?.avatar_url || `https://github.com/${repo.full_name?.split('/')[0]}.png`} 
              alt={repo.owner?.login || repo.full_name?.split('/')[0]} 
              className="h-8 w-8 rounded border border-gray-200"
            />
            {repo.private && (
              <div className="absolute -top-1 -right-1 bg-gray-100 rounded-full p-0.5">
                <Lock className="h-2 w-2 text-gray-500" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#2AB7A9] transition-colors truncate">
                {repo.name}
              </h3>
              {hasDocumentation && (
                <div className="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                  <CheckCircle className="h-2.5 w-2.5 text-blue-500" />
                  <span className="text-xs text-blue-700 font-medium">
                    {summaryStatus.summaryCount}
                  </span>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-3 text-xs text-gray-500">
                <span className="truncate max-w-48">{repo.description || repo.full_name}</span>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <div className="flex items-center space-x-1">
                    <Star className="h-3 w-3" />
                    <span>{repo.stargazers_count || 0}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <GitFork className="h-3 w-3" />
                    <span>{repo.forks_count || 0}</span>
                  </div>
                  {repo.language && (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>{repo.language}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Repository Metadata */}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                {/* Show available metadata based on what we have */}
                {(metadata?.default_branch || repo.default_branch) && (
                  <div className="flex items-center space-x-1" title={`Default branch: ${metadata?.default_branch || repo.default_branch}`}>
                    <GitBranch className="h-3 w-3 text-gray-400" />
                    <span className="font-medium">{metadata?.default_branch || repo.default_branch}</span>
                  </div>
                )}
                
                {/* Show last commit date if available from metadata */}
                {metadata?.pushed_at && (
                  <div className="flex items-center space-x-1" title={`Last commit: ${new Date(metadata.pushed_at).toLocaleString()}`}>
                    <GitCommit className="h-3 w-3 text-green-500" />
                    <span>{formatDate(metadata.pushed_at)}</span>
                  </div>
                )}
                
                {/* Show repository updated date if different from pushed */}
                {metadata?.updated_at && metadata.updated_at !== metadata.pushed_at && (
                  <div className="flex items-center space-x-1" title={`Repository updated: ${new Date(metadata.updated_at).toLocaleString()}`}>
                    <Calendar className="h-3 w-3 text-blue-500" />
                    <span>{formatDate(metadata.updated_at)}</span>
                  </div>
                )}
                
                {/* Show repository size if available */}
                {metadata?.size && metadata.size > 0 && (
                  <div className="flex items-center space-x-1" title={`Repository size: ${metadata.size} KB`}>
                    <Eye className="h-3 w-3 text-purple-500" />
                    <span>
                      {metadata.size < 1024 
                        ? `${metadata.size}KB` 
                        : `${(metadata.size / 1024).toFixed(1)}MB`
                      }
                    </span>
                  </div>
                )}
                
                {/* Show open issues count if available */}
                {metadata?.open_issues_count && metadata.open_issues_count > 0 && (
                  <div className="flex items-center space-x-1" title={`Open issues: ${metadata.open_issues_count}`}>
                    <AlertCircle className="h-3 w-3 text-orange-500" />
                    <span>{metadata.open_issues_count}</span>
                  </div>
                )}
                
                {/* Show license if available */}
                {metadata?.license && (
                  <div className="flex items-center space-x-1" title={`License: ${metadata.license.name}`}>
                    <Shield className="h-3 w-3 text-gray-400" />
                    <span className="uppercase">{metadata.license.key}</span>
                  </div>
                )}
                
                {/* Show repository type */}
                {repo.private && (
                  <div className="flex items-center space-x-1" title="Private repository">
                    <Lock className="h-3 w-3 text-orange-500" />
                    <span>Private</span>
                  </div>
                )}
                
                {/* Show repository URL as a clickable link */}
                {repo.html_url && (
                  <div className="flex items-center space-x-1">
                    <a 
                      href={repo.html_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 transition-colors"
                      title="View on GitHub"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye className="h-3 w-3" />
                      <span>GitHub</span>
                    </a>
                  </div>
                )}
                
                {/* Loading indicator for metadata */}
                {isLoadingMetadata && (
                  <div className="flex items-center space-x-1 text-gray-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Loading...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Status & Action */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          {/* Processing Status */}
          {processingInfo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const [owner, repoName] = repo.full_name.split('/');
                navigate(`/dashboard/code/status/${owner}/${repoName}`);
              }}
              className="flex items-center space-x-3 hover:bg-gray-50 rounded-md p-2 transition-colors"
            >
              {processingInfo.status === 'processing' ? (
                <div className="flex items-center space-x-2 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <div className="text-right">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-blue-700 font-medium">{processingInfo.text}</span>
                      <div className="w-16 bg-gray-200 rounded-full h-1.5">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${processingInfo.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <span className="text-green-600 font-medium">{processingInfo.stats.completed}</span>
                      <span>/</span>
                      <span className="text-gray-600">{processingInfo.stats.total}</span>
                      {processingInfo.stats.pending > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-orange-600">{processingInfo.stats.pending} pending</span>
                        </>
                      )}
                      {processingInfo.stats.failed > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600">{processingInfo.stats.failed} failed</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-xs">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <div className="text-right">
                    <div className="text-green-700 font-medium mb-1">{processingInfo.text}</div>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <span className="text-green-600 font-medium">{processingInfo.stats.completed} files</span>
                      {processingInfo.stats.failed > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-600">{processingInfo.stats.failed} failed</span>
                        </>
                      )}
                      {processingInfo.stats.total > processingInfo.stats.completed + processingInfo.stats.failed && (
                        <>
                          <span>•</span>
                          <span className="text-gray-500">{processingInfo.stats.total - processingInfo.stats.completed - processingInfo.stats.failed} skipped</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </button>
          )}

          {/* Action Button */}
          {isAnalyzing ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const [owner, repoName] = repo.full_name.split('/');
                navigate(`/dashboard/code/status/${owner}/${repoName}`);
              }}
              className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              <Clock className="h-3 w-3 mr-1" />
              View Status
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAnalyze();
              }}
              className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-[#2AB7A9] to-[#24a497] rounded-md hover:from-[#24a497] hover:to-[#20a39e] transition-all duration-200"
            >
              <Wand className="h-3 w-3 mr-1" />
              Analyze
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 