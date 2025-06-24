import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import { DocumentationViewer } from './DocumentationViewer';
import { LineageViewer } from './LineageViewer';
import { KnowledgeGraphViewer } from './KnowledgeGraphViewer';
import { AlertsViewer } from './AlertsViewer';

interface FileContentViewerProps {
  activeTab: 'code' | 'documentation' | 'lineage' | 'visual' | 'alerts';
  selectedFile: {
    id: string;
    name: string;
    path: string;
    type: 'file' | 'folder';
    size?: number;
  } | null;
  selectedFileContent: string | null;
  isLoadingFileContent: boolean;
  fileContentError: string | null;
  selectedFileSummary: any;
  isLoadingFileSummary: boolean;
  fileSummaryError: string | null;
  brandColor: string;
  setActiveTab: (tab: 'code' | 'documentation' | 'lineage' | 'visual' | 'alerts') => void;
  copyToClipboard: (text: string) => void;
}

export const FileContentViewer: React.FC<FileContentViewerProps> = ({
  activeTab,
  selectedFile,
  selectedFileContent,
  isLoadingFileContent,
  fileContentError,
  selectedFileSummary,
  isLoadingFileSummary,
  fileSummaryError,
  brandColor,
  setActiveTab,
  copyToClipboard,
}) => {
  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 mx-auto text-gray-300 mb-4">
            📄
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a file to view</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            Choose a file from the tree on the left to view its content, documentation, and analysis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
        <nav className="-mb-px flex space-x-px px-4" aria-label="Tabs">
          {[
            { id: 'code', label: 'Code' },
            { id: 'documentation', label: 'Documentation' },
            { id: 'lineage', label: 'Lineage' },
            { id: 'visual', label: 'Knowledge Graph' },
            { id: 'alerts', label: 'Alerts' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-current text-current'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              style={{
                borderColor: activeTab === tab.id ? brandColor : 'transparent',
                color: activeTab === tab.id ? brandColor : undefined,
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="flex-grow overflow-auto p-4 bg-gray-50 relative">
        {isLoadingFileContent && activeTab === 'code' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <p className="ml-3 text-gray-600">Loading content for {selectedFile.name}...</p>
          </div>
        ) : fileContentError && activeTab === 'code' ? (
          <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md">
            <h4 className="font-semibold text-lg mb-1">Error Loading File Content</h4>
            <p>{fileContentError}</p>
          </div>
        ) : activeTab === 'code' && selectedFileContent ? (
          <CodeViewer
            selectedFileContent={selectedFileContent}
            fileName={selectedFile.name}
            onCopy={copyToClipboard}
          />
        ) : activeTab === 'documentation' ? (
          <div className="prose max-w-none">
            <DocumentationViewer
              isLoadingFileSummary={isLoadingFileSummary}
              fileSummaryError={fileSummaryError}
              selectedFileSummary={selectedFileSummary}
            />
          </div>
        ) : activeTab === 'lineage' ? (
          <LineageViewer filePath={selectedFile.path} />
        ) : activeTab === 'visual' ? (
          <KnowledgeGraphViewer filePath={selectedFile.path} />
        ) : activeTab === 'alerts' ? (
          <AlertsViewer filePath={selectedFile.path} />
        ) : activeTab === 'code' ? (
          <div className="p-4 text-gray-500 bg-gray-50 border border-gray-200 rounded-md">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <span>No content available for this file.</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}; 