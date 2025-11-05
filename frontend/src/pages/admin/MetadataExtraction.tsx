import { useState, useEffect } from 'react';
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
  Columns
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
    accessToken: '',
    provider: 'github' as 'github' | 'gitlab'
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
        accessToken: newRepo.accessToken,
        provider: newRepo.provider
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setShowAddDialog(false);
      setNewRepo({ url: '', branch: 'main', accessToken: '', provider: 'github' });
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


  return (
    <div className="min-h-screen bg-[#0d0c0c] p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#8d857b]">Extract schemas, tables, and columns from your repositories</p>
          </div>
          <button
            onClick={() => setShowAddDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#d94a1e] transition-colors font-medium text-sm shadow-lg"
          >
            <Plus className="w-4 h-4" />
            Add Repository
          </button>
        </div>

        {/* Modal for adding repository */}
        {showAddDialog && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="text-xl font-bold text-white mb-4">Add Repository</h2>
            <div className="space-y-4">
                <div>
                  <label htmlFor="provider" className="block text-sm font-medium text-white mb-1">
                    Provider
                  </label>
                  <select
                    id="provider"
                    className="w-full px-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50"
                    value={newRepo.provider}
                    onChange={(e) => setNewRepo({ ...newRepo, provider: e.target.value as 'github' | 'gitlab' })}
                  >
                    <option value="github">GitHub</option>
                    <option value="gitlab">GitLab</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="repo-url" className="block text-sm font-medium text-white mb-1">
                    Repository URL
                  </label>
                  <input
                    id="repo-url"
                    type="text"
                    className="w-full px-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50"
                    placeholder={newRepo.provider === 'github' ? 'https://github.com/owner/repo' : 'https://gitlab.com/owner/repo'}
                    value={newRepo.url}
                    onChange={(e) => setNewRepo({ ...newRepo, url: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="branch" className="block text-sm font-medium text-white mb-1">
                    Branch
                  </label>
                  <input
                    id="branch"
                    type="text"
                    className="w-full px-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50"
                    placeholder="main"
                    value={newRepo.branch}
                    onChange={(e) => setNewRepo({ ...newRepo, branch: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="token" className="block text-sm font-medium text-white mb-1">
                    {newRepo.provider === 'github' ? 'GitHub' : 'GitLab'} Access Token
                  </label>
                  <input
                    id="token"
                    type="password"
                    className="w-full px-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50"
                    placeholder={newRepo.provider === 'github' ? 'ghp_...' : 'glpat-...'}
                    value={newRepo.accessToken}
                    onChange={(e) => setNewRepo({ ...newRepo, accessToken: e.target.value })}
                  />
                  <p className="text-xs text-[#8d857b] mt-1">
                    {newRepo.provider === 'github' 
                      ? "Token needs 'repo' scope to read repository contents"
                      : "Token needs 'read_repository' scope to read repository contents"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={connectRepository}
                    className="flex-1 px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#d94a1e] transition font-medium"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowAddDialog(false)}
                    className="flex-1 px-4 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg hover:bg-[#2d2a27] transition font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Extracting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_jobs || 0}</div>
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
              <h3 className="text-lg font-semibold mb-2">No repositories</h3>
              <p className="text-muted-foreground mb-4">
                Add a repository to extract metadata
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Repository
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
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
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
                      ) : connection.status === 'error' ? (
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
                      <p className="text-xs text-muted-foreground">Files</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <Table className="w-5 h-5 mx-auto mb-1 text-green-500" />
                      <p className="text-2xl font-bold">{connection.total_objects || 0}</p>
                      <p className="text-xs text-muted-foreground">Objects</p>
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
    </div>
  );
};
