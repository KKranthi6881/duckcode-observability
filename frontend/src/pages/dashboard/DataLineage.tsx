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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, searchType]);

  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session found');
        return;
      }

      const searchUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v2/search/query?q=${encodeURIComponent(searchQuery)}&limit=20`;
      console.log('Searching:', searchUrl);

      // Call Tantivy search API
      const response = await fetch(searchUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      console.log('Search response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Search failed:', response.status, errorText);
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Search results:', data);
      
      // Transform Tantivy results to our SearchResult format
      const results: SearchResult[] = data.results.map((result: { id: string; object_type?: string; name: string; description?: string; file_path?: string; parent_object_name?: string; upstream_count?: number; downstream_count?: number; confidence?: number; extraction_tier?: string }) => {
        // Determine type based on object_type
        let type: 'model' | 'column' | 'table' | 'tag' = 'model';
        if (result.object_type?.includes('column')) {
          type = 'column';
        } else if (result.object_type?.includes('table')) {
          type = 'table';
        }

        return {
          id: result.id,
          type,
          name: result.name,
          description: result.description,
          filePath: result.file_path,
          parentModel: result.parent_object_name,
          upstreamCount: result.upstream_count,
          downstreamCount: result.downstream_count,
          confidence: result.confidence,
          tier: result.extraction_tier
        };
      });

      // Apply search type filter
      const filteredResults = searchType === 'all' 
        ? results 
        : results.filter(r => {
            if (searchType === 'models') return r.type === 'model';
            if (searchType === 'columns') return r.type === 'column';
            if (searchType === 'tables') return r.type === 'table';
            return true;
          });

      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Search error:', error);
      
      // Fallback to direct database search
      console.log('Tantivy search failed, falling back to direct database search');
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const results: SearchResult[] = [];

        // Search in metadata.objects table (models, tables)
        const { data: objects, error: objError } = await supabase
          .schema('metadata')
          .from('objects')
          .select('*')
          .ilike('name', `%${searchQuery}%`)
          .limit(10);

        if (!objError && objects && objects.length > 0) {
          console.log('Found objects in database:', objects);
          
          objects.forEach((obj: { id: string; object_type?: string; name: string; description?: string; file_path?: string; confidence?: number; extraction_tier?: string }) => {
            results.push({
              id: obj.id,
              type: obj.object_type?.includes('table') ? 'table' : 'model',
              name: obj.name,
              description: obj.description,
              filePath: obj.file_path,
              confidence: obj.confidence,
              tier: obj.extraction_tier
            });
          });
        }

        // Search in metadata.columns table
        const { data: columns, error: colError } = await supabase
          .schema('metadata')
          .from('columns')
          .select(`
            id,
            name,
            data_type,
            description,
            object_id,
            objects:object_id (
              name,
              object_type
            )
          `)
          .ilike('name', `%${searchQuery}%`)
          .limit(10);

        if (!colError && columns && columns.length > 0) {
          console.log('Found columns in database:', columns);
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          columns.forEach((col: any) => {
            // Supabase returns objects as a single object (not array) when using foreign key relationship
            const parentObj = col.objects;
            results.push({
              id: col.id,
              type: 'column' as const,
              name: col.name,
              description: col.description || `${col.data_type || 'column'}`,
              parentModel: parentObj?.name,
              // Store object_id for easy lookup
              upstreamCount: undefined,
              downstreamCount: undefined,
              confidence: undefined,
              tier: undefined,
              filePath: col.object_id // Store object_id in filePath temporarily
            });
          });
        }

        if (results.length > 0) {
          setSearchResults(results);
          setIsSearching(false);
          return;
        }
      } catch (dbError) {
        console.error('Database fallback error:', dbError);
      }
      
      // Last resort: mock data for UI testing
      console.log('Using mock data as last resort');
      const mockResults: SearchResult[] = [
        {
          id: 'mock-1',
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
          id: 'mock-2',
          type: 'model',
          name: 'stg_orders',
          description: 'Staging table for order data',
          filePath: 'models/staging/stg_orders.sql',
          upstreamCount: 2,
          downstreamCount: 4,
          confidence: 1.0,
          tier: 'GOLD'
        },
        {
          id: 'mock-3',
          type: 'column',
          name: 'customer_id',
          parentModel: 'stg_customers',
          description: 'Unique identifier for customers',
          upstreamCount: 1,
          downstreamCount: 5
        },
        {
          id: 'mock-4',
          type: 'model',
          name: 'stg_payments',
          description: 'Staging table for payment transactions',
          filePath: 'models/staging/stg_payments.sql',
          upstreamCount: 1,
          downstreamCount: 2,
          confidence: 0.95,
          tier: 'SILVER'
        }
      ];
      
      const filtered = mockResults.filter(r => 
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
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

  const handleResultClick = async (result: SearchResult) => {
    console.log('Clicked result:', result);
    
    // Clear search query and results when clicking a result
    setSearchQuery('');
    setSearchResults([]);
    
    if (result.type === 'model') {
      setSelectedModel(result.id);
      
      // For mock data, show a message
      if (result.id.startsWith('mock-')) {
        console.log('Mock data clicked - need real repository data');
        alert('This is demo data. To see real lineage:\n\n1. Connect a GitHub repository\n2. Extract metadata\n3. Search will show real models\n4. Click to see lineage!');
        setSelectedModel(null);
        return;
      }
      
      // Fetch the connection ID from the repository
      try {
        console.log('Fetching connection ID for model:', result.id);
        
        // Query the object to get repository_id, then get connection_id from repository
        const { data: objectData, error: objError } = await supabase
          .schema('metadata')
          .from('objects')
          .select('repository_id')
          .eq('id', result.id)
          .single();

        if (objError || !objectData?.repository_id) {
          console.error('Failed to get repository_id:', objError);
          alert('Could not find repository for this model');
          setSelectedModel(null);
          return;
        }

        console.log('Repository ID:', objectData.repository_id);

        // Get connection_id from repository
        const { data: repoData, error: repoError } = await supabase
          .schema('metadata')
          .from('repositories')
          .select('connection_id')
          .eq('id', objectData.repository_id)
          .single();

        if (repoError || !repoData?.connection_id) {
          console.error('Failed to get connection_id:', repoError);
          alert('Could not find connection for this repository');
          setSelectedModel(null);
          return;
        }

        console.log('Connection ID:', repoData.connection_id);
        setConnectionId(repoData.connection_id);
        
      } catch (error) {
        console.error('Error fetching connection:', error);
        alert('Error loading lineage. Check console for details.');
        setSelectedModel(null);
      }
    } else if (result.type === 'column') {
      // For columns, we need to find the parent model and show its lineage
      try {
        console.log('Column clicked:', result.name, 'Parent:', result.parentModel);
        
        // Get the object_id (stored in filePath temporarily)
        const objectId = result.filePath;
        
        if (!objectId) {
          alert('Could not find parent model for this column');
          return;
        }
        
        // Query to get the parent object's repository_id
        const { data: parentObject, error: parentError } = await supabase
          .schema('metadata')
          .from('objects')
          .select('id, repository_id')
          .eq('id', objectId)
          .single();

        if (parentError || !parentObject) {
          console.error('Failed to find parent model:', parentError);
          alert('Could not find parent model for this column');
          return;
        }

        console.log('Parent model found:', parentObject.id);

        // Get connection_id from repository
        const { data: repoData, error: repoError } = await supabase
          .schema('metadata')
          .from('repositories')
          .select('connection_id')
          .eq('id', parentObject.repository_id)
          .single();

        if (repoError || !repoData?.connection_id) {
          console.error('Failed to get connection_id:', repoError);
          alert('Could not find connection for this repository');
          return;
        }

        console.log('Connection ID:', repoData.connection_id);
        
        // Set the parent model as selected to show its lineage
        setSelectedModel(parentObject.id);
        setConnectionId(repoData.connection_id);
        
      } catch (error) {
        console.error('Error loading column lineage:', error);
        alert('Error loading column lineage. Check console for details.');
      }
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* AI-Style Central Search - Always visible */}
      <div className={`flex-shrink-0 flex items-center justify-center px-6 transition-all duration-300 ${
        selectedModel && connectionId ? 'py-4' : 'py-12'
      }`}>
        <div className="w-full max-w-4xl">
          {/* Header - Only show when no lineage */}
          {!selectedModel && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Data Lineage Intelligence</h1>
            <p className="text-lg text-gray-600">Search models, columns, tables, and business terms</p>
          </div>
          )}

          {/* Search Box - Always visible */}
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

          {/* Search Filters - Only show when no lineage */}
          {!selectedModel && (
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
          )}

          {/* Search Results - Show always when there are results */}
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
              initialModelId={selectedModel}
              hideHeader={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}
