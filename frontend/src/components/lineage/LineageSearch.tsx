import { useState, useEffect } from 'react';
import { Search, X, Database, Columns } from 'lucide-react';
import { Node } from 'reactflow';

interface SearchResult {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  matchType: 'model' | 'column';
  matchedColumn?: string;
  upstreamCount?: number;
  downstreamCount?: number;
}

interface LineageSearchProps {
  nodes: Node[];
  onNodeSelect: (nodeId: string, expandColumns?: boolean) => void;
  onClear: () => void;
}

export default function LineageSearch({ nodes, onNodeSelect, onClear }: LineageSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (searchTerm.trim()) {
      const results: SearchResult[] = [];
      const query = searchTerm.toLowerCase();

      nodes.forEach(node => {
        // Check if model name matches
        if (node.data.name.toLowerCase().includes(query) || 
            node.data.type.toLowerCase().includes(query)) {
          results.push({
            nodeId: node.id,
            nodeName: node.data.name,
            nodeType: node.data.type,
            matchType: 'model',
            upstreamCount: node.data.stats?.upstreamCount || 0,
            downstreamCount: node.data.stats?.downstreamCount || 0
          });
        }

        // Check if any column matches
        if (node.data.columns && Array.isArray(node.data.columns)) {
          node.data.columns.forEach((column: any) => {
            if (column.name.toLowerCase().includes(query)) {
              results.push({
                nodeId: node.id,
                nodeName: node.data.name,
                nodeType: node.data.type,
                matchType: 'column',
                matchedColumn: column.name,
                upstreamCount: node.data.stats?.upstreamCount || 0,
                downstreamCount: node.data.stats?.downstreamCount || 0
              });
            }
          });
        }
      });

      // Sort: models first, then columns
      results.sort((a, b) => {
        if (a.matchType === 'model' && b.matchType === 'column') return -1;
        if (a.matchType === 'column' && b.matchType === 'model') return 1;
        return a.nodeName.localeCompare(b.nodeName);
      });

      setSearchResults(results);
      setShowResults(true);
    } else {
      setSearchResults([]);
      setShowResults(false);
    }
  }, [searchTerm, nodes]);

  const handleSelect = (result: SearchResult) => {
    // If column match, expand the model automatically
    onNodeSelect(result.nodeId, result.matchType === 'column');
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
          placeholder="Search models or columns..."
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
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 max-h-96 overflow-y-auto">
            {searchResults.length > 0 ? (
              <>
                {/* Group by match type */}
                {searchResults.filter(r => r.matchType === 'model').length > 0 && (
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                      <Database className="w-3 h-3" />
                      Models ({searchResults.filter(r => r.matchType === 'model').length})
                    </div>
                  </div>
                )}
                {searchResults.filter(r => r.matchType === 'model').map((result, idx) => (
                  <button
                    key={`model-${result.nodeId}-${idx}`}
                    onClick={() => handleSelect(result)}
                    className="w-full px-4 py-2.5 text-left hover:bg-blue-50 flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">
                        {result.nodeName}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{result.nodeType}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      ↑{result.upstreamCount} ↓{result.downstreamCount}
                    </div>
                  </button>
                ))}

                {searchResults.filter(r => r.matchType === 'column').length > 0 && (
                  <div className="px-3 py-1.5 bg-gray-50 border-t border-b border-gray-200">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                      <Columns className="w-3 h-3" />
                      Columns ({searchResults.filter(r => r.matchType === 'column').length})
                    </div>
                  </div>
                )}
                {searchResults.filter(r => r.matchType === 'column').map((result, idx) => (
                  <button
                    key={`column-${result.nodeId}-${result.matchedColumn}-${idx}`}
                    onClick={() => handleSelect(result)}
                    className="w-full px-4 py-2.5 text-left hover:bg-green-50 flex items-center justify-between group"
                  >
                    <div className="flex-1">
                      <div className="text-xs text-gray-600 mb-1">
                        {result.nodeName}
                      </div>
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-green-700 flex items-center gap-1.5">
                        <Columns className="w-3.5 h-3.5" />
                        {result.matchedColumn}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      in {result.nodeType}
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No models or columns found
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
