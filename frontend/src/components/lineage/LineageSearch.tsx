import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Node } from 'reactflow';

interface LineageSearchProps {
  nodes: Node[];
  onNodeSelect: (nodeId: string) => void;
  onClear: () => void;
}

export default function LineageSearch({ nodes, onNodeSelect, onClear }: LineageSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredNodes, setFilteredNodes] = useState<Node[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = nodes.filter(node =>
        node.data.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.data.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredNodes(filtered);
      setShowResults(true);
    } else {
      setFilteredNodes([]);
      setShowResults(false);
    }
  }, [searchTerm, nodes]);

  const handleSelect = (nodeId: string) => {
    onNodeSelect(nodeId);
    setSearchTerm('');
    setShowResults(false);
  };

  const handleClear = () => {
    setSearchTerm('');
    setShowResults(false);
    onClear();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search models..."
          className="w-64 pl-9 pr-9 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showResults && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowResults(false)}
          />
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 max-h-64 overflow-y-auto">
            {filteredNodes.length > 0 ? (
              filteredNodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => handleSelect(node.id)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {node.data.name}
                    </div>
                    <div className="text-xs text-gray-500">{node.data.type}</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    ↑{node.data.stats?.upstreamCount || 0} ↓{node.data.stats?.downstreamCount || 0}
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No models found
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
