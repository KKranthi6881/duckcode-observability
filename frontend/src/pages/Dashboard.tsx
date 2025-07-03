import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  FileText, 
  BarChart3, 
  GitBranch, 
  Network,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Play,
  Settings
} from 'lucide-react';

import { MetadataProcessingDashboard } from '@/components/MetadataProcessingDashboard';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  language: string;
  lastProcessed?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  stats: {
    files: number;
    documentation: number;
    vectors: number;
    lineage: number;
    dependencies: number;
  };
}

export default function Dashboard() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Mock data - in production this would come from API
    setRepositories([
      {
        id: '1',
        name: 'analytics-dbt',
        fullName: 'company/analytics-dbt',
        language: 'dbt',
        lastProcessed: '2024-01-15T10:30:00Z',
        status: 'completed',
        stats: {
          files: 145,
          documentation: 145,
          vectors: 145,
          lineage: 89,
          dependencies: 234
        }
      },
      {
        id: '2',
        name: 'data-pipeline',
        fullName: 'company/data-pipeline',
        language: 'python',
        lastProcessed: '2024-01-14T15:45:00Z',
        status: 'processing',
        stats: {
          files: 78,
          documentation: 65,
          vectors: 45,
          lineage: 23,
          dependencies: 0
        }
      },
      {
        id: '3',
        name: 'sql-queries',
        fullName: 'company/sql-queries',
        language: 'sql',
        status: 'pending',
        stats: {
          files: 234,
          documentation: 0,
          vectors: 0,
          lineage: 0,
          dependencies: 0
        }
      }
    ]);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      processing: 'bg-blue-100 text-blue-800',
      error: 'bg-red-100 text-red-800',
      pending: 'bg-gray-100 text-gray-800'
    };
    return (
      <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const calculateProgress = (stats: Repository['stats']) => {
    const total = stats.files;
    if (total === 0) return 0;
    
    // Weight different phases
    const weights = { documentation: 0.3, vectors: 0.2, lineage: 0.3, dependencies: 0.2 };
    const progress = 
      (stats.documentation / total) * weights.documentation +
      (stats.vectors / total) * weights.vectors +
      (stats.lineage / total) * weights.lineage +
      (stats.dependencies / total) * weights.dependencies;
    
    return Math.round(progress * 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Data Observability Dashboard</h1>
            <p className="text-gray-600">Comprehensive metadata processing and dependency analysis</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
            <Button className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Process Repository
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="processing">Processing Pipeline</TabsTrigger>
            <TabsTrigger value="repositories">Repositories</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Repositories</p>
                      <p className="text-2xl font-bold">{repositories.length}</p>
                    </div>
                    <Database className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Files Processed</p>
                      <p className="text-2xl font-bold">
                        {repositories.reduce((sum, repo) => sum + repo.stats.documentation, 0)}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Lineage Relationships</p>
                      <p className="text-2xl font-bold">
                        {repositories.reduce((sum, repo) => sum + repo.stats.lineage, 0)}
                      </p>
                    </div>
                    <GitBranch className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Dependencies</p>
                      <p className="text-2xl font-bold">
                        {repositories.reduce((sum, repo) => sum + repo.stats.dependencies, 0)}
                      </p>
                    </div>
                    <Network className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Repository Status */}
            <Card>
              <CardHeader>
                <CardTitle>Repository Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {repositories.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedRepo(repo.id);
                        setActiveTab('processing');
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {getStatusIcon(repo.status)}
                        <div>
                          <p className="font-medium">{repo.name}</p>
                          <p className="text-sm text-gray-600">{repo.fullName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{calculateProgress(repo.stats)}% Complete</p>
                          <p className="text-xs text-gray-500">
                            {repo.stats.files} files • {repo.stats.dependencies} deps
                          </p>
                        </div>
                        {getStatusBadge(repo.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processing">
            <MetadataProcessingDashboard />
          </TabsContent>

          <TabsContent value="repositories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Repository Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {repositories.map((repo) => (
                    <div key={repo.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-medium">{repo.name}</h3>
                          <p className="text-sm text-gray-600">{repo.fullName}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            Configure
                          </Button>
                          <Button size="sm">
                            Process
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-4 text-center">
                        <div>
                          <p className="text-lg font-bold text-blue-600">{repo.stats.files}</p>
                          <p className="text-xs text-gray-600">Files</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-green-600">{repo.stats.documentation}</p>
                          <p className="text-xs text-gray-600">Documentation</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-purple-600">{repo.stats.vectors}</p>
                          <p className="text-xs text-gray-600">Vectors</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-orange-600">{repo.stats.lineage}</p>
                          <p className="text-xs text-gray-600">Lineage</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-red-600">{repo.stats.dependencies}</p>
                          <p className="text-xs text-gray-600">Dependencies</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Analytics & Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-medium">Processing Trends</h3>
                    <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">Processing trend chart</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-medium">Dependency Health</h3>
                    <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      <p className="text-gray-500">Dependency health metrics</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 