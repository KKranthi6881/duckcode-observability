import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  GitBranch, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Play,
  RefreshCw,
  Trash2,
  Plus,
  GitPullRequest,
  FileCode,
  Table,
  Columns,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import axios from 'axios';

interface GitHubConnection {
  id: string;
  organization_id: string;
  repository_url: string;
  repository_name: string;
  repository_owner: string;
  branch: string;
  status: 'connected' | 'extracting' | 'completed' | 'error';
  last_extraction_at?: string;
  extraction_quality_score?: number;
  total_files?: number;
  total_objects?: number;
  total_columns?: number;
  created_at: string;
}

interface ExtractionJob {
  id: string;
  connection_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  phase: string;
  progress: number;
  files_processed: number;
  files_total: number;
  objects_extracted: number;
  columns_extracted: number;
  error_message?: string;
}

interface Stats {
  total_connections: number;
  total_objects: number;
  total_columns: number;
  avg_quality_score: number;
  active_jobs: number;
}

export const MetadataExtraction: React.FC = () => {
  const [connections, setConnections] = useState<GitHubConnection[]>([]);
  const [jobs, setJobs] = useState<Record<string, ExtractionJob>>({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // New connection form
  const [newRepo, setNewRepo] = useState({
    url: '',
    branch: 'main',
    accessToken: ''
  });

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  useEffect(() => {
    fetchData();
    // Poll job statuses every 2 seconds
    const statusInterval = setInterval(fetchJobStatuses, 2000);
    // Refresh connection list every 5 seconds to pick up status changes
    const dataInterval = setInterval(fetchData, 5000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(dataInterval);
    };
  }, []);

  const fetchData = async () => {
    try {
      const token = await getAuthToken();
      const [connectionsRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/admin/metadata/connections`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE}/api/admin/metadata/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setConnections(connectionsRes.data.connections || []);
      setStats(statsRes.data.stats);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const fetchJobStatuses = async () => {
    const activeConnections = connections.filter(c => c.status === 'extracting');
    const token = await getAuthToken();
    for (const conn of activeConnections) {
      try {
        // Use new Docker-based progress endpoint
        const response = await axios.get(`${API_BASE}/api/metadata/connections/${conn.id}/progress`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Map new progress format to existing job format
        const progressData = response.data;
        const mappedJob: ExtractionJob = {
          id: conn.id,
          connection_id: conn.id,
          status: progressData.phase === 'completed' ? 'completed' : 
                  progressData.phase === 'failed' ? 'failed' : 'processing',
          phase: progressData.phase,
          progress: progressData.progress,
          files_processed: 0, // Not tracked in new system
          files_total: 0, // Not tracked in new system
          objects_extracted: 0, // Will be updated on completion
          columns_extracted: 0, // Will be updated on completion
          error_message: progressData.errors?.join(', ')
        };
        
        setJobs(prev => ({ ...prev, [conn.id]: mappedJob }));
      } catch (error) {
        console.error(`Failed to fetch job status for ${conn.id}`);
      }
    }
  };

  const connectRepository = async () => {
    try {
      const token = await getAuthToken();
      await axios.post(`${API_BASE}/api/admin/metadata/connections`, {
        repositoryUrl: newRepo.url,
        branch: newRepo.branch,
        accessToken: newRepo.accessToken
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowAddDialog(false);
      setNewRepo({ url: '', branch: 'main', accessToken: '' });
      await fetchData();
    } catch (error: any) {
      console.error('Failed to connect repository:', error);
      const message = error.response?.data?.message || error.response?.data?.error || 'Failed to connect repository';
      alert(message);
    }
  };

  const startExtraction = async (connectionId: string) => {
    try {
      const token = await getAuthToken();
      // Use new Docker-based automatic extraction endpoint
      await axios.post(`${API_BASE}/api/metadata/connections/${connectionId}/extract`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Docker-based extraction started for connection:', connectionId);
      await fetchData();
    } catch (error: any) {
      console.error('Failed to start extraction:', error);
      const message = error.response?.data?.error || 'Failed to start extraction. Check console for details.';
      alert(message);
    }
  };

  const cancelExtraction = async (connectionId: string) => {
    if (!confirm('Cancel this extraction? The connection will remain but extraction will stop.')) {
      return;
    }
    
    try {
      const token = await getAuthToken();
      await axios.post(`${API_BASE}/api/metadata/connections/${connectionId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('✅ Extraction cancelled for connection:', connectionId);
      await fetchData();
    } catch (error: any) {
      console.error('Failed to cancel extraction:', error);
      const message = error.response?.data?.error || 'Failed to cancel extraction. Check console for details.';
      alert(message);
    }
  };

  const disconnectRepository = async (connectionId: string) => {
    if (!confirm('Disconnect this repository? All metadata will be deleted.')) {
      return;
    }
    
    try {
      const token = await getAuthToken();
      await axios.delete(`${API_BASE}/api/admin/metadata/connections/${connectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      await fetchData();
    } catch (error) {
      console.error('Failed to disconnect repository:', error);
      alert('Failed to disconnect repository. Check console for details.');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: React.ReactNode }> = {
      connected: { color: 'bg-green-500', icon: <CheckCircle className="w-4 h-4" /> },
      extracting: { color: 'bg-blue-500', icon: <RefreshCw className="w-4 h-4 animate-spin" /> },
      completed: { color: 'bg-green-600', icon: <CheckCircle className="w-4 h-4" /> },
      error: { color: 'bg-red-500', icon: <AlertCircle className="w-4 h-4" /> }
    };
    const variant = variants[status] || variants.connected;
    return (
      <Badge className={`${variant.color} text-white flex items-center gap-1`}>
        {variant.icon}
        {status}
      </Badge>
    );
  };

  const getQualityBadge = (score?: number) => {
    if (!score) return null;
    const color = score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <Badge className={`${color} text-white flex items-center gap-1`}>
        <TrendingUp className="w-3 h-3" />
        {score.toFixed(1)}% Quality
      </Badge>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Metadata Extraction</h1>
          <p className="text-muted-foreground mt-1">
            Enterprise data catalog powered by SQLglot + Tantivy
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Connect Repository
        </Button>
      </div>

      {/* Docker-based Extraction Banner */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              🐳 Docker-Based Automatic Extraction Enabled
            </h3>
            <p className="text-sm text-blue-800">
              Extraction now runs in isolated Docker containers with <code className="bg-blue-100 px-1 rounded text-xs">dbt parse</code>. 
              When you click "Extract", the system automatically clones your repo, runs dbt in a container, extracts the manifest, and stores metadata. 
              Duration: 1-3 minutes. No manual uploads needed!
            </p>
          </div>
        </div>
      </div>

      {/* Modal for adding repository */}
      {showAddDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">Connect GitHub Repository</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Connect a repository to extract SQL, Python, and DBT metadata
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="repo-url" className="block text-sm font-medium mb-1">
                  Repository URL
                </label>
                <input
                  id="repo-url"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  placeholder="https://github.com/owner/repo"
                  value={newRepo.url}
                  onChange={(e) => setNewRepo({ ...newRepo, url: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="branch" className="block text-sm font-medium mb-1">
                  Branch
                </label>
                <input
                  id="branch"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  placeholder="main"
                  value={newRepo.branch}
                  onChange={(e) => setNewRepo({ ...newRepo, branch: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="token" className="block text-sm font-medium mb-1">
                  GitHub Personal Access Token
                </label>
                <input
                  id="token"
                  type="password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                  placeholder="ghp_..."
                  value={newRepo.accessToken}
                  onChange={(e) => setNewRepo({ ...newRepo, accessToken: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Token needs 'repo' scope to read repository contents
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={connectRepository} className="flex-1">
                  Connect Repository
                </Button>
                <Button 
                  onClick={() => setShowAddDialog(false)} 
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Repositories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_connections || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Table className="w-4 h-4" />
              Objects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_objects?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">Tables, Views, Models</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Columns className="w-4 h-4" />
              Columns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_columns?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground">With lineage tracking</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Avg Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avg_quality_score?.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">Extraction accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Active Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_jobs || 0}</div>
            <p className="text-xs text-muted-foreground">Currently extracting</p>
          </CardContent>
        </Card>
      </div>

      {/* Connections List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading connections...</p>
            </CardContent>
          </Card>
        ) : connections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No repositories connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect your first repository to start building your data catalog
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Connect Repository
              </Button>
            </CardContent>
          </Card>
        ) : (
          connections.map((connection) => {
            const job = jobs[connection.id];
            return (
              <Card key={connection.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch className="w-5 h-5" />
                        <CardTitle className="text-xl">{connection.repository_name}</CardTitle>
                        {getStatusBadge(connection.status)}
                        {getQualityBadge(connection.extraction_quality_score)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{connection.repository_url}</span>
                        <span className="flex items-center gap-1">
                          <GitPullRequest className="w-3 h-3" />
                          {connection.branch}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {connection.status === 'extracting' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelExtraction(connection.id)}
                          className="border-red-500 text-red-500 hover:bg-red-50"
                        >
                          Stop
                        </Button>
                      ) : connection.status === 'error' || connection.status === 'failed' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelExtraction(connection.id)}
                          className="border-orange-500 text-orange-500 hover:bg-orange-50"
                        >
                          Reset
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startExtraction(connection.id)}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnectRepository(connection.id)}
                        disabled={connection.status === 'extracting'}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Job Progress */}
                  {connection.status === 'extracting' && job && (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">
                          {job.phase || 'Processing'}... ({job.files_processed}/{job.files_total} files)
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {job.progress}%
                        </span>
                      </div>
                      <Progress value={job.progress} className="h-2 mb-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{job.objects_extracted} objects extracted</span>
                        <span>{job.columns_extracted} columns extracted</span>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {connection.status === 'error' && job?.error_message && (
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-700 dark:text-red-400">
                            Extraction Failed
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                            {job.error_message}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <FileCode className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                      <p className="text-2xl font-bold">{connection.total_files || 0}</p>
                      <p className="text-xs text-muted-foreground">SQL/Python Files</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Table className="w-5 h-5 mx-auto mb-1 text-green-500" />
                      <p className="text-2xl font-bold">{connection.total_objects || 0}</p>
                      <p className="text-xs text-muted-foreground">Tables/Views/Models</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Columns className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                      <p className="text-2xl font-bold">{connection.total_columns || 0}</p>
                      <p className="text-xs text-muted-foreground">Columns</p>
                    </div>
                  </div>

                  {/* Last Extraction */}
                  {connection.last_extraction_at && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Last extracted: {new Date(connection.last_extraction_at).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
