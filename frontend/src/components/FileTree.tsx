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
      return <Folder className="h-4 w-4 text-blue-500 mr-2" />;
    }
    
    const extension = fileName.split('.').pop()?.toLowerCase();
    const iconClass = "h-4 w-4 mr-2";
    
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
    <div className="bg-gray-50 border-r border-gray-200 w-80">
      {/* File Tree Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center text-sm text-gray-600 overflow-hidden">
            <span className="font-medium text-gray-700 whitespace-nowrap truncate">
              {selectedGitHubRepo?.name}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <button className="flex items-center text-sm bg-white border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{borderColor: brandColor, color: brandColor}}>
                <GitBranch className="h-4 w-4 mr-1.5" style={{color: brandColor}} />
                {activeBranch}
                <ChevronDown className="h-4 w-4 ml-1 text-gray-400" />
              </button>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 pr-2 py-1.5 border border-gray-300 rounded-md text-sm w-full focus:ring-1 focus:outline-none"
                style={{borderColor: brandColor}}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* File List */}
      <div className="flex-grow overflow-y-auto">
        {isLoadingTree ? (
          <div className="flex items-center justify-center h-32 p-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            <p className="ml-3 text-sm text-gray-600">Loading repository tree...</p>
          </div>
        ) : treeError ? (
          <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-md m-4">
            <h4 className="font-semibold text-sm mb-1">Error Loading Repository Tree</h4>
            <p className="text-xs">{treeError}</p>
          </div>
        ) : (
          <div className="p-0">
            {getFilteredTree().length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Inbox className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="font-medium text-sm">No files found.</p>
                {searchQuery && <p className="text-xs mt-1">No files match "{searchQuery}".</p>}
              </div>
            ) : (
              getFilteredTree().map((node) => (
                <div
                  key={node.id}
                  onClick={() => onTreeItemClick(node)}
                  className={`flex items-center justify-between p-2 cursor-pointer hover:bg-gray-100 border-b border-gray-50 text-sm ${
                    selectedFile?.path === node.path ? 'bg-[#2AB7A9] bg-opacity-10 border-[#2AB7A9]' : ''
                  }`}
                  style={{ paddingLeft: `${8 + node.level * 16}px` }}
                >
                  <div className="flex items-center truncate">
                    {node.type === 'folder' && (
                      <button 
                        className="mr-1 p-0.5 hover:bg-gray-200 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFolderToggle(node.path);
                        }}
                      >
                        {node.isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-gray-500" />
                        )}
                      </button>
                    )}
                    {node.type === 'file' && <div className="w-4 mr-1" />}
                    {getFileIcon(node.name, node.type)}
                    <span 
                      className={`truncate ${
                        selectedFile?.path === node.path ? 'text-[#2AB7A9] font-medium' : 'text-gray-800'
                      }`} 
                      title={node.name}
                    >
                      {node.name}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 ml-4 flex-shrink-0">
                    {node.type === 'file' && node.size !== undefined ? `${(node.size / 1024).toFixed(1)} KB` : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 