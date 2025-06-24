import React from 'react';
import {
  FileText,
  TrendingUp,
  Code,
  Settings,
  Play,
  Zap,
  CheckCircle,
  AlertTriangle,
  Database,
  Info,
  BookOpen,
  Package,
  Lightbulb,
  Layers,
  Loader2,
  Copy
} from 'lucide-react';
import { formatCodeWithSyntaxHighlighting } from '../utils/syntaxHighlighting';

interface DocumentationViewerProps {
  isLoadingFileSummary: boolean;
  fileSummaryError: string | null;
  selectedFileSummary: any;
  selectedFileName?: string;
  brandColor: string;
  copyToClipboard: (text: string) => void;
  isTextCopied: (text: string) => boolean;
}

export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({
  isLoadingFileSummary,
  fileSummaryError,
  selectedFileSummary,
  selectedFileName,
  brandColor,
  copyToClipboard,
  isTextCopied,
}) => {
  // Helper function to safely render content that might be objects or strings
  const renderSafeContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      return <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>;
    }
    
    if (typeof content === 'object' && content !== null) {
      return (
        <div className="space-y-3">
          {Object.entries(content).map(([key, value], index) => (
            <div key={index} className="border-l-4 border-blue-200 pl-4">
              <h5 className="font-semibold text-gray-800 mb-2 capitalize">
                {key.replace(/_/g, ' ')}
              </h5>
              <div className="text-gray-700">
                {typeof value === 'string' ? (
                  <p className="leading-relaxed whitespace-pre-wrap">{value}</p>
                ) : Array.isArray(value) ? (
                  <ul className="list-disc list-inside space-y-1">
                    {value.map((item, idx) => (
                      <li key={idx}>{String(item)}</li>
                    ))}
                  </ul>
                ) : (
                  <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }
    
    // Fallback for other types
    return <p className="text-gray-700 leading-relaxed">{String(content)}</p>;
  };

  if (isLoadingFileSummary) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
        <span className="text-gray-600">Loading documentation...</span>
      </div>
    );
  }

  if (fileSummaryError) {
    return (
      <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-700 mr-2" />
          <h4 className="font-semibold">Error Loading Documentation</h4>
        </div>
        <p className="mt-1">{fileSummaryError}</p>
      </div>
    );
  }

  if (!selectedFileSummary) {
    return (
      <div className="p-4 text-gray-500 bg-gray-50 border border-gray-200 rounded-md">
        <div className="flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          <span>No documentation available for this file.</span>
        </div>
      </div>
    );
  }

  // The backend returns: { filePath, language, lastProcessed, summary: {summary, dependencies, description}, summaryCreatedAt }
  const apiResponse = selectedFileSummary;
  const summaryContent = apiResponse.summary;

  return (
    <div className="space-y-6">
      {/* File Information Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <FileText className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-blue-900">File Documentation</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="font-medium text-gray-700">File:</span> <span className="text-gray-900">{apiResponse.filePath}</span></div>
          {apiResponse.language && <div><span className="font-medium text-gray-700">Language:</span> <span className="text-gray-900">{apiResponse.language}</span></div>}
          {apiResponse.lastProcessed && <div><span className="font-medium text-gray-700">Processed:</span> <span className="text-gray-900">{new Date(apiResponse.lastProcessed).toLocaleDateString()}</span></div>}
          {apiResponse.summaryCreatedAt && <div><span className="font-medium text-gray-700">Generated:</span> <span className="text-gray-900">{new Date(apiResponse.summaryCreatedAt).toLocaleDateString()}</span></div>}
        </div>
      </div>

      {/* Rich Structured Documentation */}
      {summaryContent?.business_logic || summaryContent?.technical_details || summaryContent?.code_blocks || summaryContent?.summary ? (
        <div className="space-y-6">
          {/* Summary Section */}
          {summaryContent.summary && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 text-blue-600 mr-3" />
                <h4 className="text-xl font-bold text-gray-900">File Summary</h4>
              </div>
              <div className="prose max-w-none">
                {renderSafeContent(summaryContent.summary)}
              </div>
            </div>
          )}

          {/* Business Logic Section */}
          {summaryContent.business_logic && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <TrendingUp className="h-6 w-6 text-green-600 mr-3" />
                <h4 className="text-xl font-bold text-gray-900">Business Logic & Impact</h4>
              </div>
              
              {summaryContent.business_logic.main_objectives && (
                <div className="mb-4">
                  <h5 className="font-semibold text-gray-800 mb-2">📋 Main Objectives</h5>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    {summaryContent.business_logic.main_objectives.map((obj: string, idx: number) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {summaryContent.business_logic.data_transformation && (
                <div className="mb-4">
                  <h5 className="font-semibold text-gray-800 mb-2">🔄 Data Transformation</h5>
                  <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-green-400">{summaryContent.business_logic.data_transformation}</p>
                </div>
              )}
              
              {summaryContent.business_logic.stakeholder_impact && (
                <div className="mb-4">
                  <h5 className="font-semibold text-gray-800 mb-2">👥 Stakeholder Impact</h5>
                  <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400">{summaryContent.business_logic.stakeholder_impact}</p>
                </div>
              )}
            </div>
          )}

          {/* Code Blocks - Step by Step Explanation */}
          {summaryContent.code_blocks && summaryContent.code_blocks.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Code className="h-6 w-6 text-purple-600 mr-3" />
                <h4 className="text-xl font-bold text-gray-900">Step-by-Step Code Walkthrough</h4>
              </div>
              
              <div className="space-y-6">
                {summaryContent.code_blocks.map((block: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center mb-3">
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold mr-3">
                        Step {idx + 1}
                      </span>
                      <h5 className="text-lg font-semibold text-gray-900">{block.section}</h5>
                    </div>
                    
                    {/* Code Block */}
                    <div className="mb-4">
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-sm"><code>{block.code}</code></pre>
                      </div>
                    </div>
                    
                    {/* Technical Explanation */}
                    <div className="mb-3">
                      <h6 className="font-semibold text-gray-800 mb-2">🔧 Technical Explanation</h6>
                      <p className="text-gray-700 bg-blue-50 p-3 rounded border-l-4 border-blue-400">{block.explanation}</p>
                    </div>
                    
                    {/* Business Context */}
                    <div>
                      <h6 className="font-semibold text-gray-800 mb-2">💼 Business Context</h6>
                      <p className="text-gray-700 bg-green-50 p-3 rounded border-l-4 border-green-400">{block.business_context}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical Details */}
          {summaryContent.technical_details && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Settings className="h-6 w-6 text-gray-600 mr-3" />
                <h4 className="text-xl font-bold text-gray-900">Technical Implementation</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summaryContent.technical_details.materialization && (
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">🏗️ Materialization</h5>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {summaryContent.technical_details.materialization}
                    </span>
                  </div>
                )}
                
                {summaryContent.technical_details.source_tables && summaryContent.technical_details.source_tables.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">📊 Source Tables</h5>
                    <div className="space-y-1">
                      {summaryContent.technical_details.source_tables.map((table: string, idx: number) => (
                        <span key={idx} className="block bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">
                          {table}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {summaryContent.technical_details.sql_operations && summaryContent.technical_details.sql_operations.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">🔍 SQL Operations</h5>
                    <div className="space-y-1">
                      {summaryContent.technical_details.sql_operations.map((op: string, idx: number) => (
                        <span key={idx} className="block bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
                          {op}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {summaryContent.technical_details.incremental_strategy && (
                  <div>
                    <h5 className="font-semibold text-gray-800 mb-2">⚡ Incremental Strategy</h5>
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      {summaryContent.technical_details.incremental_strategy}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional sections with proper TypeScript handling */}
          {summaryContent?.execution_flow && Array.isArray(summaryContent.execution_flow) && summaryContent.execution_flow.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Play className="h-6 w-6 text-blue-600 mr-3" />
                <h4 className="text-xl font-bold text-gray-900">Execution Flow</h4>
              </div>
              <div className="space-y-3">
                {summaryContent.execution_flow.map((step: string, idx: number) => (
                  <div key={idx} className="flex items-start">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold mr-4 mt-1 flex-shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-blue-400 flex-1">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summaryContent?.performance_considerations && Array.isArray(summaryContent.performance_considerations) && summaryContent.performance_considerations.length > 0 && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Zap className="h-6 w-6 text-orange-600 mr-3" />
                <h4 className="text-xl font-bold text-gray-900">Performance Considerations</h4>
              </div>
              <div className="space-y-2">
                {summaryContent.performance_considerations.map((consideration: string, idx: number) => (
                  <div key={idx} className="flex items-start">
                    <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-orange-400">{consideration}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summaryContent?.best_practices && Array.isArray(summaryContent.best_practices) && summaryContent.best_practices.length > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                <h4 className="text-xl font-bold text-gray-900">Best Practices</h4>
              </div>
              <div className="space-y-2">
                {summaryContent.best_practices.map((practice: string, idx: number) => (
                  <div key={idx} className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-1 mr-3 flex-shrink-0" />
                    <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-green-400">{practice}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional content sections */}
          {summaryContent?.dependencies && Array.isArray(summaryContent.dependencies) && summaryContent.dependencies.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Package className="h-5 w-5 text-orange-600 mr-2" />
                <h4 className="text-lg font-semibold text-gray-900">Dependencies</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {summaryContent.dependencies.map((dep: string, index: number) => (
                  <span key={index} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Fallback: Basic Documentation for non-structured responses */
        <div className="space-y-6">
          {/* Summary Section */}
          {summaryContent?.summary && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Info className="h-5 w-5 text-green-600 mr-2" />
                <h4 className="text-lg font-semibold text-gray-900">Summary</h4>
              </div>
              {renderSafeContent(summaryContent.summary)}
            </div>
          )}

          {/* Description Section */}
          {summaryContent?.description && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <BookOpen className="h-5 w-5 text-purple-600 mr-2" />
                <h4 className="text-lg font-semibold text-gray-900">Description</h4>
              </div>
              <p className="text-gray-700 leading-relaxed">{summaryContent.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 