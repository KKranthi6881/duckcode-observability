import React from 'react';
import { 
  Star, 
  GitFork, 
  Lock, 
  CheckCircle, 
  Loader2, 
  FileText 
} from 'lucide-react';

interface RepositoryCardProps {
  repo: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    description?: string;
    stargazers_count?: number;
    forks_count?: number;
    owner?: {
      avatar_url: string;
      login: string;
    };
  };
  summaryStatus?: {
    hasSummaries: boolean;
    summaryCount: number;
    lastSummaryDate?: string;
  };
  repoStatus?: {
    progress: number;
    totalFiles: number;
    completed: number;
    failed: number;
    pending: number;
  };
  selectedLanguage?: string;
  availableLanguages: Array<{ value: string; label: string }>;
  isProcessing: boolean;
  isQueued: boolean;
  isGeneratingSummary: boolean;
  brandColor: string;
  onRepoClick: (repo: any) => void;
  onLanguageSelect: (repoFullName: string, language: string) => void;
  onAnalyzeRepository: (repoFullName: string) => void;
  onStatusModalOpen: (repo: any) => void;
}

export const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repo,
  summaryStatus,
  repoStatus,
  selectedLanguage,
  availableLanguages,
  isProcessing,
  isQueued,
  isGeneratingSummary,
  brandColor,
  onRepoClick,
  onLanguageSelect,
  onAnalyzeRepository,
  onStatusModalOpen,
}) => {
  const hasDocumentation = summaryStatus?.hasSummaries;

  return (
    <div
      key={repo.id}
      onClick={() => onRepoClick(repo)}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:border-[#2AB7A9] hover:shadow-lg transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-center space-x-3 mb-4">
        <img 
          src={repo.owner?.avatar_url || `https://github.com/${repo.full_name?.split('/')[0]}.png`} 
          alt={repo.owner?.login || repo.full_name?.split('/')[0]} 
          className="h-10 w-10 rounded-full"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#2AB7A9] transition-colors truncate">
              {repo.name}
            </h3>
            {hasDocumentation && (
              <div className="flex items-center gap-1">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-xs text-green-600 font-medium">
                  {summaryStatus.summaryCount} files documented
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 truncate">{repo.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          {repo.private && (
            <Lock className="h-4 w-4 text-gray-400" />
          )}
          {hasDocumentation && (
            <div className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          )}
        </div>
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
        <div className="w-64 text-right space-y-2">
          {isQueued && repoStatus ? (
            <div 
              className="cursor-pointer group" 
              onClick={(e) => {
                e.stopPropagation();
                onStatusModalOpen(repo);
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 group-hover:text-brand-600">Processing...</span>
                <span className="text-xs font-medium text-gray-700 group-hover:text-brand-600">{repoStatus.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-brand-600 h-2.5 rounded-full text-white flex items-center justify-center text-xs font-bold" 
                  style={{ width: `${repoStatus.progress}%`, backgroundColor: brandColor }}
                >
                  {repoStatus.progress > 10 ? `${repoStatus.progress}%` : ''}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Language Selection Dropdown */}
              <div className="w-full">
                <select
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    onLanguageSelect(repo.full_name, e.target.value);
                  }}
                  value={selectedLanguage || ''}
                  className="w-full text-xs border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  disabled={isProcessing || isGeneratingSummary}
                >
                  <option value="">Select Technology/Language</option>
                  {availableLanguages.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Repository Action Button */}
              {hasDocumentation ? (
                <div className="space-y-1">
                  <div className="text-center">
                    <div className="inline-flex items-center px-2 py-1 bg-green-50 border border-green-200 rounded-md">
                      <CheckCircle className="h-3 w-3 text-green-600 mr-1" />
                      <span className="text-xs text-green-700 font-medium">
                        Documented
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAnalyzeRepository(repo.full_name);
                    }}
                    disabled={!selectedLanguage || isProcessing || isGeneratingSummary}
                    className={`w-full inline-flex items-center justify-center px-2 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      (!selectedLanguage || isProcessing || isGeneratingSummary)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'text-white bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {(isProcessing || isGeneratingSummary) ? (
                      <>
                        <Loader2 className="mr-1 h-2 w-2 animate-spin" />
                        {isProcessing ? 'Re-analyzing...' : 'Updating...'}
                      </>
                    ) : (
                      <>
                        <FileText className="mr-1 h-2 w-2" />
                        Re-analyze
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnalyzeRepository(repo.full_name);
                  }}
                  disabled={!selectedLanguage || isProcessing || isGeneratingSummary}
                  className={`w-full inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                    (!selectedLanguage || isProcessing || isGeneratingSummary)
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'text-white bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {(isProcessing || isGeneratingSummary) ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      {isProcessing ? 'Analyzing Repository...' : 'Generating Documentation...'}
                    </>
                  ) : (
                    <>
                      <FileText className="mr-1 h-3 w-3" />
                      Analyze & Document Repository
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 