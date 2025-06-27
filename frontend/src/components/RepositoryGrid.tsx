import React from 'react';
import { 
  Settings, 
  Github, 
  Loader2, 
  AlertTriangle, 
  X 
} from 'lucide-react';
import { RepositoryCard } from './RepositoryCard';
import { useNavigate } from 'react-router-dom';

interface RepositoryGridProps {
  gitHubConnectionStatus: any;
  summaryGenerationError: string | null;
  isLoadingConnection: boolean;
  connectionError: string | null;
  repoSummaryStatus: Record<string, { hasSummaries: boolean; summaryCount: number; lastSummaryDate?: string }>;
  reposStatus: Record<string, any>;
  processingRepos: string[];
  queuedRepos: string[];
  generatingSummaries: string[];
  brandColor: string;
  onConnectGitHub: () => void;
  onRepoClick: (repo: any) => void;
  onAnalyzeRepository: (repoFullName: string) => void;
  onStatusModalOpen: (repo: any) => void;
  onClearSummaryError: () => void;
  fetchGitHubConnectionStatus: () => void;
}

export const RepositoryGrid: React.FC<RepositoryGridProps> = ({
  gitHubConnectionStatus,
  summaryGenerationError,
  isLoadingConnection,
  connectionError,
  repoSummaryStatus,
  reposStatus,
  processingRepos,
  queuedRepos,
  generatingSummaries,
  brandColor,
  onConnectGitHub,
  onRepoClick,
  onAnalyzeRepository,
  onStatusModalOpen,
  onClearSummaryError,
  fetchGitHubConnectionStatus,
}) => {
  const navigate = useNavigate();
  // Filtered list of repositories based on search query
  const filteredRepos = gitHubConnectionStatus?.details?.accessibleRepos?.filter((repo: any) =>
    repo.name.toLowerCase().includes('') // search functionality can be added here
  ) || [];

  return (
    <div className="space-y-4">
      {/* GitHub Connection Status & Actions */}
      <div className="space-y-4">

        {/* Error Messages */}
        {summaryGenerationError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
              <div className="text-sm text-red-700 flex-1">
                {summaryGenerationError}
              </div>
              <button
                onClick={onClearSummaryError}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Repository List */}
        {isLoadingConnection ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="h-8 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : connectionError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="flex flex-col items-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mb-3" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Connection Error</h3>
              <p className="text-red-700 mb-4 text-sm">{connectionError}</p>
              <button
                onClick={fetchGitHubConnectionStatus}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <Loader2 className="h-4 w-4 mr-2" />
                Try Again
              </button>
            </div>
          </div>
        ) : !gitHubConnectionStatus?.isConnected ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <Github className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your GitHub Account</h3>
            <p className="text-gray-600 mb-6 text-sm max-w-md mx-auto">
              Connect your GitHub account to access and analyze your repositories.
            </p>
            <button
              onClick={onConnectGitHub}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#2AB7A9] to-[#24a497] text-white font-medium rounded-lg hover:from-[#24a497] hover:to-[#20a39e] transition-all duration-200"
            >
              <Github className="h-5 w-5 mr-2" />
              Connect GitHub Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {gitHubConnectionStatus.details?.accessibleRepos?.map((repo: any) => (
              <RepositoryCard
                key={repo.id}
                repo={repo}
                summaryStatus={repoSummaryStatus[repo.id.toString()]}
                repoStatus={reposStatus[repo.id.toString()]}
                isProcessing={processingRepos.includes(repo.id.toString())}
                isQueued={queuedRepos.includes(repo.id.toString())}
                isGeneratingSummary={generatingSummaries.includes(repo.id.toString())}
                brandColor={brandColor}
                onRepoClick={onRepoClick}
                onAnalyze={() => onAnalyzeRepository(repo.full_name)}
                onStatusCheck={() => onStatusModalOpen(repo)}
              />
            ))}
          </div>
        )}
      </div>


    </div>
  );
}; 