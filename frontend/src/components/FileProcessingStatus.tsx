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
  error?: string;
  lastProcessed?: string;
  processingTime?: number;
}

interface ProcessingStatusData {
  progress: number;
  totalFiles: number;
  completed: number;
  failed: number;
  pending: number;
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
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const repoFullName = `${owner}/${repo}`;

  useEffect(() => {
    loadProcessingStatus();
  }, [owner, repo]);

  const loadProcessingStatus = async () => {
    if (!owner || !repo) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const status = await getProcessingStatus(repoFullName);
      setStatusData(status);
    } catch (err) {
      console.error('Error loading processing status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load processing status');
    } finally {
      setLoading(false);
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
    const matchesFilter = filter === 'all' || file.status === filter;
    const matchesSearch = searchQuery === '' || 
      file.filePath.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  }) || [];

  const getFilterCount = (filterType: string) => {
    if (!statusData?.detailedStatus) return 0;
    if (filterType === 'all') return statusData.detailedStatus.length;
    return statusData.detailedStatus.filter(file => file.status === filterType).length;
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
              onClick={loadProcessingStatus}
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
                <p className="text-gray-600">File Processing Status</p>
              </div>
              <button
                onClick={loadProcessingStatus}
                className="flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>
            </div>

            {/* Summary Stats */}
            {statusData && (
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
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            {/* Filter Tabs */}
            <div className="flex space-x-1">
              {[
                { key: 'all', label: 'All Files' },
                { key: 'completed', label: 'Completed' },
                { key: 'failed', label: 'Failed' },
                { key: 'pending', label: 'Pending' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as any)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filter === key
                      ? 'bg-[#2AB7A9] text-white'
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
                      {getStatusIcon(file.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.filePath}
                          </p>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(file.status)}`}>
                            {file.status}
                          </span>
                        </div>
                        {file.error && (
                          <p className="text-sm text-red-600 mt-1">{file.error}</p>
                        )}
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