import React from 'react';
import { 
  Settings, 
  Github, 
  Loader2, 
  AlertTriangle, 
  X 
} from 'lucide-react';
import { RepositoryCard } from './RepositoryCard';

interface RepositoryGridProps {
  gitHubConnectionStatus: any;
  summaryGenerationError: string | null;
  isLoadingConnection: boolean;
  connectionError: string | null;
  repoSummaryStatus: Record<string, { hasSummaries: boolean; summaryCount: number; lastSummaryDate?: string }>;
  reposStatus: Record<string, any>;
  selectedLanguages: Record<string, string>;
  processingRepos: string[];
  queuedRepos: string[];
  generatingSummaries: string[];
  availableLanguages: Array<{ value: string; label: string }>;
  brandColor: string;
  onConnectGitHub: () => void;
  onRepoClick: (repo: any) => void;
  onLanguageSelect: (repoFullName: string, language: string) => void;
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
  selectedLanguages,
  processingRepos,
  queuedRepos,
  generatingSummaries,
  availableLanguages,
  brandColor,
  onConnectGitHub,
  onRepoClick,
  onLanguageSelect,
  onAnalyzeRepository,
  onStatusModalOpen,
  onClearSummaryError,
  fetchGitHubConnectionStatus,
}) => {
  return (
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
              onClick={onConnectGitHub}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage
            </button>
          </div>
        )}
      </div>

      {summaryGenerationError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <div className="text-sm text-red-700">
              {summaryGenerationError}
            </div>
            <button
              onClick={onClearSummaryError}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
              <h3 className="text-lg font-bold text-red-900">Connection Error</h3>
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
            onClick={onConnectGitHub}
            className="inline-flex items-center px-6 py-3 bg-[#2AB7A9] text-white text-lg font-medium rounded-lg hover:bg-[#24a497] transition-colors"
          >
            <Github className="h-5 w-5 mr-2" />
            Connect GitHub Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gitHubConnectionStatus.details?.accessibleRepos?.map((repo: any) => (
            <RepositoryCard
              key={repo.id}
              repo={repo}
              summaryStatus={repoSummaryStatus[repo.full_name]}
              repoStatus={reposStatus[repo.full_name]}
              selectedLanguage={selectedLanguages[repo.full_name]}
              availableLanguages={availableLanguages}
              isProcessing={processingRepos.includes(repo.full_name)}
              isQueued={queuedRepos.includes(repo.full_name)}
              isGeneratingSummary={generatingSummaries.includes(repo.full_name)}
              brandColor={brandColor}
              onRepoClick={onRepoClick}
              onLanguageSelect={onLanguageSelect}
              onAnalyzeRepository={onAnalyzeRepository}
              onStatusModalOpen={onStatusModalOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}; 