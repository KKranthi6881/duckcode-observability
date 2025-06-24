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
  File
} from 'lucide-react';
import { useAuth } from '../../features/auth/contexts/AuthContext';
import { useGitHubRepository } from '../../hooks/useGitHubRepository';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { FileTree } from '../../components/FileTree';
import { EnhancedCodeViewer } from '../../components/EnhancedCodeViewer';
import { DocumentationViewer } from '../../components/DocumentationViewer';
import { RepositoryGrid } from '../../components/RepositoryGrid';

const GITHUB_APP_NAME = 'DuckCode-Observability';
const brandColor = "#2AB7A9";

export function CodeBase() {
  const navigate = useNavigate();
  const { session, isLoading: isAuthLoading } = useAuth();
  
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

  // Handle GitHub Connection
  const handleConnectGitHub = () => {
    navigate('/dashboard/settings?tab=github');
  };

  // Handle repository selection with view change
  const handleGitHubRepoClick = (repo: any) => {
    handleRepositorySelect(repo);
    setView('browser');
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
              <RepositoryGrid 
                gitHubConnectionStatus={gitHubConnectionStatus}
                summaryGenerationError={null}
                isLoadingConnection={isLoadingConnection}
                connectionError={connectionError}
                repoSummaryStatus={{}}
                reposStatus={{}}
                selectedLanguages={{}}
                processingRepos={[]}
                queuedRepos={[]}
                generatingSummaries={[]}
                availableLanguages={[
                  { value: 'default', label: 'General Analysis' },
                  { value: 'postgres', label: 'PostgreSQL' },
                  { value: 'mysql', label: 'MySQL' },
                  { value: 'dbt', label: 'dbt' },
                  { value: 'tsql', label: 'T-SQL (SQL Server)' },
                  { value: 'plsql', label: 'PL/SQL (Oracle)' },
                  { value: 'pyspark', label: 'PySpark' },
                  { value: 'python', label: 'Python' },
                ]}
                brandColor={brandColor}
                onConnectGitHub={handleConnectGitHub}
                onRepoClick={handleGitHubRepoClick}
                onLanguageSelect={() => {}}
                onAnalyzeRepository={() => {}}
                onStatusModalOpen={() => {}}
                onClearSummaryError={() => {}}
                fetchGitHubConnectionStatus={() => {}}
              />
            )}

            {/* Browser View */}
            {view === 'browser' && (
              <div className="flex h-full">
                {/* Left Sidebar - File Tree */}
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
                        {activeTab === 'code' && selectedFile && (
                          <EnhancedCodeViewer 
                            selectedFile={selectedFile}
                            selectedFileContent={selectedFileContent || ''}
                            isLoadingFileContent={isLoadingFileContent}
                            fileContentError={fileContentError}
                            brandColor={brandColor}
                            copyToClipboard={copyToClipboard}
                            isTextCopied={isTextCopied}
                          />
                        )}
                        {activeTab === 'documentation' && (
                          <DocumentationViewer 
                            isLoadingFileSummary={isLoadingFileSummary}
                            fileSummaryError={fileSummaryError}
                            selectedFileSummary={selectedFileSummary}
                            selectedFileName={selectedFile?.name}
                            brandColor={brandColor}
                            copyToClipboard={copyToClipboard}
                            isTextCopied={isTextCopied}
                          />
                        )}
                        {activeTab === 'lineage' && (
                          <div className="p-4 text-gray-500">Lineage view for {selectedFile?.path} - Coming soon!</div>
                        )}
                        {activeTab === 'visual' && (
                          <div className="p-4 text-gray-500">Visual tab content not yet implemented.</div>
                        )}
                        {activeTab === 'alerts' && (
                          <div className="p-4 text-gray-500">Alerts tab content not yet implemented.</div>
                        )}
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