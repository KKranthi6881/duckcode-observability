import React from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  File, 
  Search,
  GitBranch,
  Loader2,
  Inbox
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

interface FileTreeProps {
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

export const FileTree: React.FC<FileTreeProps> = ({
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
  // Flatten tree for rendering with proper indentation
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

  // Filter tree based on search query
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

  // Get file icon based on file type
  const getFileIcon = (fileName: string, type: string) => {
    if (type === 'folder') {
      return <Folder className="h-3 w-3 text-blue-500" />;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconClass = "h-3 w-3";
    
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

  return (
    <div className="h-full flex flex-col bg-white">
      {/* File Tree Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex-shrink-0 sticky top-0 z-10">
        <div className="flex flex-col gap-2">
          <div className="flex items-center text-xs text-gray-600 overflow-hidden">
            <span className="font-medium text-gray-700 whitespace-nowrap truncate">
              {selectedGitHubRepo?.name}
            </span>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="relative">
              <button className="flex items-center text-xs bg-white border border-gray-300 rounded-md px-2 py-1 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 w-full justify-between"
                style={{borderColor: brandColor, color: brandColor}}>
                <div className="flex items-center">
                  <GitBranch className="h-3 w-3 mr-1" style={{color: brandColor}} />
                  <span className="truncate">{activeBranch}</span>
                </div>
                <ChevronDown className="h-3 w-3 text-gray-400 ml-1 flex-shrink-0" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-6 pr-2 py-1 border border-gray-300 rounded-md text-xs w-full focus:ring-1 focus:outline-none"
                style={{borderColor: brandColor}}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingTree ? (
          <div className="flex items-center justify-center h-32 p-4">
            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
            <p className="ml-2 text-xs text-gray-600">Loading...</p>
          </div>
        ) : treeError ? (
          <div className="p-3 text-red-700 bg-red-50 border border-red-200 rounded-md m-3">
            <h4 className="font-semibold text-xs mb-1">Error Loading Repository Tree</h4>
            <p className="text-xs">{treeError}</p>
          </div>
        ) : (
          <div className="p-0">
            {getFilteredTree().length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Inbox className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="font-medium text-xs">No files found.</p>
                {searchQuery && <p className="text-xs mt-1">No files match "{searchQuery}".</p>}
              </div>
            ) : (
              getFilteredTree().map((node) => (
                <div
                  key={node.id}
                  onClick={() => onTreeItemClick(node)}
                  className={`flex items-center px-2 py-1.5 cursor-pointer hover:bg-gray-100 text-xs group ${
                    selectedFile?.path === node.path ? 'bg-[#2AB7A9] bg-opacity-10' : ''
                  }`}
                  style={{ paddingLeft: `${8 + node.level * 16}px` }}
                  title={node.path}
                >
                  {node.type === 'folder' && (
                    <button 
                      className="mr-1.5 p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFolderToggle(node.path);
                      }}
                    >
                      {node.isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
                      )}
                    </button>
                  )}
                  {node.type === 'file' && <div className="w-4 mr-1.5 flex-shrink-0" />}
                  <div className="flex-shrink-0 mr-1.5">
                    {getFileIcon(node.name, node.type)}
                  </div>
                  <span 
                    className={`truncate ${
                      selectedFile?.path === node.path ? 'text-[#2AB7A9] font-semibold' : 'text-gray-700'
                    }`}
                  >
                    {node.name}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 