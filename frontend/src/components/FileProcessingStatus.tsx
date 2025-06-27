import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Loader2,
  Filter,
  Search,
  Download,
  RefreshCw
} from 'lucide-react';
import { getProcessingStatus } from '../services/githubService';

interface FileStatus {
  filePath: string;
  status: 'completed' | 'failed' | 'pending' | 'processing';
  documentationStatus?: string;
  vectorStatus?: string;
  overallStatus?: string;
  error?: string;
  documentationError?: string;
  vectorError?: string;
  vectorChunks?: number;
  lastProcessed?: string;
  processingTime?: number;
  isFullyProcessed?: boolean;
}

interface ProcessingStatusData {
  progress: number;
  totalFiles: number;
  completed: number;
  failed: number;
  pending: number;
  // New comprehensive status fields
  overallCompleted?: number;
  overallProgress?: number;
  documentation?: {
    completed: number;
    failed: number;
    pending: number;
    progress: number;
  };
  vectors?: {
    completed: number;
    failed: number;
    pending: number;
    progress: number;
  };
  detailedStatus?: FileStatus[];
  lastUpdated: string;
  startedAt: string;
  completedAt?: string;
}

export const FileProcessingStatus: React.FC = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const [statusData, setStatusData] = useState<ProcessingStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'pending' | 'doc-completed' | 'vector-completed' | 'fully-processed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const repoFullName = `${owner}/${repo}`;

  useEffect(() => {
    loadProcessingStatus();
    
    // Set up smart auto-refresh that stops when processing is complete
    const interval = setInterval(() => {
      if (!loading && !isAutoRefreshing) {
        // Check if processing is still ongoing
        const isProcessingOngoing = statusData && (
          (statusData.documentation && statusData.documentation.pending > 0) ||
          (statusData.vectors && statusData.vectors.pending > 0) ||
          (statusData.overallProgress !== undefined && statusData.overallProgress < 100) ||
          (statusData.progress !== undefined && statusData.progress < 100)
        );
        
        // Only auto-refresh if processing is ongoing
        if (isProcessingOngoing) {
          loadProcessingStatus(true);
        }
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [owner, repo]);

  const loadProcessingStatus = async (isAutoRefresh = false) => {
    if (!owner || !repo) return;
    
    if (isAutoRefresh) {
      setIsAutoRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const status = await getProcessingStatus(repoFullName);
      setStatusData(status);
    } catch (err) {
      console.error('Error loading processing status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load processing status');
    } finally {
      if (isAutoRefresh) {
        setIsAutoRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'pending':
        return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'processing':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const filteredFiles = statusData?.detailedStatus?.filter(file => {
    // Enhanced filtering for separate tracking
    let matchesFilter = false;
    
    switch (filter) {
      case 'all':
        matchesFilter = true;
        break;
      case 'completed':
        // Legacy completed status
        matchesFilter = (file.overallStatus || file.status) === 'completed';
        break;
      case 'failed':
        // Legacy failed status
        matchesFilter = (file.overallStatus || file.status) === 'failed';
        break;
      case 'pending':
        // Legacy pending status
        matchesFilter = (file.overallStatus || file.status) === 'pending';
        break;
      case 'doc-completed':
        matchesFilter = file.documentationStatus === 'completed';
        break;
      case 'vector-completed':
        matchesFilter = file.vectorStatus === 'completed';
        break;
      case 'fully-processed':
        matchesFilter = file.isFullyProcessed === true;
        break;
      default:
        matchesFilter = (file.overallStatus || file.status) === filter;
    }
    
    const matchesSearch = searchQuery === '' || 
      file.filePath.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  }) || [];

  const getFilterCount = (filterType: string) => {
    if (!statusData?.detailedStatus) return 0;
    if (filterType === 'all') return statusData.detailedStatus.length;
    
    return statusData.detailedStatus.filter(file => {
      switch (filterType) {
        case 'completed':
          return (file.overallStatus || file.status) === 'completed';
        case 'failed':
          return (file.overallStatus || file.status) === 'failed';
        case 'pending':
          return (file.overallStatus || file.status) === 'pending';
        case 'doc-completed':
          return file.documentationStatus === 'completed';
        case 'vector-completed':
          return file.vectorStatus === 'completed';
        case 'fully-processed':
          return file.isFullyProcessed === true;
        default:
          return (file.overallStatus || file.status) === filterType;
      }
    }).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-3 text-gray-600">Loading processing status...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Status</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => loadProcessingStatus(false)}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate('/dashboard/code')}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Repositories
            </button>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{repoFullName}</h1>
                <div className="flex items-center space-x-2">
                  <p className="text-gray-600">File Processing Status</p>
                  {isAutoRefreshing && (
                    <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1"></div>
                      Auto-refreshing...
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => loadProcessingStatus(false)}
                disabled={loading || isAutoRefreshing}
                className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(loading || isAutoRefreshing) ? 'animate-spin' : ''}`} />
                {isAutoRefreshing ? 'Auto-refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Summary Stats */}
            {statusData && (
              <>
                {/* Overall Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm font-medium text-gray-900">
                      {Math.round(statusData.overallProgress || statusData.progress || 0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${statusData.overallProgress || statusData.progress || 0}%` }}
                    />
                  </div>
                </div>

                {/* Comprehensive Stats */}
                {statusData.documentation && statusData.vectors ? (
                  <>
                    {/* New comprehensive format */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gray-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-gray-900">{statusData.totalFiles}</div>
                        <div className="text-sm text-gray-600">Total Files</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{statusData.overallCompleted}</div>
                        <div className="text-sm text-gray-600">Fully Processed</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {(statusData.documentation.failed || 0) + (statusData.vectors.failed || 0)}
                        </div>
                        <div className="text-sm text-gray-600">Failed</div>
                      </div>
                      <div className="bg-orange-50 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {(statusData.documentation.pending || 0) + (statusData.vectors.pending || 0)}
                        </div>
                        <div className="text-sm text-gray-600">Pending</div>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Documentation Stats */}
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <h4 className="font-semibold text-blue-900">Documentation</h4>
                          </div>
                          <span className="text-sm font-medium text-blue-700">
                            {Math.round(statusData.documentation.progress)}%
                          </span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${statusData.documentation.progress}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-bold text-green-600">{statusData.documentation.completed}</div>
                            <div className="text-gray-600">Done</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-red-600">{statusData.documentation.failed}</div>
                            <div className="text-gray-600">Failed</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-orange-600">{statusData.documentation.pending}</div>
                            <div className="text-gray-600">Pending</div>
                          </div>
                        </div>
                      </div>

                      {/* Vector Stats */}
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Search className="h-5 w-5 text-purple-600" />
                            <h4 className="font-semibold text-purple-900">Vector Embeddings</h4>
                          </div>
                          <span className="text-sm font-medium text-purple-700">
                            {Math.round(statusData.vectors.progress)}%
                          </span>
                        </div>
                        <div className="w-full bg-purple-200 rounded-full h-2 mb-3">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${statusData.vectors.progress}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-bold text-green-600">{statusData.vectors.completed}</div>
                            <div className="text-gray-600">Done</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-red-600">{statusData.vectors.failed}</div>
                            <div className="text-gray-600">Failed</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-orange-600">{statusData.vectors.pending}</div>
                            <div className="text-gray-600">Pending</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Legacy format */
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">{statusData.totalFiles}</div>
                      <div className="text-sm text-gray-600">Total Files</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{statusData.completed}</div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{statusData.failed}</div>
                      <div className="text-sm text-gray-600">Failed</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{statusData.pending}</div>
                      <div className="text-sm text-gray-600">Pending</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1">
              {[
                { key: 'all', label: 'All Files', color: 'bg-[#2AB7A9]' },
                { key: 'fully-processed', label: '✅ Fully Processed', color: 'bg-green-600' },
                { key: 'doc-completed', label: '📄 Docs Done', color: 'bg-blue-600' },
                { key: 'vector-completed', label: '🔍 Vectors Done', color: 'bg-purple-600' },
                { key: 'pending', label: '⏳ Pending', color: 'bg-orange-600' },
                { key: 'failed', label: '❌ Failed', color: 'bg-red-600' }
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filter === key
                      ? `${color} text-white`
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {label} ({getFilterCount(key)})
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* File List */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Files ({filteredFiles.length})
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {filteredFiles.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p>No files found matching your criteria.</p>
              </div>
            ) : (
              filteredFiles.map((file, index) => (
                <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getStatusIcon(file.overallStatus || file.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.filePath}
                          </p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(file.overallStatus || file.status)}`}>
                            {file.isFullyProcessed ? 'Fully Processed' : (file.overallStatus || file.status)}
                          </span>
                        </div>
                        
                        {/* Enhanced status breakdown for new format */}
                        {file.documentationStatus && file.vectorStatus && (
                          <div className="flex items-center space-x-4 mb-2">
                            <div className="flex items-center space-x-1">
                              <FileText className="h-3 w-3 text-blue-500" />
                              <span className="text-xs text-gray-600">Doc:</span>
                              <span className={`text-xs font-medium ${
                                file.documentationStatus === 'completed' ? 'text-green-600' :
                                file.documentationStatus === 'failed' ? 'text-red-600' :
                                file.documentationStatus === 'processing' ? 'text-blue-600' :
                                'text-orange-600'
                              }`}>
                                {file.documentationStatus}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Search className="h-3 w-3 text-purple-500" />
                              <span className="text-xs text-gray-600">Vector:</span>
                              <span className={`text-xs font-medium ${
                                file.vectorStatus === 'completed' ? 'text-green-600' :
                                file.vectorStatus === 'failed' ? 'text-red-600' :
                                file.vectorStatus === 'processing' ? 'text-blue-600' :
                                'text-orange-600'
                              }`}>
                                {file.vectorStatus}
                              </span>
                              {file.vectorChunks && file.vectorChunks > 0 && (
                                <span className="text-xs text-gray-500">
                                  ({file.vectorChunks} chunks)
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Error messages */}
                        {file.documentationError && (
                          <p className="text-sm text-red-600 mt-1">
                            <strong>Doc Error:</strong> {file.documentationError}
                          </p>
                        )}
                        {file.vectorError && (
                          <p className="text-sm text-red-600 mt-1">
                            <strong>Vector Error:</strong> {file.vectorError}
                          </p>
                        )}
                        {file.error && !file.documentationError && !file.vectorError && (
                          <p className="text-sm text-red-600 mt-1">{file.error}</p>
                        )}
                        
                        {/* Processing time info */}
                        {file.lastProcessed && (
                          <p className="text-xs text-gray-500 mt-1">
                            Processed: {new Date(file.lastProcessed).toLocaleString()}
                            {file.processingTime && ` (${file.processingTime}ms)`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 