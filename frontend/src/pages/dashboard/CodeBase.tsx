import React, { useState, useEffect } from 'react';
import { 
  Code, 
  GitBranch, 
  GitFork, 
  Star, 
  Clock, 
  File, 
  Folder, 
  ChevronRight, 
  FileCode, 
  FilePlus, 
  Search,
  Users,
  Download,
  Copy,
  ExternalLink,
  BookOpen,
  GitCommit,
  BarChart,
  AlertCircle
} from 'lucide-react';

interface FileItem { 
  name: string;
  type: 'file' | 'directory' | 'symlink'; 
  path: string; 
  sha: string; 
  size?: number; 
  url?: string; 
  html_url?: string; 
  download_url?: string | null; 
  children?: FileItem[]; 
}

interface GitHubRepository {
  id: number; 
  node_id: string; 
  name: string; 
  full_name: string; 
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  html_url: string; 
  default_branch: string;
}

const GITHUB_APP_NAME = 'your-github-app-name'; 

export function CodeBase() {
  const [connectedRepos, setConnectedRepos] = useState<GitHubRepository[]>([]);
  const [isLoadingGitHub, setIsLoadingGitHub] = useState(false);
  const [gitHubError, setGitHubError] = useState<string | null>(null);

  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<GitHubRepository | null>(null);
  const [repoFiles, setRepoFiles] = useState<FileItem[]>([]); 
  const [currentGitHubPath, setCurrentGitHubPath] = useState<string[]>([]); 
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  
  const [view, setView] = useState<'list' | 'code'>('list'); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [activeTab, setActiveTab] = useState<'code' | 'documentation' | 'lineage' | 'visual' | 'alerts'>('code');
  const brandColor = "#2AB7A9";

  useEffect(() => {
    const fetchConnectedRepos = async () => {
      setIsLoadingGitHub(true);
      setGitHubError(null);
      try {
        console.log('Simulating fetch of connected repos (currently empty).');
        setConnectedRepos([]); 
      } catch (err: any) {
        setGitHubError(err.message);
        console.error('Error fetching connected repos:', err);
        setConnectedRepos([]);
      } finally {
        setIsLoadingGitHub(false);
      }
    };
    fetchConnectedRepos();
  }, []);

  const handleConnectGitHub = () => {
    if (!GITHUB_APP_NAME || GITHUB_APP_NAME === 'DuckCode Observability Github') {
      alert('Please configure GITHUB_APP_NAME in CodeBase.tsx');
      return;
    }
    window.location.href = `https://github.com/apps/${GITHUB_APP_NAME}/installations/new`;
  };

  const handleGitHubRepoClick = async (repo: GitHubRepository) => {
    setSelectedGitHubRepo(repo);
    setCurrentGitHubPath([]);
    setRepoFiles([]); 
    setSelectedFile(null);
    setSelectedFileContent(null);
    setView('list'); 
    console.log('Selected GitHub repo:', repo.full_name);
  };

  const getFileIcon = (fileName: string, type: 'file' | 'directory' | 'symlink') => {
    if (type === 'directory') return <Folder className="w-5 h-5 text-yellow-500" />;
    if (type === 'symlink') return <ExternalLink className="w-5 h-5 text-blue-500" />;
    if (fileName.endsWith('.sql')) return <FileCode className="w-5 h-5 text-indigo-500" />;
    if (fileName.endsWith('.py')) return <FileCode className="w-5 h-5 text-green-500" />;
    if (fileName.endsWith('.md')) return <BookOpen className="w-5 h-5 text-gray-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  return (
    <div className="flex h-[calc(100vh-var(--header-height,64px))] bg-gray-100">
      <div className="w-1/4 min-w-[280px] max-w-[400px] bg-white border-r border-gray-200 p-4 flex flex-col shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-semibold text-gray-700">Connected Repositories</h2>
        </div>
        <button
          onClick={handleConnectGitHub}
          className="w-full mb-3 px-3 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50 flex items-center justify-center transition-colors duration-150"
        >
          <GitFork className="w-4 h-4 mr-2" /> Connect New GitHub Repository
        </button>

        {isLoadingGitHub && <p className="text-xs text-gray-500 p-2 text-center">Loading repositories...</p>}
        {gitHubError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md text-center">Error: {gitHubError}</p>}
        
        {!isLoadingGitHub && connectedRepos.length === 0 && !gitHubError && (
          <div className="text-center text-xs text-gray-400 mt-6 p-4 border border-dashed rounded-md">
            <Folder className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            No repositories connected yet. <br/> Click the button above to get started.
          </div>
        )}

        <div className="flex-grow overflow-y-auto space-y-1 -mr-2 pr-2 mt-2">
          {connectedRepos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => handleGitHubRepoClick(repo)}
              title={repo.full_name}
              className={`p-2.5 rounded-md cursor-pointer group hover:bg-sky-50 transition-colors duration-100 ${selectedGitHubRepo?.id === repo.id ? 'bg-sky-100 border border-sky-200 shadow-sm' : 'border border-transparent hover:border-gray-200'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center min-w-0">
                  <img src={repo.owner.avatar_url} alt={repo.owner.login} className="w-5 h-5 rounded-full mr-2" />
                  <span className="font-medium text-gray-700 text-xs truncate group-hover:text-sky-700">{repo.full_name}</span>
                </div>
                {repo.private && (
                  <span className="text-xs bg-gray-200 text-gray-600 px-1 py-0.5 rounded-sm ml-1">Private</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-5 flex flex-col bg-gray-50">
        {!selectedGitHubRepo ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8 bg-white rounded-lg shadow-sm border">
              <GitCommit className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <h3 className="text-md font-medium text-gray-600">Select a Repository</h3>
              <p className="text-xs text-gray-400 mt-1">
                Choose a connected repository from the sidebar to browse its files and begin analysis.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="mb-3 pb-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 truncate" title={selectedGitHubRepo.full_name}>{selectedGitHubRepo.full_name}</h3>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                <span className="hover:underline cursor-pointer" onClick={() => { setCurrentGitHubPath([]); /* fetch root files */ }}>{selectedGitHubRepo.name}</span>
              </div>
            </div>

            <div className="flex-1 bg-white rounded-md shadow-sm overflow-y-auto p-1">
              {view === 'list' && (
                <div className="p-3">
                  {isLoadingGitHub && <p className="text-xs text-gray-500">Loading files...</p>}
                  {!isLoadingGitHub && repoFiles.length === 0 && <p className="text-xs text-gray-400 p-4 text-center">No files loaded or repository is empty. (Implement file fetching for '{currentGitHubPath.join('/') || '/'}')</p>}
                  {repoFiles.map(item => (
                    <div key={item.sha} className="flex items-center p-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs" /* onClick={() => handleFileOrDirClick(item)} */ >
                      {getFileIcon(item.name, item.type)} 
                      <span className="ml-2 text-gray-700">{item.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {view === 'code' && selectedFile && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="border-b border-gray-200 px-2">
                    <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                      {['code', 'documentation', 'lineage', 'visual', 'alerts'].map((tabName) => (
                        <button
                          key={tabName}
                          onClick={() => setActiveTab(tabName as any)}
                          className={`whitespace-nowrap py-2.5 px-3 border-b-2 font-medium text-xs capitalize 
                            ${activeTab === tabName 
                              ? 'border-sky-500 text-sky-600' 
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                          `}
                        >
                          {tabName}
                        </button>
                      ))}
                    </nav>
                  </div>

                  <div className="flex-1 overflow-auto p-3">
                    {activeTab === 'code' && (
                      selectedFileContent ? 
                      <pre className="text-xs whitespace-pre-wrap break-all"><code>{selectedFileContent}</code></pre> : 
                      <p className="text-xs text-gray-400">Loading file content or no content...</p>
                    )}
                    {activeTab === 'documentation' && <p className="text-xs">Documentation for {selectedFile.name} (TODO)</p>}
                    {activeTab === 'lineage' && <p className="text-xs">Lineage for {selectedFile.name} (TODO)</p>}
                    {activeTab === 'visual' && <p className="text-xs">Visuals for {selectedFile.name} (TODO)</p>}
                    {activeTab === 'alerts' && <p className="text-xs">Alerts for {selectedFile.name} (TODO)</p>}
                  </div>
                </div>
              )}
              {view === 'code' && !selectedFile && (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                  <p>Select a file to view its content.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
