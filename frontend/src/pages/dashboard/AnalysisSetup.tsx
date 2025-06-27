import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { processRepositoryForInsights } from '../../services/githubService';
import { supabase } from '../../config/supabaseClient';
import { useProcessingStatus } from '../../context/ProcessingStatusContext';
import { 
  ArrowLeft, 
  Settings, 
  Code, 
  Building, 
  BookOpen, 
  Save, 
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  PlayCircle
} from 'lucide-react';

interface AnalysisSetupProps {}

export const AnalysisSetup: React.FC<AnalysisSetupProps> = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const { startProcessing, getStatus } = useProcessingStatus();
  
  // Form state
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [businessOverview, setBusinessOverview] = useState('');
  const [namingStandards, setNamingStandards] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Get processing status from context
  const repoFullName = `${owner}/${repo}`;
  const processingStatus = getStatus(repoFullName);
  const isProcessing = processingStatus?.isPolling || false;
  const showProgress = !!processingStatus;

  // Debug logging
  React.useEffect(() => {
    console.log('AnalysisSetup - Processing status for', repoFullName, ':', processingStatus);
  }, [repoFullName, processingStatus]);

  const availableLanguages = [
    { 
      value: 'postgres', 
      label: 'PostgreSQL'
    },
    { 
      value: 'mysql', 
      label: 'MySQL'
    },
    { 
      value: 'dbt', 
      label: 'dbt '
    },
    { 
      value: 'tsql', 
      label: 'T-SQL (SQL Server)'
    },
    { 
      value: 'plsql', 
      label: 'PL/SQL (Oracle)'
    },
    { 
      value: 'pyspark', 
      label: 'PySpark'
    },
    { 
      value: 'python', 
      label: 'Python'
    },
  ];

  // Check if processing is complete and handle navigation
  useEffect(() => {
    if (processingStatus && processingStatus.progress >= 100 && !processingStatus.isPolling) {
      setSuccess('Repository analysis completed successfully!');
      
      // Navigate back after a delay
      setTimeout(() => {
        navigate('/dashboard/code');
      }, 3000);
    }
  }, [processingStatus, navigate]);

  const handleSave = async () => {
    if (!owner || !repo) {
      setError('Invalid repository information');
      return;
    }

    if (!selectedLanguage) {
      setError('Please select a programming language/framework for analysis');
      return;
    }

    console.log('AnalysisSetup: Starting save process for:', `${owner}/${repo}`);
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      console.log('AnalysisSetup: Session check:', { 
        hasSession: !!session, 
        hasAccessToken: !!session?.access_token,
        tokenLength: session?.access_token?.length 
      });
      
      if (!session?.access_token) {
        throw new Error('No active session found. Please log in again.');
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const requestPayload = {
        repoFullName: `${owner}/${repo}`,
        businessOverview,
        namingStandards,
        language: selectedLanguage
      };
      
      console.log('AnalysisSetup: Making API call:', {
        url: `${API_BASE_URL}/api/documentation/settings`,
        payload: requestPayload,
        hasToken: !!session.access_token,
        tokenPreview: session.access_token ? `${session.access_token.substring(0, 20)}...` : 'none'
      });
      
      const response = await fetch(`${API_BASE_URL}/api/documentation/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('AnalysisSetup: API response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Settings save error response:', response.status, response.statusText, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || response.statusText };
        }
        
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        }
        
        throw new Error(errorData.error || `Failed to save settings (${response.status})`);
      }

      setSuccess('Settings saved successfully! Starting repository analysis...');
      
      // Start repository processing
      await startRepositoryProcessing();

    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard/code');
  };

  const startRepositoryProcessing = async () => {
    try {
      console.log('Starting repository processing for:', repoFullName);
      
      // Start the repository processing
      await processRepositoryForInsights(`${owner}/${repo}`, selectedLanguage);
      console.log('Repository processing API call completed');
      
      // Start polling for progress using context
      console.log('Starting processing status polling via context');
      startProcessing(repoFullName);
      console.log('Context startProcessing called');
      
    } catch (error) {
      console.error('Error starting repository processing:', error);
      setError('Failed to start repository processing');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleCancel}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Repositories
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center space-x-2">
                <Settings className="h-6 w-6 text-[#2AB7A9]" />
                <h1 className="text-xl font-bold text-gray-900">Analysis Setup</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-[#2AB7A9] to-[#24a497] px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Configure Analysis for</h2>
                <p className="text-[#a8f0e6] mt-1 text-lg font-semibold">{owner}/{repo}</p>
                <p className="text-[#a8f0e6] mt-2 text-sm">
                  Configure analysis settings to generate optimized documentation for your repository.
                </p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-lg p-3">
                <Code className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-6">
            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <span className="text-red-700 font-medium">Error</span>
                </div>
                <p className="text-red-600 mt-1">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-green-700 font-medium">Success</span>
                </div>
                <p className="text-green-600 mt-1">{success}</p>
              </div>
            )}

            {/* Technology Stack Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Code className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Technology Stack</h3>
                    <p className="text-gray-600 text-sm">Select the primary technology for <span className="font-mono text-[#2AB7A9] font-semibold">{owner}/{repo}</span></p>
                  </div>
                </div>
              </div>
              
              <div className="relative group">
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full appearance-none bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-xl px-5 py-4 pr-12 
                           focus:ring-4 focus:ring-[#2AB7A9]/20 focus:border-[#2AB7A9] focus:bg-white focus:shadow-lg
                           hover:border-[#2AB7A9]/60 hover:shadow-md hover:bg-white
                           text-base font-semibold text-gray-800 cursor-pointer 
                           transition-all duration-300 ease-in-out
                           group-hover:scale-[1.01] transform"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  }}
                >
                  <option value="" disabled className="text-gray-400 font-medium">
                    🚀 Select your technology stack
                  </option>
                  {availableLanguages.map((lang) => (
                    <option 
                      key={lang.value} 
                      value={lang.value} 
                      className="py-3 px-2 text-gray-800 font-medium hover:bg-[#2AB7A9]/10 focus:bg-[#2AB7A9]/20"
                    >
                      {lang.label} 
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <div className="bg-gradient-to-r from-[#2AB7A9] to-[#20a39e] p-2 rounded-lg shadow-sm group-hover:shadow-md transition-shadow duration-300">
                    <ChevronDown className="h-4 w-4 text-white" />
                  </div>
                </div>
                
                {/* Enhanced Focus Ring */}
                <div className="absolute inset-0 rounded-xl border-2 border-transparent 
                              peer-focus:border-[#2AB7A9] peer-focus:shadow-lg 
                              pointer-events-none transition-all duration-300"></div>
              </div>
            </div>

            {/* Business Overview Section */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Business Overview</h3>
                  <p className="text-gray-600 text-sm">Project context, databases, JIRA boards, stakeholders</p>
                </div>
              </div>
              
              <textarea
                value={businessOverview}
                onChange={(e) => setBusinessOverview(e.target.value)}
                placeholder="Example: E-commerce analytics platform processing customer orders. Databases: customer_db, orders_db, analytics_warehouse. Schemas: public, staging, mart. JIRA: ECOM-123. Confluence: Analytics Team."
                className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-sm"
                rows={4}
              />
            </div>

            {/* Naming Standards Section */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BookOpen className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Naming Standards</h3>
                  <p className="text-gray-600 text-sm">Table/column naming, coding conventions, file organization</p>
                </div>
              </div>
              
              <textarea
                value={namingStandards}
                onChange={(e) => setNamingStandards(e.target.value)}
                placeholder="Example: Tables: snake_case with prefixes (dim_, fact_, stg_). Columns: lowercase with underscores (customer_id, order_created_date). dbt models: staging 'stg_', marts 'fct_' or 'dim_'. Python: PEP 8, classes PascalCase, functions snake_case."
                className="w-full h-24 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-sm"
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleCancel}
                disabled={isLoading || isProcessing}
                className="px-6 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isLoading || isProcessing}
                className="px-6 py-2.5 bg-[#2AB7A9] text-white rounded-lg hover:bg-[#24a497] disabled:opacity-50 transition-colors flex items-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : isProcessing ? (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2 animate-pulse" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Start Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Processing Status Section */}
        {showProgress && processingStatus && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Processing Status</h3>
                  <p className="text-blue-100 text-sm">
                    {processingStatus.isPolling ? 'Analyzing repository files...' : 'Analysis complete'}
                  </p>
                </div>
                <div className="bg-white bg-opacity-20 rounded-lg p-3">
                  {processingStatus.isPolling ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-white" />
                  )}
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                  <span className="text-sm font-medium text-gray-900">{Math.round(processingStatus.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-[#2AB7A9] to-[#20a39e] h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${processingStatus.progress}%` }}
                  ></div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{processingStatus.totalFiles}</div>
                  <div className="text-sm text-blue-700">Total Files</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{processingStatus.completed}</div>
                  <div className="text-sm text-green-700">Completed</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{processingStatus.pending}</div>
                  <div className="text-sm text-yellow-700">Pending</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{processingStatus.failed}</div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
              </div>

              {/* Detailed Status List */}
              {processingStatus.detailedStatus && processingStatus.detailedStatus.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">File Processing Details</h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {processingStatus.detailedStatus.map((file: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {file.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            {file.status === 'processing' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                            {file.status === 'pending' && <Clock className="h-5 w-5 text-yellow-500" />}
                            {file.status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{file.filePath}</div>
                            {file.error && (
                              <div className="text-sm text-red-600">{file.error}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            file.status === 'completed' ? 'bg-green-100 text-green-800' :
                            file.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            file.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {file.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 