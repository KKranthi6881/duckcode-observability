import React, { useState, useRef, useCallback } from 'react';
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
  Copy,
  Target,
  RefreshCw,
  Users,
  BarChart3,
  Workflow,
  Brain,
  Columns,
  Calendar,
  Shield,
  Gauge,
  ArrowRight,
  ArrowUpRight,
  Clock,
  FileCheck,
  Wrench,
  Activity,
  GitBranch,
  Monitor,
  Server,
  Cpu,
  Edit3,
  Save,
  X,
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import { formatCodeWithSyntaxHighlighting } from '../utils/syntaxHighlighting';

interface DocumentationViewerProps {
  isLoadingFileSummary: boolean;
  fileSummaryError: string | null;
  selectedFileSummary: any;
  selectedFileName?: string;
  selectedFilePath?: string;
  brandColor: string;
  copyToClipboard: (text: string) => void;
  isTextCopied: (text: string) => boolean;
  onUpdateDocumentation?: (filePath: string, section: string, updatedContent: any) => Promise<void>;
}

interface EditableSectionProps {
  sectionKey: string;
  title: string;
  content: any;
  icon: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  editingSection: string | null;
  isUpdating: string | null;
  userInfo: any;
  onUpdateDocumentation?: (filePath: string, section: string, updatedContent: any) => Promise<void>;
  handleStartEdit: (section: string, currentContent: any) => void;
  handleSaveEdit: (section: string) => Promise<void>;
  handleCancelEdit: () => void;
  formatUserTooltip: (userInfo: any) => string;
  setTextareaRef: (sectionKey: string, textarea: HTMLTextAreaElement | null) => void;
  editedContent: any;
  setEditedContent: React.Dispatch<React.SetStateAction<any>>;
}

const EditableSection: React.FC<EditableSectionProps> = ({
  sectionKey,
  title,
  content,
  icon,
  className = "",
  children,
  editingSection,
  isUpdating,
  userInfo,
  onUpdateDocumentation,
  handleStartEdit,
  handleSaveEdit,
  handleCancelEdit,
  formatUserTooltip,
  setTextareaRef,
  editedContent,
  setEditedContent
}) => {
  const isEditing = editingSection === sectionKey;
  const isCurrentlyUpdating = isUpdating === sectionKey;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="p-2 bg-blue-100 rounded-lg mr-3">
            {icon}
          </div>
          <div>
            <h4 className="text-xl font-bold text-gray-900">{title}</h4>
            {userInfo && (
              <div className="flex items-center mt-1 text-xs text-gray-500">
                {userInfo.avatar_url && (
                  <img 
                    src={userInfo.avatar_url} 
                    alt={userInfo.full_name}
                    className="w-4 h-4 rounded-full mr-1"
                  />
                )}
                <span>
                  Last edited by {userInfo.full_name} • {' '}
                  {new Date(userInfo.updated_at).toLocaleDateString()} at {' '}
                  {new Date(userInfo.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>
        
        {onUpdateDocumentation && (
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                onClick={() => handleStartEdit(sectionKey, content)}
                className="flex items-center justify-center w-8 h-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                title={userInfo ? formatUserTooltip(userInfo) : 'Edit this section'}
              >
                <Edit3 className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit(sectionKey);
                  }}
                  disabled={isCurrentlyUpdating}
                  className="flex items-center px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors"
                >
                  {isCurrentlyUpdating ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {isCurrentlyUpdating ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                  disabled={isCurrentlyUpdating}
                  className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-md transition-colors"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <textarea
            ref={(el) => setTextareaRef(sectionKey, el)}
            value={editedContent[sectionKey] || ''}
            onChange={(e) => {
              setEditedContent((prev: any) => ({
                ...prev,
                [sectionKey]: e.target.value
              }));
            }}
            className="w-full min-h-40 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Enter your content here..."
            autoFocus
            rows={6}
            key={sectionKey}
          />
          <p className="text-sm text-gray-500">
            You can edit this content directly. For complex objects, use JSON format.
          </p>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
};

export const DocumentationViewer: React.FC<DocumentationViewerProps> = ({
  isLoadingFileSummary,
  fileSummaryError,
  selectedFileSummary,
  selectedFileName,
  selectedFilePath,
  brandColor,
  copyToClipboard,
  isTextCopied,
  onUpdateDocumentation,
}) => {
  // State for managing edit mode
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<any>({});
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [localSummary, setLocalSummary] = useState<any>(null);
  // State for feedback messages
  const [saveMessage, setSaveMessage] = React.useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Refs to store textarea references for cursor position preservation
  const textareaRefs = useRef<{[key: string]: HTMLTextAreaElement | null}>({});

  // Simple ref assignment without event listeners - we'll use a different approach
  const setTextareaRef = useCallback((sectionKey: string, textarea: HTMLTextAreaElement | null) => {
    textareaRefs.current[sectionKey] = textarea;
  }, []);

  // Update local summary when selectedFileSummary changes
  React.useEffect(() => {
    if (selectedFileSummary) {
      setLocalSummary(selectedFileSummary);
    }
  }, [selectedFileSummary]);

  // Handle starting edit mode
  const handleStartEdit = (section: string, currentContent: any) => {
    console.log('=== HANDLE START EDIT DEBUG ===');
    console.log('Section:', section);
    console.log('Current content:', currentContent);
    console.log('Content type:', typeof currentContent);
    console.log('Selected file path:', selectedFilePath);
    console.log('onUpdateDocumentation function:', !!onUpdateDocumentation);
    
    setEditingSection(section);
    
    // Convert content to string format for editing
    let editableContent = '';
    
    if (currentContent === null || currentContent === undefined) {
      editableContent = '';
    } else if (typeof currentContent === 'string') {
      // For strings, use as-is
      editableContent = currentContent;
    } else if (Array.isArray(currentContent)) {
      // For arrays, convert to JSON string for editing
      editableContent = JSON.stringify(currentContent, null, 2);
    } else if (typeof currentContent === 'object') {
      // For objects, check if it looks like a simple text object or complex structure
      const keys = Object.keys(currentContent);
      if (keys.length === 1 && ['title', 'text', 'content', 'description', 'summary'].includes(keys[0])) {
        // If it's a simple object with a single text field, extract that
        editableContent = String(currentContent[keys[0]] || '');
      } else {
        // For complex objects, convert to JSON string for editing
        editableContent = JSON.stringify(currentContent, null, 2);
      }
    } else {
      // For other types (number, boolean), convert to string
      editableContent = String(currentContent);
    }
    
    console.log('Setting editable content:', editableContent);
    setEditedContent((prev: any) => ({ ...prev, [section]: editableContent }));
    console.log('=== END HANDLE START EDIT DEBUG ===');
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditedContent({});
  };

  // Handle saving changes
  const handleSaveEdit = async (section: string) => {
    console.log('=== HANDLE SAVE EDIT DEBUG ===');
    console.log('Section:', section);
    console.log('onUpdateDocumentation:', !!onUpdateDocumentation);
    console.log('selectedFilePath:', selectedFilePath);
    console.log('editedContent for section:', editedContent[section]);
    console.log('Full editedContent:', editedContent);
    
    if (!onUpdateDocumentation || !selectedFilePath) {
      console.error('Missing dependencies for save:', { onUpdateDocumentation: !!onUpdateDocumentation, selectedFilePath: !!selectedFilePath });
      return;
    }

    console.log('Starting save for section:', section);
    console.log('Content to save:', editedContent[section]);

    setIsUpdating(section);
    setSaveMessage(null); // Clear any previous messages
    
    try {
      let contentToSave = editedContent[section];
      
      // Handle different save strategies based on section type
      if (typeof contentToSave === 'string') {
        const trimmed = contentToSave.trim();
        
        // For simple text sections (summary, descriptions), keep as string unless it's clearly JSON
        const isSimpleTextSection = ['summary', 'description', 'title'].includes(section);
        
        if (!isSimpleTextSection && ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
            (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
          try {
            contentToSave = JSON.parse(trimmed);
            console.log('Parsed JSON content:', contentToSave);
          } catch (parseError) {
            console.log('JSON parse failed, keeping as string:', parseError);
            // Keep as string if parsing fails
          }
        } else {
          // For simple text sections, always keep as string
          console.log('Keeping content as string for section:', section);
        }
      }

      console.log('Calling onUpdateDocumentation with:', {
        filePath: selectedFilePath,
        section,
        content: contentToSave
      });

      await onUpdateDocumentation(
        selectedFilePath,
        section,
        contentToSave
      );

      console.log('Save successful, updating local state');

      // Create a deep copy of the current summary to avoid mutation
      const currentSummary = localSummary || selectedFileSummary;
      const updatedSummary = JSON.parse(JSON.stringify(currentSummary));
      
      // The API response structure is: { filePath, language, lastProcessed, summary: {...}, summaryCreatedAt }
      // We need to update the summary content inside the summary property
      const summaryContent = updatedSummary.summary || {};
      
      // Ensure metadata structure exists
      if (!summaryContent._metadata) {
        summaryContent._metadata = {};
      }
      if (!summaryContent._metadata.section_updates) {
        summaryContent._metadata.section_updates = {};
      }
      
      // Update the specific section in the summary
      if (section.includes('.')) {
        const parts = section.split('.');
        if (parts.length === 2) {
          // Handle simple nested properties like 'business_logic.main_objectives'
          const [parentKey, childKey] = parts;
          if (!summaryContent[parentKey]) summaryContent[parentKey] = {};
          summaryContent[parentKey][childKey] = contentToSave;
        } else if (parts.length === 3 && parts[0] === 'code_blocks') {
          // Handle code blocks like 'code_blocks.0.explanation'
          const [, blockIndex, propertyKey] = parts;
          const idx = parseInt(blockIndex);
          if (!summaryContent.code_blocks) summaryContent.code_blocks = [];
          if (!summaryContent.code_blocks[idx]) summaryContent.code_blocks[idx] = {};
          summaryContent.code_blocks[idx][propertyKey] = contentToSave;
        }
      } else {
        summaryContent[section] = contentToSave;
      }

      // Add user metadata (this will be populated by the backend response)
      summaryContent._metadata.section_updates[section] = {
        updated_at: new Date().toISOString(),
        full_name: 'You',
        id: 'current-user'
      };
      
      // Update the summary content in the correct structure
      updatedSummary.summary = summaryContent;
      
      console.log('Updated summary structure:', updatedSummary);
      
      // Update local state with the new content
      setLocalSummary(updatedSummary);

      console.log('Local state updated, exiting edit mode');

      // Show success message with user info
      setSaveMessage({ 
        type: 'success', 
        text: 'Changes saved successfully! Documentation updated by you.' 
      });

      // Exit edit mode
      setEditingSection(null);
      setEditedContent({});

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
      
    } catch (error) {
      console.error('Failed to update documentation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSaveMessage({ type: 'error', text: `Failed to save: ${errorMessage}` });
    } finally {
      setIsUpdating(null);
    }
  };

  // Helper function to get user info for a section
  const getUserInfoForSection = (sectionKey: string) => {
    const currentSummary = localSummary || selectedFileSummary;
    if (!currentSummary?.summary?._metadata?.section_updates) {
      return null;
    }
    return currentSummary.summary._metadata.section_updates[sectionKey];
  };

  // Helper function to format the user info tooltip
  const formatUserTooltip = (userInfo: any) => {
    if (!userInfo) return 'No edit history';
    
    const date = new Date(userInfo.updated_at).toLocaleDateString();
    const time = new Date(userInfo.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `Last updated by ${userInfo.full_name}\n${date} at ${time}`;
  };

  // Helper function to format text with numbered points on separate lines
  const formatTextWithNumberedPoints = (text: string): React.ReactNode => {
    // Check if the text contains numbered points pattern like "1)", "2)", etc.
    const numberedPointsRegex = /(\d+\))/g;
    
    if (numberedPointsRegex.test(text)) {
      // Split the text by numbered points but keep the numbers
      const parts = text.split(/(\d+\))/);
      const formattedParts: React.ReactNode[] = [];
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // If this part is a number (like "1)", "2)", etc.)
        if (/^\d+\)$/.test(part)) {
          // Add the number and the following text as a new line
          const nextPart = parts[i + 1] || '';
          formattedParts.push(
            <div key={i} className="mb-3">
              <span className="font-semibold text-blue-700">{part}</span>
              <span className="ml-1 break-words">{nextPart.trim()}</span>
            </div>
          );
          i++; // Skip the next part since we've already processed it
        } else if (i === 0 && part.trim()) {
          // This is the introductory text before the numbered points
          formattedParts.push(
            <div key={i} className="mb-4 font-medium text-gray-800 break-words">
              {part.trim()}
            </div>
          );
        }
      }
      
      return <div className="space-y-2">{formattedParts}</div>;
    }
    
    // If no numbered points, return as regular text with line breaks preserved
    return <p className="text-gray-700 leading-relaxed whitespace-pre-wrap break-words">{text}</p>;
  };

  // Helper function to safely render content that might be objects or strings
  const renderSafeContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      return formatTextWithNumberedPoints(content);
    }
    
    if (typeof content === 'object' && content !== null) {
      return (
        <div className="space-y-3">
          {Object.entries(content).map(([key, value], index) => (
            <div key={index} className="border-l-4 border-blue-200 pl-4">
              <h5 className="font-semibold text-gray-800 mb-2 capitalize break-words">
                {key.replace(/_/g, ' ')}
              </h5>
              <div className="text-gray-700">
                {typeof value === 'string' ? (
                  formatTextWithNumberedPoints(value)
                ) : Array.isArray(value) ? (
                  <ul className="list-disc list-inside space-y-1">
                    {value.map((item, idx) => (
                      <li key={idx} className="break-words">{String(item)}</li>
                    ))}
                  </ul>
                ) : (
                  <pre className="text-sm bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
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
    return <p className="text-gray-700 leading-relaxed break-words">{String(content)}</p>;
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

  const currentSummary = localSummary || selectedFileSummary;

  if (!currentSummary) {
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
  const apiResponse = currentSummary;
  const summaryContent = apiResponse.summary;

  return (
    <div className="space-y-6 relative">
      {/* Loading overlay during save operations */}
      {isUpdating && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-blue-600 font-medium">Saving changes...</span>
          </div>
        </div>
      )}

      {/* File Information Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <FileText className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
          <h3 className="text-lg font-semibold text-blue-900">File Documentation</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div><span className="font-medium text-gray-700">File:</span> <span className="text-gray-900 break-all">{apiResponse.filePath}</span></div>
          {apiResponse.language && <div><span className="font-medium text-gray-700">Language:</span> <span className="text-gray-900">{apiResponse.language}</span></div>}
          {apiResponse.lastProcessed && <div><span className="font-medium text-gray-700">Processed:</span> <span className="text-gray-900">{new Date(apiResponse.lastProcessed).toLocaleDateString()}</span></div>}
          {apiResponse.summaryCreatedAt && <div><span className="font-medium text-gray-700">Generated:</span> <span className="text-gray-900">{new Date(apiResponse.summaryCreatedAt).toLocaleDateString()}</span></div>}
        </div>
      </div>

      {/* Save Message Display */}
      {saveMessage && (
        <div className={`p-4 rounded-lg border ${
          saveMessage.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            {saveMessage.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <AlertTriangle className="h-5 w-5 mr-2" />
            )}
            <span className="font-medium">{saveMessage.text}</span>
          </div>
        </div>
      )}

      {/* Rich Structured Documentation */}
      {summaryContent && Object.keys(summaryContent).filter(key => key !== '_metadata').length > 0 ? (
        <div className="space-y-6">
          {/* Summary Section */}
          {summaryContent.summary && (
            <EditableSection
              sectionKey="summary"
              title="File Summary"
              content={summaryContent.summary}
              icon={<FileText className="h-6 w-6 text-blue-600" />}
              editingSection={editingSection}
              isUpdating={isUpdating}
              userInfo={getUserInfoForSection("summary")}
              onUpdateDocumentation={onUpdateDocumentation}
              handleStartEdit={handleStartEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
              formatUserTooltip={formatUserTooltip}
              setTextareaRef={setTextareaRef}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
            >
              <div className="w-full overflow-hidden">
                {renderSafeContent(summaryContent.summary)}
              </div>
            </EditableSection>
          )}

          {/* Business Logic Section */}
          {summaryContent.business_logic && Object.keys(summaryContent.business_logic).length > 0 && (
            <EditableSection
              sectionKey="business_logic"
              title="Business Logic & Impact"
              content={summaryContent.business_logic}
              icon={<TrendingUp className="h-6 w-6 text-green-600" />}
              className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200"
              editingSection={editingSection}
              isUpdating={isUpdating}
              userInfo={getUserInfoForSection("business_logic")}
              onUpdateDocumentation={onUpdateDocumentation}
              handleStartEdit={handleStartEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
              formatUserTooltip={formatUserTooltip}
              setTextareaRef={setTextareaRef}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
            >
              {summaryContent.business_logic.main_objectives && Array.isArray(summaryContent.business_logic.main_objectives) && summaryContent.business_logic.main_objectives.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center mb-3">
                    <Target className="h-5 w-5 text-green-600 mr-2" />
                    <h5 className="font-semibold text-gray-800">Main Objectives</h5>
                  </div>
                  <div className="bg-white rounded-lg border border-green-200 p-4">
                    <ul className="space-y-2 text-gray-700">
                      {summaryContent.business_logic.main_objectives.map((obj: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <ArrowRight className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="break-words">{obj}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              
              {summaryContent.business_logic.data_transformation && (
                <div className="mb-6">
                  <div className="flex items-center mb-3">
                    <RefreshCw className="h-5 w-5 text-blue-600 mr-2" />
                    <h5 className="font-semibold text-gray-800">Data Transformation</h5>
                  </div>
                  <div className="bg-white rounded-lg border border-blue-200 p-4 border-l-4 border-l-blue-500">
                    <p className="text-gray-700 leading-relaxed break-words">{summaryContent.business_logic.data_transformation}</p>
                  </div>
                </div>
              )}
              
              {summaryContent.business_logic.stakeholder_impact && (
                <div className="mb-4">
                  <div className="flex items-center mb-3">
                    <Users className="h-5 w-5 text-purple-600 mr-2" />
                    <h5 className="font-semibold text-gray-800">Stakeholder Impact</h5>
                  </div>
                  <div className="bg-white rounded-lg border border-purple-200 p-4 border-l-4 border-l-purple-500">
                    <p className="text-gray-700 leading-relaxed break-words">{summaryContent.business_logic.stakeholder_impact}</p>
                  </div>
                </div>
              )}
            </EditableSection>
          )}

          {/* Enhanced Code Blocks - Step by Step Explanation */}
          {summaryContent.code_blocks && Array.isArray(summaryContent.code_blocks) && summaryContent.code_blocks.length > 0 && (
            <EditableSection
              sectionKey="code_blocks"
              title="Step-by-Step Code Walkthrough"
              content={summaryContent.code_blocks}
              icon={<Code className="h-6 w-6 text-purple-600" />}
              editingSection={editingSection}
              isUpdating={isUpdating}
              userInfo={getUserInfoForSection("code_blocks")}
              onUpdateDocumentation={onUpdateDocumentation}
              handleStartEdit={handleStartEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
              formatUserTooltip={formatUserTooltip}
              setTextareaRef={setTextareaRef}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
            >
              <div className="space-y-8">
                {summaryContent.code_blocks.map((block: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-gray-50 to-white shadow-sm">
                    <div className="flex items-center mb-4">
                      <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold mr-3">
                        Step {idx + 1}
                      </span>
                      <h5 className="text-lg font-semibold text-gray-900">{block.section || `Code Block ${idx + 1}`}</h5>
                    </div>
                    
                    {/* Code Block with Enhanced Styling */}
                    {block.code && (
                      <div className="mb-6">
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto border-l-4 border-purple-500">
                          <pre className="text-sm font-mono whitespace-pre-wrap break-words"><code>{block.code}</code></pre>
                        </div>
                      </div>
                    )}
                    
                    {/* Technical Explanation */}
                    {(block.explanation || editingSection === `code_blocks.${idx}.explanation`) && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className="p-1.5 bg-blue-100 rounded-md mr-2">
                              <Wrench className="h-4 w-4 text-blue-600" />
                            </div>
                            <h6 className="font-semibold text-gray-800">Technical Explanation</h6>
                          </div>
                          {onUpdateDocumentation && (
                            <button
                              onClick={() => handleStartEdit(`code_blocks.${idx}.explanation`, block.explanation)}
                              className="flex items-center justify-center w-6 h-6 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title={(() => {
                                const userInfo = getUserInfoForSection(`code_blocks.${idx}.explanation`);
                                return userInfo ? formatUserTooltip(userInfo) : 'Edit technical explanation';
                              })()}
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        
                        {editingSection === `code_blocks.${idx}.explanation` ? (
                          <div className="space-y-3">
                            <textarea
                              ref={(el) => setTextareaRef(`code_blocks.${idx}.explanation`, el)}
                              value={editedContent[`code_blocks.${idx}.explanation`] || ''}
                              onChange={(e) => {
                                setEditedContent((prev: any) => ({
                                  ...prev,
                                  [`code_blocks.${idx}.explanation`]: e.target.value
                                }));
                              }}
                              className="w-full min-h-32 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                              placeholder="Enter technical explanation..."
                              autoFocus
                              rows={4}
                              key={`code_blocks.${idx}.explanation`}
                            />
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleSaveEdit(`code_blocks.${idx}.explanation`)}
                                disabled={isUpdating === `code_blocks.${idx}.explanation`}
                                className="flex items-center px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors"
                              >
                                {isUpdating === `code_blocks.${idx}.explanation` ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3 mr-1" />
                                )}
                                {isUpdating === `code_blocks.${idx}.explanation` ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isUpdating === `code_blocks.${idx}.explanation`}
                                className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-md transition-colors"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-700 bg-blue-50 p-4 rounded-lg border border-blue-200 border-l-4 border-l-blue-500">
                            {block.explanation ? (
                              typeof block.explanation === 'string' ? (
                                formatTextWithNumberedPoints(block.explanation)
                              ) : (
                                renderSafeContent(block.explanation)
                              )
                            ) : (
                              <p className="text-gray-500 italic">No technical explanation available</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Business Context */}
                    {(block.business_context || editingSection === `code_blocks.${idx}.business_context`) && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center">
                            <div className="p-1.5 bg-green-100 rounded-md mr-2">
                              <BarChart3 className="h-4 w-4 text-green-600" />
                            </div>
                            <h6 className="font-semibold text-gray-800">Business Context</h6>
                          </div>
                          {onUpdateDocumentation && (
                            <button
                              onClick={() => handleStartEdit(`code_blocks.${idx}.business_context`, block.business_context)}
                              className="flex items-center justify-center w-6 h-6 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title={(() => {
                                const userInfo = getUserInfoForSection(`code_blocks.${idx}.business_context`);
                                return userInfo ? formatUserTooltip(userInfo) : 'Edit business context';
                              })()}
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        
                        {editingSection === `code_blocks.${idx}.business_context` ? (
                          <div className="space-y-3">
                            <textarea
                              ref={(el) => setTextareaRef(`code_blocks.${idx}.business_context`, el)}
                              value={editedContent[`code_blocks.${idx}.business_context`] || ''}
                              onChange={(e) => {
                                setEditedContent((prev: any) => ({
                                  ...prev,
                                  [`code_blocks.${idx}.business_context`]: e.target.value
                                }));
                              }}
                              className="w-full min-h-32 p-3 border border-gray-300 rounded-lg resize-y focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                              placeholder="Enter business context..."
                              autoFocus
                              rows={4}
                              key={`code_blocks.${idx}.business_context`}
                            />
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleSaveEdit(`code_blocks.${idx}.business_context`)}
                                disabled={isUpdating === `code_blocks.${idx}.business_context`}
                                className="flex items-center px-3 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors"
                              >
                                {isUpdating === `code_blocks.${idx}.business_context` ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Save className="h-3 w-3 mr-1" />
                                )}
                                {isUpdating === `code_blocks.${idx}.business_context` ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isUpdating === `code_blocks.${idx}.business_context`}
                                className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-md transition-colors"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-700 bg-green-50 p-4 rounded-lg border border-green-200 border-l-4 border-l-green-500">
                            {block.business_context ? (
                              typeof block.business_context === 'string' ? (
                                formatTextWithNumberedPoints(block.business_context)
                              ) : (
                                renderSafeContent(block.business_context)
                              )
                            ) : (
                              <p className="text-gray-500 italic">No business context available</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </EditableSection>
          )}

          {/* Technical Details */}
          {summaryContent.technical_details && (
            <EditableSection
              sectionKey="technical_details"
              title="Technical Implementation"
              content={summaryContent.technical_details}
              icon={<Settings className="h-6 w-6 text-gray-600" />}
              className="bg-gray-50 border-gray-200"
              editingSection={editingSection}
              isUpdating={isUpdating}
              userInfo={getUserInfoForSection("technical_details")}
              onUpdateDocumentation={onUpdateDocumentation}
              handleStartEdit={handleStartEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
              formatUserTooltip={formatUserTooltip}
              setTextareaRef={setTextareaRef}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
            >
              {/* Check if technical_details has structured properties */}
              {(summaryContent.technical_details.materialization || 
                summaryContent.technical_details.source_tables || 
                summaryContent.technical_details.sql_operations || 
                summaryContent.technical_details.incremental_strategy) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {summaryContent.technical_details.materialization && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center mb-3">
                        <Server className="h-5 w-5 text-blue-600 mr-2" />
                        <h5 className="font-semibold text-gray-800">Materialization</h5>
                      </div>
                      <span className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-2 rounded-full text-sm font-medium">
                        <Database className="h-4 w-4 mr-2" />
                        {summaryContent.technical_details.materialization}
                      </span>
                    </div>
                  )}
                  
                  {summaryContent.technical_details.source_tables && Array.isArray(summaryContent.technical_details.source_tables) && summaryContent.technical_details.source_tables.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center mb-3">
                        <BarChart3 className="h-5 w-5 text-orange-600 mr-2" />
                        <h5 className="font-semibold text-gray-800">Source Tables</h5>
                      </div>
                      <div className="space-y-2">
                        {summaryContent.technical_details.source_tables.map((table: string, idx: number) => (
                          <div key={idx} className="flex items-center bg-orange-50 text-orange-800 px-3 py-2 rounded-lg text-sm border border-orange-200">
                            <Database className="h-4 w-4 mr-2" />
                            {table}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {summaryContent.technical_details.sql_operations && Array.isArray(summaryContent.technical_details.sql_operations) && summaryContent.technical_details.sql_operations.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center mb-3">
                        <Code className="h-5 w-5 text-purple-600 mr-2" />
                        <h5 className="font-semibold text-gray-800">SQL Operations</h5>
                      </div>
                      <div className="space-y-2">
                        {summaryContent.technical_details.sql_operations.map((op: string, idx: number) => (
                          <div key={idx} className="flex items-center bg-purple-50 text-purple-800 px-3 py-2 rounded-lg text-sm border border-purple-200">
                            <Activity className="h-4 w-4 mr-2" />
                            {op}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {summaryContent.technical_details.incremental_strategy && (
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center mb-3">
                        <ArrowUpRight className="h-5 w-5 text-green-600 mr-2" />
                        <h5 className="font-semibold text-gray-800">Incremental Strategy</h5>
                      </div>
                      <span className="inline-flex items-center bg-green-100 text-green-800 px-3 py-2 rounded-full text-sm font-medium">
                        <Clock className="h-4 w-4 mr-2" />
                        {summaryContent.technical_details.incremental_strategy}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full overflow-hidden">
                  {renderSafeContent(summaryContent.technical_details)}
                </div>
              )}
            </EditableSection>
          )}

          {/* Execution Flow Section */}
          {summaryContent?.execution_flow && Array.isArray(summaryContent.execution_flow) && summaryContent.execution_flow.length > 0 && (
            <EditableSection
              sectionKey="execution_flow"
              title="Execution Flow"
              content={summaryContent.execution_flow}
              icon={<Play className="h-6 w-6 text-blue-600" />}
              className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200"
              editingSection={editingSection}
              isUpdating={isUpdating}
              userInfo={getUserInfoForSection("execution_flow")}
              onUpdateDocumentation={onUpdateDocumentation}
              handleStartEdit={handleStartEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
              formatUserTooltip={formatUserTooltip}
              setTextareaRef={setTextareaRef}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
            >
              <div className="space-y-4">
                {summaryContent.execution_flow.map((step: string, idx: number) => (
                  <div key={idx} className="flex items-start">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold mr-4 mt-1 flex-shrink-0 border-2 border-blue-200">
                      {idx + 1}
                    </div>
                    <div className="flex-1 bg-white p-4 rounded-lg border border-blue-200 border-l-4 border-l-blue-500 shadow-sm">
                      <div className="flex items-start">
                        <ArrowRight className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-700 leading-relaxed break-words">{step}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </EditableSection>
          )}

          {summaryContent?.performance_considerations && (
            <EditableSection
              sectionKey="performance_considerations"
              title="Performance Considerations"
              content={summaryContent.performance_considerations}
              icon={<Zap className="h-6 w-6 text-orange-600" />}
              className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200"
              editingSection={editingSection}
              isUpdating={isUpdating}
              userInfo={getUserInfoForSection("performance_considerations")}
              onUpdateDocumentation={onUpdateDocumentation}
              handleStartEdit={handleStartEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
              formatUserTooltip={formatUserTooltip}
              setTextareaRef={setTextareaRef}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
            >
              {/* Handle both array and object formats */}
              {Array.isArray(summaryContent.performance_considerations) ? (
                <div className="space-y-2">
                  {summaryContent.performance_considerations.map((consideration: string, idx: number) => (
                    <div key={idx} className="flex items-start">
                      <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-orange-400 break-words">{consideration}</p>
                    </div>
                  ))}
                </div>
              ) : typeof summaryContent.performance_considerations === 'object' && (
                summaryContent.performance_considerations.optimization_opportunities || 
                summaryContent.performance_considerations.resource_usage || 
                summaryContent.performance_considerations.scalability_notes
              ) ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {summaryContent.performance_considerations.optimization_opportunities && Array.isArray(summaryContent.performance_considerations.optimization_opportunities) && (
                    <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                      <div className="flex items-center mb-3">
                        <ArrowUpRight className="h-5 w-5 text-orange-600 mr-2" />
                        <h5 className="font-semibold text-orange-800">Optimization Opportunities</h5>
                      </div>
                      <div className="space-y-3">
                        {summaryContent.performance_considerations.optimization_opportunities.map((opt: string, idx: number) => (
                          <div key={idx} className="flex items-start text-sm text-gray-700">
                            <Gauge className="h-4 w-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed break-words">{opt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {summaryContent.performance_considerations.resource_usage && Array.isArray(summaryContent.performance_considerations.resource_usage) && (
                    <div className="bg-white p-4 rounded-lg border border-orange-200 shadow-sm">
                      <div className="flex items-center mb-3">
                        <Cpu className="h-5 w-5 text-orange-600 mr-2" />
                        <h5 className="font-semibold text-orange-800">Resource Usage</h5>
                      </div>
                      <div className="space-y-3">
                        {summaryContent.performance_considerations.resource_usage.map((usage: string, idx: number) => (
                          <div key={idx} className="flex items-start text-sm text-gray-700">
                            <Monitor className="h-4 w-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed break-words">{usage}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {summaryContent.performance_considerations.scalability_notes && Array.isArray(summaryContent.performance_considerations.scalability_notes) && (
                    <div className="bg-white p-4 rounded-lg border border-orange-200 md:col-span-2 shadow-sm">
                      <div className="flex items-center mb-3">
                        <TrendingUp className="h-5 w-5 text-orange-600 mr-2" />
                        <h5 className="font-semibold text-orange-800">Scalability Notes</h5>
                      </div>
                      <div className="space-y-3">
                        {summaryContent.performance_considerations.scalability_notes.map((note: string, idx: number) => (
                          <div key={idx} className="flex items-start text-sm text-gray-700">
                            <ArrowUpRight className="h-4 w-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed break-words">{note}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full overflow-hidden">
                  {renderSafeContent(summaryContent.performance_considerations)}
                </div>
              )}
            </EditableSection>
          )}

          {summaryContent?.best_practices && (
            <EditableSection
              sectionKey="best_practices"
              title="Best Practices"
              content={summaryContent.best_practices}
              icon={<CheckCircle className="h-6 w-6 text-green-600" />}
              className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200"
              editingSection={editingSection}
              isUpdating={isUpdating}
              userInfo={getUserInfoForSection("best_practices")}
              onUpdateDocumentation={onUpdateDocumentation}
              handleStartEdit={handleStartEdit}
              handleSaveEdit={handleSaveEdit}
              handleCancelEdit={handleCancelEdit}
              formatUserTooltip={formatUserTooltip}
              setTextareaRef={setTextareaRef}
              editedContent={editedContent}
              setEditedContent={setEditedContent}
            >
              {/* Handle both array and object formats */}
              {Array.isArray(summaryContent.best_practices) ? (
                <div className="space-y-2">
                  {summaryContent.best_practices.map((practice: string, idx: number) => (
                    <div key={idx} className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-1 mr-3 flex-shrink-0" />
                      <p className="text-gray-700 bg-white p-3 rounded border-l-4 border-green-400 break-words">{practice}</p>
                    </div>
                  ))}
                </div>
              ) : typeof summaryContent.best_practices === 'object' && (
                summaryContent.best_practices.followed || 
                summaryContent.best_practices.improvements || 
                summaryContent.best_practices.sql_server_optimizations
              ) ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {summaryContent.best_practices.followed && Array.isArray(summaryContent.best_practices.followed) && (
                    <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                      <div className="flex items-center mb-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <h5 className="font-semibold text-green-800">Practices Followed</h5>
                      </div>
                      <div className="space-y-3">
                        {summaryContent.best_practices.followed.map((practice: string, idx: number) => (
                          <div key={idx} className="flex items-start text-sm text-gray-700">
                            <FileCheck className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed break-words">{practice}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {summaryContent.best_practices.improvements && Array.isArray(summaryContent.best_practices.improvements) && (
                    <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                      <div className="flex items-center mb-3">
                        <Wrench className="h-5 w-5 text-green-600 mr-2" />
                        <h5 className="font-semibold text-green-800">Suggested Improvements</h5>
                      </div>
                      <div className="space-y-3">
                        {summaryContent.best_practices.improvements.map((improvement: string, idx: number) => (
                          <div key={idx} className="flex items-start text-sm text-gray-700">
                            <ArrowUpRight className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed break-words">{improvement}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {summaryContent.best_practices.sql_server_optimizations && Array.isArray(summaryContent.best_practices.sql_server_optimizations) && (
                    <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                      <div className="flex items-center mb-3">
                        <Database className="h-5 w-5 text-green-600 mr-2" />
                        <h5 className="font-semibold text-green-800">SQL Server Optimizations</h5>
                      </div>
                      <div className="space-y-3">
                        {summaryContent.best_practices.sql_server_optimizations.map((opt: string, idx: number) => (
                          <div key={idx} className="flex items-start text-sm text-gray-700">
                            <Zap className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed break-words">{opt}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full overflow-hidden">
                  {renderSafeContent(summaryContent.best_practices)}
                </div>
              )}
            </EditableSection>
          )}

          {/* Dependencies Section */}
          {summaryContent?.dependencies && Array.isArray(summaryContent.dependencies) && summaryContent.dependencies.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center mb-6">
                <div className="p-2 bg-orange-100 rounded-lg mr-3">
                  <Package className="h-6 w-6 text-orange-600" />
                </div>
                <h4 className="text-xl font-bold text-gray-900">Dependencies</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {summaryContent.dependencies.map((dep: string, index: number) => (
                  <div key={index} className="flex items-center bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 hover:bg-orange-100 transition-colors">
                    <Layers className="h-4 w-4 text-orange-600 mr-3 flex-shrink-0" />
                    <span className="text-orange-800 font-medium text-sm">{dep}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">No Documentation Content</h3>
          <p className="text-gray-600">
            This file doesn't have any structured documentation yet. 
            Try analyzing the file first to generate documentation.
          </p>
        </div>
      )}
    </div>
  );
}; 