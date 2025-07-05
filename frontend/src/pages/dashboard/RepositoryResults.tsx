import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../../config/supabaseClient';
import { 
  ArrowLeft, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  Download,
  Eye,
  Brain,
  BarChart3,
  GitBranch,
  Database,
  Zap,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface FileResult {
  id: string;
  file_path: string;
  language: string;
  parsing_status: string;
  vector_status: string;
  lineage_status: string;
  documentation_summary?: any;
  created_at: string;
  updated_at: string;
}

interface ProcessingStats {
  totalFiles: number;
  documentationCompleted: number;
  vectorsCompleted: number;
  lineageCompleted: number;
  failed: number;
  pending: number;
}

export const RepositoryResults: React.FC = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  
  const [files, setFiles] = useState<FileResult[]>([]);
  const [stats, setStats] = useState<ProcessingStats>({
    totalFiles: 0,
    documentationCompleted: 0,
    vectorsCompleted: 0,
    lineageCompleted: 0,
    failed: 0,
    pending: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedFile, setSelectedFile] = useState<FileResult | null>(null);

  const repoFullName = `${owner}/${repo}`;

  useEffect(() => {
    loadRepositoryResults();
  }, [owner, repo]);

  const loadRepositoryResults = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session found. Please log in again.');
      }

      // Fetch files and their processing status
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select(`
          id,
          file_path,
          language,
          parsing_status,
          processing_jobs (
            status,
            vector_status,
            lineage_status
          ),
          code_summaries (
            summary_json
          )
        `)
        .eq('repository_full_name', repoFullName)
        .order('file_path');

      if (filesError) {
        throw new Error(`Failed to load files: ${filesError.message}`);
      }

      // Process the data
      const processedFiles: FileResult[] = filesData.map(file => ({
        id: file.id,
        file_path: file.file_path,
        language: file.language,
        parsing_status: file.parsing_status,
        vector_status: file.processing_jobs?.[0]?.vector_status || 'pending',
        lineage_status: file.processing_jobs?.[0]?.lineage_status || 'pending',
        documentation_summary: file.code_summaries?.[0]?.summary_json,
        created_at: file.created_at,
        updated_at: file.updated_at
      }));

      // Calculate stats
      const totalFiles = processedFiles.length;
      const documentationCompleted = processedFiles.filter(f => f.parsing_status === 'completed').length;
      const vectorsCompleted = processedFiles.filter(f => f.vector_status === 'completed').length;
      const lineageCompleted = processedFiles.filter(f => f.lineage_status === 'completed').length;
      const failed = processedFiles.filter(f => 
        f.parsing_status === 'failed' || f.vector_status === 'failed' || f.lineage_status === 'failed'
      ).length;
      const pending = processedFiles.filter(f => 
        f.parsing_status === 'pending' || f.vector_status === 'pending' || f.lineage_status === 'pending'
      ).length;

      setFiles(processedFiles);
      setStats({
        totalFiles,
        documentationCompleted,
        vectorsCompleted,
        lineageCompleted,
        failed,
        pending
      });

    } catch (error) {
      console.error('Error loading repository results:', error);
      setError(error instanceof Error ? error.message : 'Failed to load repository results');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.file_path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'completed' && file.parsing_status === 'completed') ||
      (filterStatus === 'failed' && (file.parsing_status === 'failed' || file.vector_status === 'failed' || file.lineage_status === 'failed')) ||
      (filterStatus === 'pending' && (file.parsing_status === 'pending' || file.vector_status === 'pending' || file.lineage_status === 'pending'));
    
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleFileClick = (file: FileResult) => {
    setSelectedFile(file);
  };

  const handleViewInBrowser = () => {
    navigate('/dashboard/code', { state: { selectedRepo: { full_name: repoFullName } } });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading repository results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Results</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard/code')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Repositories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard/code')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Repositories</span>
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{repoFullName}</h1>
                <p className="text-sm text-gray-500">Processing Results</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleViewInBrowser}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>View in Browser</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Files</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Documentation</p>
                <p className="text-2xl font-bold text-green-600">{stats.documentationCompleted}</p>
              </div>
              <Brain className="w-8 h-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Vectors</p>
                <p className="text-2xl font-bold text-purple-600">{stats.vectorsCompleted}</p>
              </div>
              <Zap className="w-8 h-8 text-purple-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Lineage</p>
                <p className="text-2xl font-bold text-blue-600">{stats.lineageCompleted}</p>
              </div>
              <GitBranch className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>
        </div>

        {/* Files Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Table Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Processed Files</h2>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Path</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documentation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vectors</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lineage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFiles.map((file) => (
                  <motion.tr
                    key={file.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleFileClick(file)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">{file.file_path}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {file.language}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(file.parsing_status)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(file.parsing_status)}`}>
                          {file.parsing_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(file.vector_status)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(file.vector_status)}`}>
                          {file.vector_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(file.lineage_status)}
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(file.lineage_status)}`}>
                          {file.lineage_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Navigate to file details or open in browser
                          handleViewInBrowser();
                        }}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredFiles.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
              <p className="text-gray-500">
                {searchQuery || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'No files have been processed for this repository yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 