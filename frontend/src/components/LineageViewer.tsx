import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Database, 
  GitBranch, 
  Search, 
  Filter,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ArrowRight,
  Eye,
  Settings,
  Zap
} from 'lucide-react';

interface DataAsset {
  id: string;
  assetName: string;
  assetType: string;
  fullQualifiedName: string;
  filePath: string;
  language?: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface LineageRelationship {
  id: string;
  sourceAsset: {
    id: string;
    name: string;
    type: string;
    fullQualifiedName: string;
    filePath: string;
  };
  targetAsset: {
    id: string;
    name: string;
    type: string;
    fullQualifiedName: string;
    filePath: string;
  };
  relationshipType: string;
  confidenceScore: number;
  transformationLogic?: string;
  businessContext?: string;
}

interface LineageStatus {
  status: string;
  statistics: {
    totalFiles: number;
    filesWithLineage: number;
    totalAssets: number;
    totalRelationships: number;
    avgConfidenceScore: number;
    assetTypeBreakdown: Record<string, number>;
    relationshipTypeBreakdown: Record<string, number>;
  };
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface LineageViewerProps {
  repositoryFullName: string;
  onProcessLineage?: () => void;
}

export const LineageViewer: React.FC<LineageViewerProps> = ({
  repositoryFullName,
  onProcessLineage
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'relationships' | 'graph'>('overview');
  const [lineageStatus, setLineageStatus] = useState<LineageStatus | null>(null);
  const [dataAssets, setDataAssets] = useState<DataAsset[]>([]);
  const [relationships, setRelationships] = useState<LineageRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [confidenceFilter, setConfidenceFilter] = useState<number>(0.5);

  // Fetch lineage status
  const fetchLineageStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/lineage/status/${repositoryFullName}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch lineage status');
      }
      
      const data = await response.json();
      setLineageStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data assets
  const fetchDataAssets = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (assetTypeFilter) params.append('assetType', assetTypeFilter);
      if (searchTerm) params.append('search', searchTerm);
      params.append('limit', '100');
      
      const response = await fetch(`/api/lineage/assets/${repositoryFullName}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch data assets');
      }
      
      const data = await response.json();
      setDataAssets(data.assets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch relationships
  const fetchRelationships = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      params.append('minConfidence', confidenceFilter.toString());
      params.append('limit', '200');
      
      const response = await fetch(`/api/lineage/relationships/${repositoryFullName}?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch relationships');
      }
      
      const data = await response.json();
      setRelationships(data.relationships || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Process lineage for repository
  const processLineage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/lineage/process-repository/${repositoryFullName}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          forceReprocess: false
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start lineage processing');
      }
      
      const data = await response.json();
      alert(`Lineage processing started for ${data.filesQueued} files`);
      
      // Refresh status
      setTimeout(() => fetchLineageStatus(), 2000);
      
      if (onProcessLineage) {
        onProcessLineage();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Load data based on active tab
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchLineageStatus();
    } else if (activeTab === 'assets') {
      fetchDataAssets();
    } else if (activeTab === 'relationships') {
      fetchRelationships();
    }
  }, [activeTab, repositoryFullName, assetTypeFilter, searchTerm, confidenceFilter]);

  // Helper functions
  const getAssetTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'table': return <Database className="h-4 w-4" />;
      case 'view': return <Eye className="h-4 w-4" />;
      case 'function': return <Settings className="h-4 w-4" />;
      case 'procedure': return <Zap className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const getRelationshipTypeColor = (type: string) => {
    switch (type) {
      case 'reads_from': return 'text-blue-600 bg-blue-100';
      case 'writes_to': return 'text-green-600 bg-green-100';
      case 'transforms': return 'text-purple-600 bg-purple-100';
      case 'joins': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading && !lineageStatus && !dataAssets.length && !relationships.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <span className="text-gray-600">Loading lineage data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Network className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Data Lineage</h2>
              <p className="text-gray-600">Track data flow and dependencies across your codebase</p>
            </div>
          </div>
          
          {lineageStatus?.status !== 'completed' && (
            <button
              onClick={processLineage}
              disabled={loading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <GitBranch className="h-4 w-4 mr-2" />
              )}
              Process Lineage
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800 font-medium">Error: {error}</span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'assets', label: 'Data Assets', icon: Database },
              { id: 'relationships', label: 'Relationships', icon: GitBranch },
              { id: 'graph', label: 'Graph View', icon: Network }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && lineageStatus && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className={`flex items-center p-4 rounded-lg ${
                lineageStatus.status === 'completed' ? 'bg-green-50 border border-green-200' :
                lineageStatus.status === 'processing' ? 'bg-yellow-50 border border-yellow-200' :
                'bg-gray-50 border border-gray-200'
              }`}>
                {lineageStatus.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                ) : lineageStatus.status === 'processing' ? (
                  <Loader2 className="h-5 w-5 text-yellow-600 mr-3 animate-spin" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-gray-600 mr-3" />
                )}
                <div>
                  <p className="font-medium">
                    Status: <span className="capitalize">{lineageStatus.status}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    {lineageStatus.progress.completed} of {lineageStatus.progress.total} files processed 
                    ({lineageStatus.progress.percentage}%)
                  </p>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Database className="h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-sm font-medium text-blue-800">Total Assets</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {lineageStatus.statistics.totalAssets}
                  </p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <GitBranch className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-sm font-medium text-green-800">Relationships</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900 mt-1">
                    {lineageStatus.statistics.totalRelationships}
                  </p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <BarChart3 className="h-5 w-5 text-purple-600 mr-2" />
                    <span className="text-sm font-medium text-purple-800">Avg Confidence</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900 mt-1">
                    {Math.round(lineageStatus.statistics.avgConfidenceScore * 100)}%
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <Network className="h-5 w-5 text-orange-600 mr-2" />
                    <span className="text-sm font-medium text-orange-800">Files Processed</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {lineageStatus.statistics.filesWithLineage}
                  </p>
                </div>
              </div>

              {/* Asset Type Breakdown */}
              {lineageStatus.statistics.assetTypeBreakdown && 
               Object.keys(lineageStatus.statistics.assetTypeBreakdown).length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Asset Types</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(lineageStatus.statistics.assetTypeBreakdown).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between bg-white rounded-lg p-3">
                        <div className="flex items-center">
                          {getAssetTypeIcon(type)}
                          <span className="ml-2 text-sm font-medium capitalize">{type}</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Assets Tab */}
          {activeTab === 'assets' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={assetTypeFilter}
                    onChange={(e) => setAssetTypeFilter(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Types</option>
                    <option value="table">Tables</option>
                    <option value="view">Views</option>
                    <option value="function">Functions</option>
                    <option value="procedure">Procedures</option>
                  </select>
                </div>
              </div>

              {/* Assets List */}
              <div className="space-y-3">
                {dataAssets.map((asset) => (
                  <div key={asset.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getAssetTypeIcon(asset.assetType)}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">{asset.assetName}</h3>
                          <p className="text-sm text-gray-600">{asset.fullQualifiedName}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {asset.filePath} • {asset.language}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                        asset.assetType === 'table' ? 'bg-blue-100 text-blue-800' :
                        asset.assetType === 'view' ? 'bg-green-100 text-green-800' :
                        asset.assetType === 'function' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {asset.assetType}
                      </span>
                    </div>
                  </div>
                ))}
                
                {dataAssets.length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500">
                    <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p>No data assets found. Try processing lineage first.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Relationships Tab */}
          {activeTab === 'relationships' && (
            <div className="space-y-4">
              {/* Confidence Filter */}
              <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Min Confidence:</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={confidenceFilter}
                  onChange={(e) => setConfidenceFilter(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-gray-900">{Math.round(confidenceFilter * 100)}%</span>
              </div>

              {/* Relationships List */}
              <div className="space-y-3">
                {relationships.map((rel) => (
                  <div key={rel.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRelationshipTypeColor(rel.relationshipType)}`}>
                          {rel.relationshipType.replace('_', ' ')}
                        </span>
                        <span className={`text-sm font-medium ${getConfidenceColor(rel.confidenceScore)}`}>
                          {Math.round(rel.confidenceScore * 100)}% confidence
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{rel.sourceAsset.name}</p>
                        <p className="text-sm text-gray-600">{rel.sourceAsset.fullQualifiedName}</p>
                        <p className="text-xs text-gray-500">{rel.sourceAsset.filePath}</p>
                      </div>
                      
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                      
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{rel.targetAsset.name}</p>
                        <p className="text-sm text-gray-600">{rel.targetAsset.fullQualifiedName}</p>
                        <p className="text-xs text-gray-500">{rel.targetAsset.filePath}</p>
                      </div>
                    </div>
                    
                    {rel.transformationLogic && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Transformation:</span> {rel.transformationLogic}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                
                {relationships.length === 0 && !loading && (
                  <div className="text-center py-8 text-gray-500">
                    <GitBranch className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p>No relationships found. Try lowering the confidence threshold.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Graph Tab (Placeholder) */}
          {activeTab === 'graph' && (
            <div className="text-center py-12">
              <Network className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Graph Visualization</h3>
              <p className="text-gray-600 mb-4">
                Interactive graph visualization will be implemented in the next phase.
              </p>
              <p className="text-sm text-gray-500">
                This will show nodes and edges representing your data assets and their relationships.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 