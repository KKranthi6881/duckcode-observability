import { useState, useMemo } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { Node, Edge } from 'reactflow';

interface ProgressiveModelLoaderProps {
  allNodes: Node[];
  allEdges: Edge[];
  initialLimit?: number;
  loadMoreIncrement?: number;
  children: (visibleNodes: Node[], visibleEdges: Edge[], hasMore: boolean, loadMore: () => void) => React.ReactNode;
}

export default function ProgressiveModelLoader({
  allNodes,
  allEdges,
  initialLimit = 10,
  loadMoreIncrement = 5,
  children
}: ProgressiveModelLoaderProps) {
  const [displayLimit, setDisplayLimit] = useState(initialLimit);

  // Calculate visible nodes and edges
  const { visibleNodes, visibleEdges, hasMore } = useMemo(() => {
    const limited = allNodes.slice(0, displayLimit);
    const nodeIds = new Set(limited.map(n => n.id));
    
    // Filter edges to only show connections between visible nodes
    const filteredEdges = allEdges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return {
      visibleNodes: limited,
      visibleEdges: filteredEdges,
      hasMore: displayLimit < allNodes.length
    };
  }, [allNodes, allEdges, displayLimit]);

  const loadMore = () => {
    setDisplayLimit(prev => Math.min(prev + loadMoreIncrement, allNodes.length));
  };

  return (
    <>
      {children(visibleNodes, visibleEdges, hasMore, loadMore)}
    </>
  );
}

// Floating "Load More" button component
interface LoadMoreButtonProps {
  onClick: () => void;
  remainingCount: number;
  currentCount: number;
  totalCount: number;
}

export function LoadMoreButton({ onClick, remainingCount, currentCount, totalCount }: LoadMoreButtonProps) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
      <button
        onClick={onClick}
        className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 font-medium"
      >
        <Sparkles className="w-5 h-5 animate-pulse" />
        <div className="flex flex-col items-start">
          <span className="text-sm">Load {Math.min(remainingCount, 5)} More Models</span>
          <span className="text-xs opacity-90">
            Showing {currentCount} of {totalCount}
          </span>
        </div>
        <ChevronDown className="w-5 h-5" />
      </button>
    </div>
  );
}
