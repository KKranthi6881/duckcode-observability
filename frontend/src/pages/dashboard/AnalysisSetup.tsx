import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { processRepositoryForInsights } from '../../services/githubService';
import { sequentialProcessingService } from '../../services/sequential-processing.service';
import { supabase } from '../../config/supabaseClient';
import { useProcessingStatus } from '../../context/ProcessingStatusContext';
import { SequentialProcessingCard } from '../../components/SequentialProcessingCard';
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
  PlayCircle,
  Brain,
  Zap,
  Sparkles
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
  
  // Sequential processing state
  const [sequentialStatus, setSequentialStatus] = useState<any>(null);
  const [isProcessingStarted, setIsProcessingStarted] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
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
      console.log('🚀 Starting sequential processing for repository:', `${owner}/${repo}`);
      
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session found. Please log in again.');
      }

      console.log('📡 Calling sequential processing service...');
      
      // Start sequential processing with selected language
      const response = await sequentialProcessingService.startSequentialProcessing(
        `${owner}/${repo}`, 
        session.access_token,
        selectedLanguage
      );
      
      console.log('✅ Sequential processing started successfully:', response);
      setIsProcessingStarted(true);
      setSuccess('Sequential processing started successfully! Monitoring progress...');
      
      // Start polling for status updates
      startStatusPolling(session.access_token);
      
    } catch (error) {
      console.error('❌ Error starting sequential processing:', error);
      setError(error instanceof Error ? error.message : 'Failed to start sequential processing');
    }
  };

  const startStatusPolling = (token: string) => {
    // Clear any existing polling
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const pollStatus = async () => {
      try {
        const status = await sequentialProcessingService.getSequentialStatus(repoFullName, token);
        setSequentialStatus(status);
        
        // Stop polling if completed or failed
        if (status.status === 'completed' || status.status === 'error') {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
          
          if (status.status === 'completed') {
            setSuccess('🎉 Sequential processing completed successfully! You can now view your repository insights.');
            // Auto-navigate after a delay
            setTimeout(() => {
              navigate('/dashboard/code');
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    };

    // Poll immediately and then every 5 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    setPollingInterval(interval);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

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

        {/* Sequential Processing Status */}
        <AnimatePresence>
          {isProcessingStarted && sequentialStatus && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <SequentialProcessingCard
                repositoryName={repoFullName}
                currentPhase={sequentialStatus.currentPhase || 'documentation'}
                overallProgress={sequentialStatus.progress || 0}
                status={sequentialStatus.status || 'processing'}
                phases={sequentialStatus.phases || {}}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message with Animation */}
        <AnimatePresence>
          {sequentialStatus?.status === 'completed' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6"
            >
              <div className="flex items-center justify-center mb-4">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="bg-green-500 rounded-full p-3"
                >
                  <CheckCircle className="w-8 h-8 text-white" />
                </motion.div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-green-800 mb-2">
                  🎉 Analysis Complete!
                </h3>
                <p className="text-green-700 mb-4">
                  Your repository has been successfully analyzed through all 5 phases. 
                  You'll be redirected to view the results shortly.
                </p>
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="flex items-center justify-center gap-2 text-green-600"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">Redirecting to dashboard...</span>
                  <Sparkles className="w-4 h-4" />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}; 