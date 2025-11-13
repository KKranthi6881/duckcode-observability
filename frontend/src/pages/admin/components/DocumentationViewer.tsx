/**
 * DocumentationViewer Component
 * Display generated AI documentation with multiple layers
 */

import { useState, useEffect } from 'react';
import { 
  FileText, 
  BookOpen, 
  CreditCard, 
  Shield, 
  TrendingUp,
  Star,
  Copy,
  Check,
  FileCode,
  GitBranch,
  Loader2
} from 'lucide-react';
import { Documentation } from '../../../services/aiDocumentationService';
import { CodeLineageView } from '../../../components/lineage/CodeLineageView';
import { supabase } from '../../../config/supabaseClient';

interface DocumentationViewerProps {
  documentation: Documentation;
  objectName?: string;
  objectId: string;
  organizationId: string;
}

export function DocumentationViewer({ documentation, objectName, objectId, organizationId }: DocumentationViewerProps) {
  const [activeTab, setActiveTab] = useState<string>('summary');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [codeFiles, setCodeFiles] = useState<any[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'narrative', label: 'Narrative', icon: BookOpen },
    { id: 'cards', label: 'Transformation Cards', icon: CreditCard },
    { id: 'rules', label: 'Business Rules', icon: Shield },
    { id: 'impact', label: 'Impact Analysis', icon: TrendingUp },
    { id: 'files', label: 'Code Files', icon: FileCode },
    { id: 'lineage', label: 'Lineage', icon: GitBranch },
  ];

  // Fetch code files associated with this object
  useEffect(() => {
    fetchCodeFiles();
  }, [objectId]);

  const fetchCodeFiles = async () => {
    try {
      setLoadingFiles(true);
      console.log('[DocumentationViewer] Fetching files for object:', objectId);
      
      // First, get the object to find the file_id
      const { data: objectData, error: objectError } = await supabase
        .schema('metadata')
        .from('objects')
        .select('id, file_id, repository_id')
        .eq('id', objectId)
        .single();

      console.log('[DocumentationViewer] Object data:', objectData, 'Error:', objectError);

      if (objectError || !objectData) {
        console.error('[DocumentationViewer] Error fetching object:', objectError);
        return;
      }

      if (!objectData.file_id) {
        console.log('[DocumentationViewer] Object has no file_id');
        return;
      }

      // Now get the file details with repository connection_id
      const { data: fileData, error: fileError } = await supabase
        .schema('metadata')
        .from('files')
        .select(`
          id,
          relative_path,
          file_type,
          repository_id,
          repositories (
            name,
            type,
            connection_id
          )
        `)
        .eq('id', objectData.file_id)
        .single();

      console.log('[DocumentationViewer] File data:', fileData, 'Error:', fileError);

      if (fileError || !fileData) {
        console.error('[DocumentationViewer] Error fetching file:', fileError);
        return;
      }

      // Success! Set the data
      // Use connection_id from repositories table (this is the GitHub connection ID that CodeLineageView expects)
      // repositories comes back as an array, so get the first item
      const repo = Array.isArray(fileData.repositories) ? fileData.repositories[0] : fileData.repositories;
      const githubConnectionId = repo?.connection_id || fileData.repository_id;
      
      setCodeFiles([fileData]);
      setConnectionId(githubConnectionId);
      setFilePath(fileData.relative_path);
      
      console.log('[DocumentationViewer] ✅ Set connectionId (GitHub):', githubConnectionId, 'filePath:', fileData.relative_path);
    } catch (error) {
      console.error('[DocumentationViewer] Unexpected error:', error);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const renderComplexityScore = (score: number) => {
    return (
      <div className="flex items-center gap-2">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`h-5 w-5 ${
                i <= score ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-gray-600">{score}/5</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {objectName || 'Documentation'}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span>Generated by {documentation.generated_by_model}</span>
              <span>•</span>
              <span>Version {documentation.version}</span>
              <span>•</span>
              <span>{new Date(documentation.generated_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div>
            {renderComplexityScore(documentation.complexity_score)}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-4 py-2 border-b-2 transition-colors
                ${activeTab === id
                  ? 'border-[#2AB7A9] text-[#2AB7A9]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm max-w-none">
        {/* Executive Summary */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Executive Summary</h3>
              <button
                onClick={() => handleCopy(documentation.executive_summary, 'summary')}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
              >
                {copiedSection === 'summary' ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-gray-800">{documentation.executive_summary}</p>
            </div>
          </div>
        )}

        {/* Business Narrative */}
        {activeTab === 'narrative' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What It Does</h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-800">{documentation.business_narrative.whatItDoes}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Journey</h3>
              <div className="space-y-2">
                {documentation.business_narrative.dataJourney.map((step, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2AB7A9] text-white flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-gray-800">{step}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Business Impact</h3>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-gray-800">{documentation.business_narrative.businessImpact}</p>
              </div>
            </div>
          </div>
        )}

        {/* Transformation Cards */}
        {activeTab === 'cards' && (
          <div className="space-y-4">
            {documentation.transformation_cards.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No transformation cards generated</p>
            ) : (
              documentation.transformation_cards.map((card, index) => (
                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-[#2AB7A9] to-[#238F85] p-4 text-white">
                    <h4 className="font-semibold">{card.title}</h4>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase">Input</span>
                      <p className="mt-1 text-gray-800">{card.input}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase">Logic</span>
                      <p className="mt-1 text-gray-800 font-mono text-sm bg-gray-50 p-2 rounded">
                        {card.logic}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-600 uppercase">Output</span>
                      <p className="mt-1 text-gray-800">{card.output}</p>
                    </div>
                    <div className="pt-3 border-t border-gray-200">
                      <span className="text-xs font-medium text-gray-600 uppercase">Why It Matters</span>
                      <p className="mt-1 text-gray-800 italic">{card.whyItMatters}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Business Rules */}
        {activeTab === 'rules' && (
          <div className="space-y-3">
            {documentation.business_rules.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No business rules documented</p>
            ) : (
              documentation.business_rules.map((rule, index) => (
                <div key={index} className="p-4 border-l-4 border-[#2AB7A9] bg-gray-50 rounded-r-lg">
                  <p className="font-medium text-gray-900 mb-2">{rule.rule}</p>
                  <div className="text-sm space-y-1">
                    <p className="text-gray-600">
                      <span className="font-medium">Code:</span> {rule.codeReference}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Impact:</span> {rule.impact}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Impact Analysis */}
        {activeTab === 'impact' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Used By</h3>
              <div className="space-y-2">
                {documentation.impact_analysis.usedBy.map((user, index) => (
                  <div key={index} className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{user.team}</span>
                      <span className="text-sm text-gray-600">{user.frequency}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{user.purpose}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Questions Answered</h3>
              <ul className="space-y-2">
                {documentation.impact_analysis.questionsAnswered.map((question, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-[#2AB7A9] font-bold">•</span>
                    <span className="text-gray-800">{question}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Downstream Impact</h3>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-gray-800">{documentation.impact_analysis.downstreamImpact}</p>
              </div>
            </div>
          </div>
        )}

        {/* Code Files Tab */}
        {activeTab === 'files' && (
          <div className="space-y-4">
            {loadingFiles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#2AB7A9]" />
              </div>
            ) : codeFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No code files found</p>
                <p className="text-sm">This object is not associated with any code files.</p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Source File</h3>
                {codeFiles.map((file: any, index: number) => {
                  const repo = Array.isArray(file.repositories) ? file.repositories[0] : file.repositories;
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* File Header */}
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                          <FileCode className="h-5 w-5 text-gray-600" />
                          <div className="flex-1">
                            <div className="font-mono text-sm font-medium text-gray-900 mb-1">
                              {file.relative_path}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-white border border-gray-200 font-medium">
                                {file.file_type || 'unknown'}
                              </span>
                              {repo && (
                                <>
                                  <span>•</span>
                                  <span>{repo.name}</span>
                                  {repo.type && (
                                    <>
                                      <span>•</span>
                                      <span className="capitalize">{repo.type}</span>
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* File Info Cards */}
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <div className="text-xs font-medium text-blue-900 mb-1">File Path</div>
                            <div className="text-sm text-blue-800 font-mono break-all">
                              {file.relative_path}
                            </div>
                          </div>
                          
                          <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg">
                            <div className="text-xs font-medium text-purple-900 mb-1">File Type</div>
                            <div className="text-sm text-purple-800 font-mono uppercase">
                              {file.file_type || 'UNKNOWN'}
                            </div>
                          </div>
                        </div>

                        {repo && (
                          <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                            <div className="text-xs font-medium text-green-900 mb-1">Repository</div>
                            <div className="text-sm text-green-800">
                              {repo.name} {repo.type && <span className="text-xs">({repo.type})</span>}
                            </div>
                          </div>
                        )}

                        <div className="pt-3 border-t border-gray-200">
                          <a
                            href={`/admin/codebase?file=${encodeURIComponent(file.relative_path)}&repo=${connectionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2AB7A9] hover:bg-[#238F85] text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <FileCode className="h-4 w-4" />
                            View Full File in CodeBase
                          </a>
                          <p className="mt-2 text-xs text-gray-500">
                            Opens in a new tab with full code viewer, lineage, and repository context
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Code Snippets from AI Documentation */}
                {documentation.code_explanations.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Code Snippets (AI-Analyzed)</h3>
                    <div className="space-y-4">
                      {documentation.code_explanations.map((explanation, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* Code Block */}
                          <div className="bg-muted px-4 py-3 flex items-center justify-between border-b border-border">
                            <span className="text-xs font-mono text-gray-400">
                              Snippet {index + 1} of {documentation.code_explanations.length}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(explanation.codeBlock);
                                setCopiedSection(`code-${index}`);
                                setTimeout(() => setCopiedSection(null), 2000);
                              }}
                              className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                            >
                              {copiedSection === `code-${index}` ? '✓ Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="bg-muted p-4 overflow-x-auto">
                            <pre className="text-sm text-gray-100">
                              <code>{explanation.codeBlock}</code>
                            </pre>
                          </div>
                          
                          {/* Explanations */}
                          <div className="p-4 space-y-3 bg-gray-50">
                            <div>
                              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Plain English</span>
                              <p className="mt-1 text-sm text-gray-800">{explanation.plainEnglish}</p>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Business Context</span>
                              <p className="mt-1 text-sm text-gray-800">{explanation.businessContext}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      <strong>💡 Tip:</strong> These code snippets were analyzed by AI and include plain-English explanations. 
                      For the complete file, click "View Full File in CodeBase" above.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Lineage Tab */}
        {activeTab === 'lineage' && (
          <div className="space-y-4">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-800 mb-4">
              <strong>Data Lineage:</strong> Visualize upstream dependencies and downstream impacts for this object.
            </div>
            {connectionId && filePath ? (
              <div className="h-[600px] border border-gray-200 rounded-lg overflow-hidden">
                <CodeLineageView
                  connectionId={connectionId}
                  filePath={filePath}
                  fileName={objectName}
                />
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <GitBranch className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No lineage data available</p>
                <p className="text-sm">This object is not associated with a code file.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
