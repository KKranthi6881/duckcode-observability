/**
 * AI Documentation Generation Page
 * Main admin interface for generating and managing AI-powered documentation
 */

import React, { useState, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { ObjectSelector } from './components/ObjectSelector';
import { JobConfiguration } from './components/JobConfiguration';
import { DocumentationViewer } from './components/DocumentationViewer';
import { ObjectProcessingList } from './components/ObjectProcessingList';
import { aiDocumentationService, Documentation } from '../../services/aiDocumentationService';
import { supabase } from '../../config/supabaseClient';

export function AIDocumentation() {
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [viewingDoc, setViewingDoc] = useState<{ doc: Documentation; objectName: string; objectId: string } | null>(null);
  const [jobProgress, setJobProgress] = useState<any>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const [showSelection, setShowSelection] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);


  // Fetch organization ID from session
  useEffect(() => {
    fetchOrganizationId();
  }, []);


  const fetchOrganizationId = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .schema('enterprise')
        .from('user_organization_roles')
        .select('organization_id')
        .eq('user_id', session.user.id)
        .single();

      if (!error && data) {
        setOrganizationId(data.organization_id);
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
    }
  };

  const handleJobCreated = (jobId: string) => {
    console.log('[AIDocumentation] Job created:', jobId);
    setCurrentJobId(jobId);
    
    // Set optimistic initial state immediately
    setJobProgress({
      id: jobId,
      organization_id: organizationId!,
      object_ids: selectedObjectIds,
      status: 'processing',
      total_objects: selectedObjectIds.length,
      processed_objects: 0,
      failed_objects: 0,
      progress_percentage: 0,
      total_tokens_used: 0,
      estimated_cost: 0,
      actual_cost: 0,
      created_at: new Date().toISOString(),
    } as any);
    
    // Hide selection UI when job starts
    setShowSelection(false);
    
    // Start polling immediately
    pollJobProgress(jobId);
  };


  const pollJobProgress = async (jobId: string) => {
    // Fetch immediately first time
    const fetchStatus = async () => {
      try {
        const job = await aiDocumentationService.getJobStatus(jobId);
        console.log('[AIDocumentation] Job status fetched:', job);
        setJobProgress(job);
        
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          // Keep final progress for 3 seconds before clearing
          setTimeout(() => {
            setCurrentJobId(null);
            setJobProgress(null);
            setShowSelection(true);
          }, 3000);
          return true; // Job completed
        }
        return false; // Job still running
      } catch (error) {
        console.error('Error polling job:', error);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return true; // Stop polling on error
      }
    };
    
    // Do immediate first fetch
    const completed = await fetchStatus();
    if (completed) return;
    
    // Then start interval for subsequent fetches
    intervalRef.current = setInterval(async () => {
      await fetchStatus();
    }, 2000); // Poll every 2 seconds for smoother updates
  };


  const handleViewDocumentation = async (objectId: string, objectName?: string) => {
    try {
      setLoadingDoc(true);
      const doc = await aiDocumentationService.getObjectDocumentation(objectId);
      
      // Use provided name or fetch it
      let name = objectName;
      if (!name) {
        const { data } = await supabase
          .schema('metadata')
          .from('objects')
          .select('name')
          .eq('id', objectId)
          .single();
        name = data?.name || 'Unknown Object';
      }

      setViewingDoc({
        doc,
        objectName: name || 'Unknown Object',
        objectId
      });
      // Don't switch tabs - show modal instead
    } catch (error: any) {
      alert(`Failed to load documentation: ${error.message}`);
    } finally {
      setLoadingDoc(false);
    }
  };


  if (!organizationId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AB7A9]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-[#2AB7A9] to-[#1a8f82] rounded-lg shadow-sm">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              AI Documentation
            </h1>
            <p className="text-sm text-gray-500">
              Generate intelligent documentation for your data objects
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
            {/* PROMINENT PROGRESS BAR - Shows when job is running */}
            {jobProgress && currentJobId && (
              <div className={`
                rounded-xl border overflow-hidden shadow-sm
                ${jobProgress.status === 'completed' 
                  ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300' 
                  : jobProgress.status === 'failed'
                  ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
                  : 'bg-white border-gray-200'
                }
              `}>
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`
                      p-2 rounded-lg
                      ${jobProgress.status === 'completed'
                        ? 'bg-green-100'
                        : jobProgress.status === 'failed'
                        ? 'bg-red-100'
                        : 'bg-[#2AB7A9]/10'
                      }
                    `}>
                      {jobProgress.status === 'processing' && (
                        <Loader2 className="h-5 w-5 text-[#2AB7A9] animate-spin" />
                      )}
                      {jobProgress.status === 'completed' && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      {jobProgress.status === 'failed' && (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <h3 className={`
                        text-base font-semibold
                        ${jobProgress.status === 'completed'
                          ? 'text-green-900'
                          : jobProgress.status === 'failed'
                          ? 'text-red-900'
                          : 'text-gray-900'
                        }
                      `}>
                        {jobProgress.status === 'processing' && 'Generating Documentation'}
                        {jobProgress.status === 'completed' && 'Generation Complete'}
                        {jobProgress.status === 'failed' && 'Generation Failed'}
                      </h3>
                      <p className={`
                        text-sm mt-0.5
                        ${jobProgress.status === 'completed'
                          ? 'text-green-700'
                          : jobProgress.status === 'failed'
                          ? 'text-red-700'
                          : 'text-gray-600'
                        }
                      `}>
                        {jobProgress.processed_objects} of {jobProgress.total_objects} objects
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`
                      text-2xl font-bold
                      ${jobProgress.status === 'completed'
                        ? 'text-green-600'
                        : jobProgress.status === 'failed'
                        ? 'text-red-600'
                        : 'text-[#2AB7A9]'
                      }
                    `}>
                      {Math.round((jobProgress.processed_objects / jobProgress.total_objects) * 100)}%
                    </div>
                    <div className="text-xs text-gray-600 mt-1 space-x-2">
                      <span>${(jobProgress.actual_cost || 0).toFixed(4)}</span>
                      <span>·</span>
                      <span>{Math.round((jobProgress.total_tokens_used || 0) / 1000)}K tokens</span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-gray-200/50">
                  <div
                    className={`
                      h-2 transition-all duration-500 ease-out
                      ${jobProgress.status === 'completed'
                        ? 'bg-gradient-to-r from-green-500 to-green-600'
                        : jobProgress.status === 'failed'
                        ? 'bg-gradient-to-r from-red-500 to-red-600'
                        : 'bg-gradient-to-r from-[#2AB7A9] to-[#1a8f82]'
                      }
                    `}
                    style={{ width: `${(jobProgress.processed_objects / jobProgress.total_objects) * 100}%` }}
                  />
                </div>

                {/* Current Object Details */}
                {jobProgress.status === 'processing' && jobProgress.current_object_name && (
                  <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2AB7A9] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2AB7A9]"></span>
                      </div>
                      <span className="text-xs text-gray-600">
                        Processing:
                      </span>
                      <span className="text-xs font-mono font-medium text-gray-900">
                        {jobProgress.current_object_name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Object Processing List - Show detailed status for each object */}
            {jobProgress && currentJobId && (
              <div className="mt-4">
                <ObjectProcessingList job={jobProgress} />
              </div>
            )}

            {/* Selection UI - Collapsible when job is running */}
            {showSelection && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: Object Selector */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <h2 className="text-base font-semibold text-gray-900">Select Objects</h2>
                  </div>
                  <div className="p-6">
                    <ObjectSelector
                      organizationId={organizationId}
                      selectedIds={selectedObjectIds}
                      onSelectionChange={setSelectedObjectIds}
                      onViewDocumentation={handleViewDocumentation}
                    />
                  </div>
                </div>

                {/* Right: Configuration */}
                <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <h2 className="text-base font-semibold text-gray-900">Configuration</h2>
                  </div>
                  <div className="p-6">
                    <JobConfiguration
                      organizationId={organizationId}
                      selectedObjectIds={selectedObjectIds}
                      onJobCreated={handleJobCreated}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Expand/Collapse Selection Button - Only show when job is running */}
            {!showSelection && jobProgress && (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowSelection(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-[#2AB7A9] bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-all shadow-sm"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show Object Selection
                </button>
              </div>
            )}

            {/* Collapse Selection Button - Only show when expanded during job */}
            {showSelection && jobProgress && (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowSelection(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-[#2AB7A9] bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-all shadow-sm"
                >
                  <ChevronUp className="h-4 w-4" />
                  Hide Object Selection
                </button>
              </div>
            )}

        {/* Documentation Viewer Modal */}
        {viewingDoc && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#2AB7A9]" />
                  <h2 className="text-lg font-semibold text-gray-900">{viewingDoc.objectName}</h2>
                </div>
                <button
                  onClick={() => setViewingDoc(null)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <XCircle className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              
              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingDoc ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AB7A9]"></div>
                  </div>
                ) : (
                  <DocumentationViewer
                    documentation={viewingDoc.doc}
                    objectName={viewingDoc.objectName}
                    objectId={viewingDoc.objectId}
                    organizationId={organizationId}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
