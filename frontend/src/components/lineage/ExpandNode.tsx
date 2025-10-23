import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface ExpandNodeData {
  direction: 'upstream' | 'downstream';
  count: number;
  onExpand: () => void;
}

function ExpandNode({ data }: NodeProps<ExpandNodeData>) {
  const [isLoading, setIsLoading] = useState(false);
  const isUpstream = data.direction === 'upstream';
  const Icon = isUpstream ? ChevronLeft : ChevronRight;
  
  const handleClick = () => {
    setIsLoading(true);
    data.onExpand();
    // Loading state will be cleared when component re-renders with new data
  };
  
  return (
    <div className="relative">
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 !bg-gray-400 border-2 border-white opacity-0"
      />
      
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:shadow-md transition-all duration-200 cursor-pointer group disabled:opacity-70 disabled:cursor-wait"
        style={{ minWidth: '200px' }}
      >
        <div className="flex items-center justify-center gap-2">
          {isUpstream && !isLoading && (
            <div className="p-1 bg-blue-500 rounded-full group-hover:scale-110 transition-transform">
              <Icon className="w-4 h-4 text-white" />
            </div>
          )}
          {isLoading && (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          )}
          <div className="text-center">
            <div className="text-sm font-semibold text-blue-700">
              {isLoading ? 'Loading...' : `Load ${data.count} more`}
            </div>
            <div className="text-xs text-blue-600">
              {isUpstream ? 'upstream' : 'downstream'}
            </div>
          </div>
          {!isUpstream && !isLoading && (
            <div className="p-1 bg-blue-500 rounded-full group-hover:scale-110 transition-transform">
              <Icon className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </button>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 !bg-gray-400 border-2 border-white opacity-0"
      />
    </div>
  );
}

export default memo(ExpandNode);
