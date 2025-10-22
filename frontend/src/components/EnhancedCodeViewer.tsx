import React from 'react';
import { 
  Copy, 
  CheckCircle, 
  FileText, 
  Package, 
  File,
  Folder
} from 'lucide-react';
import { formatCodeWithSyntaxHighlighting } from '../utils/syntaxHighlighting';

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
}

interface EnhancedCodeViewerProps {
  selectedFile: FileItem;
  selectedFileContent: string;
  isLoadingFileContent: boolean;
  fileContentError: string | null;
  brandColor: string;
  copyToClipboard: (text: string) => void;
  isTextCopied: (text: string) => boolean;
}

export const EnhancedCodeViewer: React.FC<EnhancedCodeViewerProps> = ({
  selectedFile,
  selectedFileContent,
  isLoadingFileContent,
  fileContentError,
  brandColor,
  copyToClipboard,
  isTextCopied
}) => {
  // Get file icon based on file type
  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconClass = "h-4 w-4";
    
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <File className={`${iconClass} text-yellow-500`} />;
      case 'py':
        return <File className={`${iconClass} text-blue-600`} />;
      case 'java':
        return <File className={`${iconClass} text-red-600`} />;
      case 'html':
      case 'htm':
        return <File className={`${iconClass} text-orange-500`} />;
      case 'css':
      case 'scss':
      case 'sass':
        return <File className={`${iconClass} text-blue-400`} />;
      case 'json':
        return <File className={`${iconClass} text-green-600`} />;
      case 'md':
      case 'markdown':
        return <File className={`${iconClass} text-gray-600`} />;
      case 'yml':
      case 'yaml':
        return <File className={`${iconClass} text-purple-600`} />;
      default:
        return <File className={`${iconClass} text-gray-500`} />;
    }
  };

  if (isLoadingFileContent) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <p className="ml-3 text-gray-600">Loading content for {selectedFile.name}...</p>
      </div>
    );
  }

  if (fileContentError) {
    return (
      <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md">
        <h4 className="font-semibold text-lg mb-1">Error Loading File Content</h4>
        <p>{fileContentError}</p>
      </div>
    );
  }

  if (!selectedFileContent) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <File className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content available</h3>
          <p className="text-gray-500">Unable to load file content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Enhanced Code Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg mr-3">
            {getFileIcon(selectedFile.name)}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {selectedFile.name}
            </h3>
            <p className="text-xs text-gray-500">
              {selectedFile.path}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
            {selectedFile.name.split('.').pop()?.toUpperCase() || 'TXT'}
          </span>
          <button
            onClick={() => copyToClipboard(selectedFileContent)}
            className={`inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md transition-colors ${
              isTextCopied(selectedFileContent) 
                ? 'text-green-700 bg-green-50 border-green-300' 
                : 'text-gray-700 bg-white hover:bg-gray-50'
            } focus:outline-none focus:ring-2 focus:ring-offset-2`}
            style={{borderColor: isTextCopied(selectedFileContent) ? '#10b981' : brandColor}}
            title={isTextCopied(selectedFileContent) ? "Copied!" : "Copy code"}
          >
            {isTextCopied(selectedFileContent) ? (
              <CheckCircle className="h-4 w-4 mr-1" />
            ) : (
              <Copy className="h-4 w-4 mr-1" />
            )}
            {isTextCopied(selectedFileContent) ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      
      {/* Enhanced Code Content with Line Numbers */}
      <div className="relative flex">
        {/* Line Numbers */}
        <div className="bg-gray-800 text-gray-400 px-3 py-3 text-sm font-mono leading-5 select-none border-r border-gray-700 min-w-[3rem]">
          {selectedFileContent.split('\n').map((_, index) => (
            <div key={index} className="text-right pr-2">
              {index + 1}
            </div>
          ))}
        </div>
        
        {/* Code Content with Syntax Highlighting */}
        <div className="flex-1 bg-gray-900 text-gray-100 p-3 overflow-x-auto">
          <pre className="text-sm font-mono leading-5 whitespace-pre">
            <code className="language-auto">
              {formatCodeWithSyntaxHighlighting(selectedFileContent, selectedFile.name)}
            </code>
          </pre>
        </div>
      </div>
      
      {/* Enhanced File Stats Footer */}
      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <FileText className="h-3 w-3 mr-1" />
            {selectedFileContent.split('\n').length} lines
          </span>
          <span className="flex items-center">
            <Package className="h-3 w-3 mr-1" />
            {new Blob([selectedFileContent]).size} bytes
          </span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            Ready
          </span>
        </div>
      </div>
    </div>
  );
}; 