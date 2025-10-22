import { useState, useEffect } from 'react';
import { Search, Network, Sparkles, Database, Table2, Columns, Tag, FileCode, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import FocusedLineageView from '../../components/lineage/FocusedLineageView';
import { supabase } from '../../config/supabaseClient';

interface SearchResult {
  id: string;
  type: 'model' | 'column' | 'table' | 'tag';
  name: string;
  description?: string;
  filePath?: string;
  parentModel?: string;
  upstreamCount?: number;
  downstreamCount?: number;
  confidence?: number;
  tier?: string;
}

export function DataLineage() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionId, setConnectionId] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'models' | 'columns' | 'tables'>('all');

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchType]);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // TODO: Call Tantivy search API
      // For now, mock results
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'model',
          name: 'stg_customers',
          description: 'Staging table for customer data',
          filePath: 'models/staging/stg_customers.sql',
          upstreamCount: 1,
          downstreamCount: 3,
          confidence: 1.0,
          tier: 'GOLD'
        },
        {
          id: '2',
          type: 'column',
          name: 'customer_id',
          parentModel: 'stg_customers',
          description: 'Unique identifier for customers',
          upstreamCount: 1,
          downstreamCount: 5
        }
      ];

      setSearchResults(mockResults.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'model': return Database;
      case 'column': return Columns;
      case 'table': return Table2;
      case 'tag': return Tag;
      default: return FileCode;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'model') {
      setSelectedModel(result.id);
      // TODO: Set proper connectionId
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* AI-Style Central Search */}
      <div className="flex-shrink-0 flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Data Lineage Intelligence</h1>
            <p className="text-lg text-gray-600">Search models, columns, tables, and business terms</p>
          </div>

          {/* Search Box */}
          <div className="relative mb-6">
            <div className="absolute left-6 top-1/2 transform -translate-y-1/2 flex items-center gap-3">
              <Search className="w-6 h-6 text-gray-400" />
              {isSearching && <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />}
            </div>
            <input
              type="text"
              placeholder="Ask anything... (e.g., 'customer_id column', 'stg_orders model', 'GOLD tier tables')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-20 pr-6 py-6 text-lg border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-lg hover:shadow-xl bg-white"
            />
          </div>

          {/* Search Filters */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {(['all', 'models', 'columns', 'tables'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSearchType(type)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  searchType === type
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-600">
                  Found {searchResults.length} results
                </p>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {searchResults.map((result) => {
                  const Icon = getResultIcon(result.type);
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="w-full p-4 hover:bg-purple-50 transition-colors border-b border-gray-100 last:border-b-0 text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                          <Icon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{result.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                              {result.type}
                            </span>
                            {result.tier && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                result.tier === 'GOLD' ? 'bg-yellow-100 text-yellow-700' :
                                result.tier === 'SILVER' ? 'bg-gray-100 text-gray-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {result.tier}
                              </span>
                            )}
                          </div>
                          {result.description && (
                            <p className="text-sm text-gray-600 mb-2">{result.description}</p>
                          )}
                          {result.parentModel && (
                            <p className="text-xs text-gray-500">in {result.parentModel}</p>
                          )}
                          {result.filePath && (
                            <p className="text-xs text-gray-400 font-mono mt-1">{result.filePath}</p>
                          )}
                          {(result.upstreamCount !== undefined || result.downstreamCount !== undefined) && (
                            <div className="flex items-center gap-4 mt-2">
                              {result.upstreamCount !== undefined && (
                                <div className="flex items-center gap-1 text-xs text-blue-600">
                                  <TrendingUp className="w-3 h-3" />
                                  <span>{result.upstreamCount} upstream</span>
                                </div>
                              )}
                              {result.downstreamCount !== undefined && (
                                <div className="flex items-center gap-1 text-xs text-purple-600">
                                  <TrendingDown className="w-3 h-3" />
                                  <span>{result.downstreamCount} downstream</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
              <Network className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600">No results found for "{searchQuery}"</p>
              <p className="text-sm text-gray-400 mt-2">Try searching for models, columns, or tables</p>
            </div>
          )}
        </div>
      </div>

      {/* Lineage View */}
      {selectedModel && connectionId && (
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="h-full bg-white rounded-2xl shadow-xl overflow-hidden">
            <FocusedLineageView 
              connectionId={connectionId}
              hideHeader={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
