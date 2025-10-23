import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  File, 
  Search,
  GitBranch,
  Loader2,
  Inbox,
  FileCode,
  FileJson,
  FileText
} from 'lucide-react';

interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  isExpanded: boolean;
  children: TreeNode[];
  level: number;
}

interface FileItem {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  isExpanded?: boolean;
  children?: FileItem[];
  modified?: string;
}

interface FileTreeModernProps {
  fileTree: TreeNode[];
  isLoadingTree: boolean;
  treeError: string | null;
  selectedFile: FileItem | null;
  searchQuery: string;
  activeBranch: string;
  selectedGitHubRepo: any;
  brandColor: string;
  onTreeItemClick: (node: TreeNode) => void;
  onSearchChange: (query: string) => void;
  onFolderToggle: (nodePath: string) => void;
}

export const FileTreeModern: React.FC<FileTreeModernProps> = ({
  fileTree,
  isLoadingTree,
  treeError,
  selectedFile,
  searchQuery,
  activeBranch,
  selectedGitHubRepo,
  brandColor,
  onTreeItemClick,
  onSearchChange,
  onFolderToggle
}) => {
  const [treeWidth, setTreeWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(320);
  const treeRef = useRef<HTMLDivElement>(null);

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(treeWidth);
  };

  // Handle resizing with drag - using RAF for smooth performance
  useEffect(() => {
    let rafId: number;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Use requestAnimationFrame for smooth rendering
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
        // Calculate the new width based on mouse movement
        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        
        // Constrain within min and max bounds
        const constrainedWidth = Math.min(Math.max(newWidth, 240), 600);
        setTreeWidth(constrainedWidth);
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isResizing, startX, startWidth]);

  // Flatten tree for rendering
  const flattenTree = (tree: TreeNode[]): TreeNode[] => {
    const flattened: TreeNode[] = [];
    
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        flattened.push(node);
        if (node.isExpanded && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    
    traverse(tree);
    return flattened;
  };

  // Filter tree based on search
  const getFilteredTree = (): TreeNode[] => {
    if (!searchQuery) return flattenTree(fileTree);
    
    const filtered: TreeNode[] = [];
    const traverse = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          filtered.push(node);
        }
        if (node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    
    traverse(fileTree);
    return filtered;
  };

  // Get file icon with color
  const getFileIcon = (fileName: string, type: string) => {
    if (type === 'folder') {
      return <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <FileCode className="h-4 w-4 text-yellow-600 flex-shrink-0" />;
      case 'json':
        return <FileJson className="h-4 w-4 text-green-600 flex-shrink-0" />;
      case 'py':
        return <FileCode className="h-4 w-4 text-blue-600 flex-shrink-0" />;
      case 'md':
      case 'txt':
        return <FileText className="h-4 w-4 text-gray-600 flex-shrink-0" />;
      case 'sql':
        return <FileCode className="h-4 w-4 text-orange-600 flex-shrink-0" />;
      default:
        return <File className="h-4 w-4 text-gray-500 flex-shrink-0" />;
    }
  };

  return (
    <div 
      ref={treeRef}
      className="h-full flex flex-col bg-white border-r border-gray-200 relative transition-all duration-100 ease-out"
      style={{ 
        width: `${treeWidth}px`, 
        minWidth: '240px', 
        maxWidth: '600px',
        transition: isResizing ? 'none' : 'width 0.15s ease-out'
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white">
        <div className="flex flex-col gap-2.5">
          {/* Repo Name */}
          <div className="flex items-center">
            <span className="font-semibold text-sm text-gray-800 truncate">
              {selectedGitHubRepo?.name || 'Repository'}
            </span>
          </div>
          
          {/* Branch Selector */}
          <button 
            className="flex items-center justify-between text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors shadow-sm"
            style={{ borderColor: brandColor + '40' }}
          >
            <div className="flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" style={{ color: brandColor }} />
              <span className="text-gray-700 font-medium">{activeBranch}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
              style={{ 
                borderColor: searchQuery ? brandColor : undefined
              }}
            />
          </div>
        </div>
      </div>
      
      {/* File List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {isLoadingTree ? (
          <div className="flex items-center justify-center h-32 p-4">
            <div className="text-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Loading files...</p>
            </div>
          </div>
        ) : treeError ? (
          <div className="p-3 m-3 text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-semibold mb-1">Error Loading Tree</p>
            <p className="text-xs">{treeError}</p>
          </div>
        ) : getFilteredTree().length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Inbox className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="font-medium text-sm mb-1">No files found</p>
            {searchQuery && (
              <p className="text-xs text-gray-400">
                No matches for "{searchQuery}"
              </p>
            )}
          </div>
        ) : (
          <div className="py-1">
            {getFilteredTree().map((node) => (
              <div
                key={node.id}
                onClick={() => onTreeItemClick(node)}
                className={`
                  flex items-center gap-1.5 px-2 py-1.5 cursor-pointer 
                  transition-all duration-150 ease-in-out
                  hover:bg-gray-100 active:bg-gray-200
                  ${selectedFile?.path === node.path 
                    ? 'bg-blue-50 border-l-2 border-blue-500' 
                    : 'border-l-2 border-transparent'
                  }
                `}
                style={{ 
                  paddingLeft: `${8 + node.level * 16}px`,
                  backgroundColor: selectedFile?.path === node.path 
                    ? brandColor + '10' 
                    : undefined
                }}
                title={node.path}
              >
                {/* Expand/Collapse Button */}
                {node.type === 'folder' && (
                  <button
                    className="p-0.5 hover:bg-gray-200 rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFolderToggle(node.path);
                    }}
                  >
                    {node.isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-600" />
                    )}
                  </button>
                )}
                {node.type === 'file' && <div className="w-5" />}
                
                {/* Icon */}
                {getFileIcon(node.name, node.type)}
                
                {/* Name */}
                <span 
                  className={`
                    text-xs truncate flex-1 min-w-0
                    ${selectedFile?.path === node.path 
                      ? 'font-semibold' 
                      : 'font-normal'
                    }
                    ${selectedFile?.path === node.path 
                      ? 'text-gray-900' 
                      : 'text-gray-700'
                    }
                  `}
                >
                  {node.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-50 flex items-center justify-center group"
        onMouseDown={handleResizeStart}
      >
        {/* Visual indicator */}
        <div 
          className="h-full w-1 bg-transparent group-hover:bg-blue-400 transition-all duration-200"
          style={{ backgroundColor: isResizing ? brandColor : undefined }}
        />
        {/* Invisible wider hit area */}
        <div className="absolute inset-0 w-4 -ml-1" />
      </div>

      {/* Custom Scrollbar Styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};
