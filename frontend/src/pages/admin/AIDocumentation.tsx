/**
 * AI Documentation Generation Page
 * Main admin interface for generating and managing AI-powered documentation
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, FileText, HelpCircle, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { ObjectSelector } from './components/ObjectSelector';
import { JobConfiguration } from './components/JobConfiguration';
import { DocumentationViewer } from './components/DocumentationViewer';
import { aiDocumentationService, Documentation } from '../../services/aiDocumentationService';
import { supabase } from '../../config/supabaseClient';

export function AIDocumentation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>('generate');
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [highlightJobId, setHighlightJobId] = useState<string | undefined>();
  const [viewingDoc, setViewingDoc] = useState<{ doc: Documentation; objectName: string; objectId: string } | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<any>(null);
  const [documentedObjects, setDocumentedObjects] = useState<any[]>([]);
  const [showSelection, setShowSelection] = useState(true);

  // Get job ID from URL if present
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (jobId) {
      setHighlightJobId(jobId);
      setActiveTab('jobs');
    }
  }, [searchParams]);

  // Fetch organization ID from session
  useEffect(() => {
    fetchOrganizationId();
  }, []);

  // Fetch documented objects when organization is set
  useEffect(() => {
    if (organizationId) {
      fetchDocumentedObjects();
    }
  }, [organizationId]);

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
    setCurrentJobId(jobId);
    setHighlightJobId(jobId);
    // Hide selection UI when job starts
    setShowSelection(false);
    // Stay on generate tab to show progress
    pollJobProgress(jobId);
  };

  const fetchDocumentedObjects = async () => {
    try {
      const { data, error } = await supabase
        .schema('metadata')
        .from('object_documentation')
        .select('object_id, objects(id, name, object_type, schema_name)')
        .eq('organization_id', organizationId)
        .eq('is_current', true)
        .order('objects(name)');

      if (!error && data) {
        setDocumentedObjects(data);
      }
    } catch (error) {
      console.error('Error fetching documented objects:', error);
    }
  };

  const pollJobProgress = async (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const job = await aiDocumentationService.getJobStatus(jobId);
        setJobProgress(job);
        
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          clearInterval(interval);
          // Keep final progress for 3 seconds before clearing
          setTimeout(() => {
            setCurrentJobId(null);
            setJobProgress(null);
            setShowSelection(true);
          }, 3000);
          // Refresh documented objects list
          fetchDocumentedObjects();
        }
      } catch (error) {
        console.error('Error polling job:', error);
        clearInterval(interval);
      }
    }, 3000); // Poll every 3 seconds
  };

  const handleJobComplete = (jobId: string) => {
    // Optionally show a notification or update UI
    console.log('Job completed:', jobId);
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
      setActiveTab('view');
    } catch (error: any) {
      alert(`Failed to load documentation: ${error.message}`);
    } finally {
      setLoadingDoc(false);
    }
  };

  const tabs = [
    { id: 'generate', label: 'Generate', icon: Zap },
    { id: 'view', label: 'View Documentation', icon: FileText },
  ];

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
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Zap className="h-8 w-8 text-[#2AB7A9]" />
              AI Documentation Generation
            </h1>
            <p className="mt-2 text-gray-600">
              Automatically generate comprehensive business documentation for your metadata objects using GPT-4o-mini
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Help"
          >
            <HelpCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Help</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-6 py-3 border-b-2 transition-colors
                ${activeTab === id
                  ? 'border-[#2AB7A9] text-[#2AB7A9]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-6">
            {/* PROMINENT PROGRESS BAR - Shows when job is running */}
            {jobProgress && currentJobId && (
              <div className={`
                rounded-lg shadow-lg border-2 overflow-hidden
                ${jobProgress.status === 'completed' 
                  ? 'bg-green-50 border-green-500' 
                  : jobProgress.status === 'failed'
                  ? 'bg-red-50 border-red-500'
                  : 'bg-white border-[#2AB7A9]'
                }
              `}>
                {/* Header */}
                <div className={`
                  px-6 py-4 flex items-center justify-between
                  ${jobProgress.status === 'completed'
                    ? 'bg-green-100'
                    : jobProgress.status === 'failed'
                    ? 'bg-red-100'
                    : 'bg-[#2AB7A9]/10'
                  }
                `}>
                  <div className="flex items-center gap-3">
                    {jobProgress.status === 'running' && (
                      <Loader2 className="h-6 w-6 text-[#2AB7A9] animate-spin" />
                    )}
                    {jobProgress.status === 'completed' && (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    )}
                    {jobProgress.status === 'failed' && (
                      <XCircle className="h-6 w-6 text-red-600" />
                    )}
                    <div>
                      <h2 className={`
                        text-xl font-bold
                        ${jobProgress.status === 'completed'
                          ? 'text-green-900'
                          : jobProgress.status === 'failed'
                          ? 'text-red-900'
                          : 'text-gray-900'
                        }
                      `}>
                        {jobProgress.status === 'running' && 'Generating Documentation...'}
                        {jobProgress.status === 'completed' && '✓ Generation Complete!'}
                        {jobProgress.status === 'failed' && 'Generation Failed'}
                      </h2>
                      <p className={`
                        text-sm
                        ${jobProgress.status === 'completed'
                          ? 'text-green-700'
                          : jobProgress.status === 'failed'
                          ? 'text-red-700'
                          : 'text-gray-600'
                        }
                      `}>
                        {jobProgress.objects_completed} of {jobProgress.total_objects} objects processed
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`
                      text-3xl font-bold
                      ${jobProgress.status === 'completed'
                        ? 'text-green-600'
                        : jobProgress.status === 'failed'
                        ? 'text-red-600'
                        : 'text-[#2AB7A9]'
                      }
                    `}>
                      {Math.round((jobProgress.objects_completed / jobProgress.total_objects) * 100)}%
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      ${(jobProgress.total_cost || 0).toFixed(4)} · {Math.round((jobProgress.total_tokens || 0) / 1000)}K tokens
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-3 bg-gray-200">
                  <div
                    className={`
                      h-3 transition-all duration-500 ease-out
                      ${jobProgress.status === 'completed'
                        ? 'bg-green-500'
                        : jobProgress.status === 'failed'
                        ? 'bg-red-500'
                        : 'bg-[#2AB7A9]'
                      }
                    `}
                    style={{ width: `${(jobProgress.objects_completed / jobProgress.total_objects) * 100}%` }}
                  />
                </div>

                {/* Current Object Details */}
                {jobProgress.status === 'running' && jobProgress.current_object && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse h-2 w-2 bg-[#2AB7A9] rounded-full"></div>
                      <span className="text-sm text-gray-700">
                        Currently processing:
                      </span>
                      <span className="text-sm font-mono font-semibold text-gray-900">
                        {jobProgress.current_object}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Selection UI - Collapsible when job is running */}
            {showSelection && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Object Selector */}
                <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Objects</h2>
                  <ObjectSelector
                    organizationId={organizationId}
                    selectedIds={selectedObjectIds}
                    onSelectionChange={setSelectedObjectIds}
                    onViewDocumentation={handleViewDocumentation}
                  />
                </div>

                {/* Right: Configuration */}
                <div className="lg:col-span-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration</h2>
                  <JobConfiguration
                    organizationId={organizationId}
                    selectedObjectIds={selectedObjectIds}
                    onJobCreated={handleJobCreated}
                  />
                </div>
              </div>
            )}

            {/* Expand/Collapse Selection Button - Only show when job is running */}
            {!showSelection && jobProgress && (
              <div className="flex justify-center">
                <button
                  onClick={() => setShowSelection(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-[#2AB7A9] hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
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
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-[#2AB7A9] hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                >
                  <ChevronUp className="h-4 w-4" />
                  Hide Object Selection
                </button>
              </div>
            )}
          </div>
        )}

        {/* View Documentation Tab */}
        {activeTab === 'view' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {loadingDoc ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2AB7A9]"></div>
              </div>
            ) : viewingDoc ? (
              <div>
                {/* Back Button */}
                <button
                  onClick={() => setViewingDoc(null)}
                  className="mb-4 flex items-center gap-2 text-sm text-[#2AB7A9] hover:text-[#238F85]"
                >
                  ← Back to list
                </button>
                <DocumentationViewer
                  documentation={viewingDoc.doc}
                  objectName={viewingDoc.objectName}
                  objectId={viewingDoc.objectId}
                  organizationId={organizationId}
                />
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Documented Objects</h2>
                
                {documentedObjects.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No documentation available</p>
                    <p className="text-sm">
                      Generate documentation from the Generate tab to see it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documentedObjects.map((item: any) => {
                      const obj = item.objects;
                      return (
                        <div
                          key={item.object_id}
                          onClick={() => handleViewDocumentation(item.object_id, obj?.name)}
                          className="p-4 border border-gray-200 rounded-lg hover:border-[#2AB7A9] hover:bg-[#2AB7A9]/5 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-900">{obj?.name || 'Unknown Object'}</h3>
                              <p className="text-sm text-gray-600">
                                {obj?.schema_name} · {obj?.object_type}
                              </p>
                            </div>
                            <div className="text-[#2AB7A9]">
                              <FileText className="h-5 w-5" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Cards */}
      {activeTab === 'generate' && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">What is AI Documentation?</h3>
            <p className="text-xs text-blue-700">
              Automatically generates 6 layers of business-focused documentation: Executive Summary, Narrative, 
              Transformation Cards, Code Explanations, Business Rules, and Impact Analysis.
            </p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-purple-900 mb-2">Cost Effective</h3>
            <p className="text-xs text-purple-700">
              Using GPT-4o-mini model at $0.002-$0.005 per object. Generate documentation for 100 objects 
              for less than $0.50!
            </p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-900 mb-2">Fast Generation</h3>
            <p className="text-xs text-green-700">
              Documentation generates in 10-30 seconds per object. Process entire schemas in minutes with 
              parallel job execution.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
