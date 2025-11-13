import { useState, useEffect } from 'react';
import { Search, Network, Sparkles, Database, Table2, Columns, Tag, FileCode, TrendingUp, TrendingDown, Loader2, FileText, XCircle, ChevronRight, ChevronLeft, Info } from 'lucide-react';
import FocusedLineageView from '../../components/lineage/FocusedLineageView';
import { DocumentationViewer } from '../admin/components/DocumentationViewer';
import { aiDocumentationService, Documentation } from '../../services/aiDocumentationService';
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
  hasDocumentation?: boolean;
}

interface MetadataColumn {
  name: string;
  data_type: string;
  is_nullable: boolean;
  position: number;
}

export function DataLineage() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'models' | 'columns' | 'tables'>('all');
  const [viewingDoc, setViewingDoc] = useState<{ doc: Documentation; objectName: string; objectId: string; organizationId: string } | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [organizationId, setOrganizationId] = useState<string>('');
  const [organizationName, setOrganizationName] = useState<string>('');
  
  // Metadata panel state
  const [showMetadata, setShowMetadata] = useState(true);
  const [metadataColumns, setMetadataColumns] = useState<MetadataColumn[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [selectedModelInfo, setSelectedModelInfo] = useState<{
    name: string;
    type: string;
    schema?: string;
    source?: string;
  } | null>(null);

  // Fetch organization ID and name
  useEffect(() => {
    const fetchOrgData = async () => {
      try {
        console.log('[DataLineage] Fetching organization data...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[DataLineage] Session:', session?.user?.id);
        
        if (!session?.user?.id) {
          console.log('[DataLineage] ⚠️ No session found');
          return;
        }

        const { data, error } = await supabase
          .schema('enterprise')
          .from('user_organization_roles')
          .select(`
            organization_id,
            organizations!inner(
              display_name
            )
          `)
          .eq('user_id', session.user.id)
          .single();

        console.log('[DataLineage] Org query result:', { data, error });

        if (!error && data) {
          setOrganizationId(data.organization_id);
          // Handle organizations as array (Supabase returns it this way sometimes)
          const orgData: { display_name: string } | { display_name: string }[] | null = data.organizations as { display_name: string } | { display_name: string }[] | null;
          const orgName = orgData ? (Array.isArray(orgData) ? orgData[0]?.display_name : orgData?.display_name) || 'Your Organization' : 'Your Organization';
          setOrganizationName(orgName);
          console.log('[DataLineage] ✅ Organization set:', data.organization_id, orgName);
        } else {
          console.log('[DataLineage] ⚠️ No organization found or error:', error);
        }
      } catch (error) {
        console.error('[DataLineage] Error fetching organization:', error);
      }
    };
    fetchOrgData();
  }, []);

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

  // Fetch metadata columns when a model is selected
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!selectedModel) {
        setMetadataColumns([]);
        setSelectedModelInfo(null);
        return;
      }

      try {
        setMetadataLoading(true);
        
        // Fetch object info
        const { data: objectInfo } = await supabase
          .schema('metadata')
          .from('objects')
          .select('name, object_type, schema_name, source_type')
          .eq('id', selectedModel)
          .single();

        if (objectInfo) {
          setSelectedModelInfo({
            name: objectInfo.name,
            type: objectInfo.object_type,
            schema: objectInfo.schema_name,
            source: objectInfo.source_type
          });
        }
        
        // Fetch columns for the selected model
        const { data: columns, error } = await supabase
          .schema('metadata')
          .from('columns')
          .select('name, data_type, is_nullable, position')
          .eq('object_id', selectedModel)
          .order('position', { ascending: true });

        if (error) {
          console.error('Error fetching metadata columns:', error);
          setMetadataColumns([]);
        } else {
          setMetadataColumns(columns || []);
        }
      } catch (error) {
        console.error('Error fetching metadata:', error);
        setMetadataColumns([]);
      } finally {
        setMetadataLoading(false);
      }
    };

    fetchMetadata();
  }, [selectedModel]);

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

      // Check which objects have documentation
      console.log('[DataLineage] Checking documentation for', results.length, 'results, orgId:', organizationId);
      if (organizationId && results.length > 0) {
        const objectIds = results.map(r => r.id);
        console.log('[DataLineage] Object IDs:', objectIds);
        
        const { data: docs, error: docsError } = await supabase
          .schema('metadata')
          .from('object_documentation')
          .select('object_id')
          .eq('organization_id', organizationId)
          .eq('is_current', true)
          .in('object_id', objectIds);
        
        console.log('[DataLineage] Documentation check result:', { docs, docsError, count: docs?.length });
        
        const documentedIds = new Set(docs?.map(d => d.object_id) || []);
        console.log('[DataLineage] Documented IDs:', Array.from(documentedIds));
        
        results.forEach(r => {
          r.hasDocumentation = documentedIds.has(r.id);
          if (r.hasDocumentation) {
            console.log('[DataLineage] ✅ Has documentation:', r.name, r.id);
          }
        });
      } else {
        console.log('[DataLineage] ⚠️ Skipping documentation check - orgId:', organizationId, 'results:', results.length);
      }

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
            const parentObj = col.objects as { name: string } | undefined;
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

        // Check which objects have documentation (for fallback results)
        console.log('[DataLineage] [FALLBACK] Checking documentation for', results.length, 'results, orgId:', organizationId);
        if (organizationId && results.length > 0) {
          const objectIds = results.map(r => r.id);
          console.log('[DataLineage] [FALLBACK] Object IDs:', objectIds);
          
          const { data: docs, error: docsError } = await supabase
            .schema('metadata')
            .from('object_documentation')
            .select('object_id')
            .eq('organization_id', organizationId)
            .eq('is_current', true)
            .in('object_id', objectIds);
          
          console.log('[DataLineage] [FALLBACK] Documentation check result:', { docs, docsError, count: docs?.length });
          
          const documentedIds = new Set(docs?.map(d => d.object_id) || []);
          console.log('[DataLineage] [FALLBACK] Documented IDs:', Array.from(documentedIds));
          
          results.forEach(r => {
            r.hasDocumentation = documentedIds.has(r.id);
            if (r.hasDocumentation) {
              console.log('[DataLineage] [FALLBACK] ✅ Has documentation:', r.name, r.id);
            }
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

  const handleViewDocumentation = async (objectId: string, objectName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering lineage view
    
    try {
      setLoadingDoc(true);
      const doc = await aiDocumentationService.getObjectDocumentation(objectId);
      
      setViewingDoc({
        doc,
        objectName,
        objectId,
        organizationId
      });
    } catch (error: any) {
      alert(`Failed to load documentation: ${error.message}`);
    } finally {
      setLoadingDoc(false);
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
        
        // Query the object to get repository_id and source_type
        const { data: objectData, error: objError } = await supabase
          .schema('metadata')
          .from('objects')
          .select('repository_id, source_type')
          .eq('id', result.id)
          .single();

        if (objError) {
          console.error('Failed to get object data:', objError);
          alert('Could not find object metadata');
          setSelectedModel(null);
          return;
        }

        console.log('Object data:', objectData);

        // For Snowflake/connector objects, connection_id is optional
        if (objectData.source_type === 'snowflake' || !objectData.repository_id) {
          console.log('Snowflake object detected - showing lineage without connection_id');
          setConnectionId(null); // Lineage will work without connection_id
          // Continue to show lineage
        } else {
          // For GitHub/dbt objects, get connection_id from repository
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
        }
        
      } catch (error) {
        console.error('Error fetching connection:', error);
        alert('Error loading lineage. Check console for details.');
        setSelectedModel(null);
      }
    } else if (result.type === 'column') {
      // For columns, we need to find the parent model and show its lineage
      try {
        console.log('Column clicked:', result.name, 'Parent:', result.parentModel, 'ObjectId:', result.filePath);
        
        // Get the object_id (stored in filePath temporarily)
        const objectId = result.filePath;
        
        if (!objectId) {
          console.error('No object_id found for column');
          alert('Could not find parent model for this column');
          return;
        }
        
        // Query to get the parent object's repository_id
        // Don't filter by organization_id here since the object_id is already unique
        const { data: parentObject, error: parentError } = await supabase
          .schema('metadata')
          .from('objects')
          .select('id, repository_id, organization_id, source_type')
          .eq('id', objectId)
          .single();

        if (parentError || !parentObject) {
          console.error('Failed to find parent model:', parentError, 'ObjectId:', objectId);
          alert(`Could not find parent model for this column. Object ID: ${objectId}`);
          return;
        }

        console.log('Parent model found:', parentObject.id, 'repository_id:', parentObject.repository_id, 'source_type:', parentObject.source_type);

        // Check if this is a Snowflake object (no repository_id or source_type is snowflake)
        if (!parentObject.repository_id || parentObject.source_type === 'snowflake') {
          console.log('Snowflake column detected - showing lineage without connection_id');
          setSelectedModel(parentObject.id);
          setConnectionId(null);
          return; // Important: Stop here for Snowflake objects
        }
        
        // Get connection_id from repository for GitHub objects
        console.log('GitHub object detected - fetching connection_id from repository:', parentObject.repository_id);
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
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* AI-Style Central Search - Always visible */}
      <div className={`flex-shrink-0 flex items-center justify-center px-6 transition-all duration-300 ${
        selectedModel ? 'py-4' : 'py-12'
      }`}>
        <div className="w-full max-w-4xl">
          {/* Header - Only show when no lineage */}
          {!selectedModel && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="p-3 bg-purple-600/20 border border-purple-600/30 rounded-2xl">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
            </div>
            {organizationName && (
              <p className="text-lg text-muted-foreground mb-3">Welcome to {organizationName}</p>
            )}
            <h1 className="text-4xl font-bold text-foreground mb-2">Code Intelligence</h1>
            <p className="text-lg text-muted-foreground">Search, explore lineage, and discover insights across your data platform</p>
          </div>
          )}

          {/* Search Box - Always visible */}
          <div className="relative mb-6">
            <div className="absolute left-6 top-1/2 transform -translate-y-1/2 flex items-center gap-3">
              <Search className="w-6 h-6 text-muted-foreground" />
              {isSearching && <Loader2 className="w-5 h-5 text-[#ff6a3c] animate-spin" />}
            </div>
            <input
              type="text"
              placeholder="Ask anything... (e.g., 'customer_id column', 'stg_orders model', 'GOLD tier tables')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-20 pr-6 py-6 text-lg bg-card border-2 border-border text-foreground rounded-2xl focus:ring-4 focus:ring-[#ff6a3c]/20 focus:border-[#ff6a3c] transition-all placeholder:text-muted-foreground"
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
                    ? 'bg-[#ff6a3c] text-white'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          )}

          {/* Search Results - Show always when there are results */}
          {searchResults.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-4 bg-muted border-b border-border">
                <p className="text-sm font-medium text-muted-foreground">
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
                      className="w-full p-4 hover:bg-muted transition-colors border-b border-border last:border-b-0 text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="p-2 bg-purple-600/20 border border-purple-600/30 rounded-lg flex-shrink-0">
                          <Icon className="w-5 h-5 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-foreground">{result.name}</h3>
                            <span className="text-xs px-2 py-0.5 bg-muted border border-border text-muted-foreground rounded-full">
                              {result.type}
                            </span>
                            {result.tier && (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                result.tier === 'GOLD' ? 'bg-yellow-600/20 border border-yellow-600/30 text-yellow-400' :
                                result.tier === 'SILVER' ? 'bg-gray-600/20 border border-gray-600/30 text-gray-400' :
                                'bg-orange-600/20 border border-orange-600/30 text-orange-400'
                              }`}>
                                {result.tier}
                              </span>
                            )}
                          </div>
                          {result.description && (
                            <p className="text-sm text-muted-foreground mb-2">{result.description}</p>
                          )}
                          {result.parentModel && (
                            <p className="text-xs text-muted-foreground">in {result.parentModel}</p>
                          )}
                          {result.filePath && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">{result.filePath}</p>
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
                        {/* View Documentation Button */}
                        {result.hasDocumentation && (
                          <button
                            onClick={(e) => handleViewDocumentation(result.id, result.name, e)}
                            className="flex-shrink-0 p-2 hover:bg-purple-600/20 rounded-lg transition-colors group"
                            title="View AI Documentation"
                          >
                            <FileText className="w-5 h-5 text-purple-400 group-hover:text-purple-300" />
                          </button>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty State */}
          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-12 bg-card border border-border rounded-2xl">
              <Network className="w-16 h-16 mx-auto mb-4 text-border" />
              <p className="text-foreground">No results found for "{searchQuery}"</p>
              <p className="text-sm text-muted-foreground mt-2">Try searching for models, columns, or tables</p>
            </div>
          )}
        </div>
      </div>

      {/* Lineage View with Metadata Panel */}
      {selectedModel && (
        <div className="flex-1 overflow-hidden px-6 pb-6 relative">
          {/* Main Lineage View - Fixed Full Width */}
          <div className="h-full w-full">
            <div className="h-full bg-card border border-border rounded-2xl overflow-hidden">
              <FocusedLineageView 
                connectionId={connectionId || 'unified'}
                initialModelId={selectedModel}
                hideHeader={false}
                useUnifiedApi={!connectionId}
                organizationId={organizationId}
                onNodeClick={(nodeId, nodeName) => {
                  console.log('[DataLineage] Node clicked in graph:', nodeId, nodeName);
                  // Update the metadata panel to show clicked model's details
                  setSelectedModel(nodeId);
                }}
              />
            </div>
          </div>

          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="absolute top-1/2 -translate-y-1/2 z-30 bg-card border-2 border-border rounded-lg p-2 hover:bg-muted hover:border-[#ff6a3c]/50 transition-all shadow-lg"
            style={{
              right: showMetadata ? '400px' : '0px',
              transition: 'right 0.3s ease'
            }}
            title={showMetadata ? "Hide details" : "Show details"}
          >
            {showMetadata ? (
              <ChevronRight className="w-4 h-4 text-foreground" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-foreground" />
            )}
          </button>

          {/* Metadata Side Panel - Slides in from right */}
          <div 
            className="absolute top-0 h-full w-96 bg-card border border-border rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-transform duration-300 ease-in-out z-20"
            style={{
              right: showMetadata ? '0' : '-384px',
              transform: showMetadata ? 'translateX(0)' : 'translateX(0)'
            }}
          >
              {/* Panel Header */}
              <div className="px-5 py-4 bg-muted border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-5 h-5 text-[#ff6a3c]"/>
                  <span className="font-bold text-foreground">Table Details</span>
                </div>
                <p className="text-xs text-muted-foreground">Schema and column information</p>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Model Info Section */}
                {selectedModelInfo && (
                  <div className="mb-5 p-4 bg-muted border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="w-5 h-5 text-blue-400" />
                      <span className="text-sm font-bold text-muted-foreground uppercase">Model Info</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Name</div>
                        <div className="font-mono text-sm text-foreground font-semibold">{selectedModelInfo.name}</div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-1">Type</div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            selectedModelInfo.type === 'table' 
                              ? 'bg-blue-600/20 border border-blue-600/30 text-blue-400'
                              : 'bg-purple-600/20 border border-purple-600/30 text-purple-400'
                          }`}>
                            {selectedModelInfo.type}
                          </span>
                        </div>
                        {selectedModelInfo.source && (
                          <div className="flex-1">
                            <div className="text-xs text-muted-foreground mb-1">Source</div>
                            <span className="px-2 py-1 bg-cyan-600/20 border border-cyan-600/30 text-cyan-400 rounded-full text-xs font-semibold">
                              {selectedModelInfo.source}
                            </span>
                          </div>
                        )}
                      </div>
                      {selectedModelInfo.schema && (
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Schema</div>
                          <div className="text-sm text-foreground">{selectedModelInfo.schema}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Columns Section */}
                {metadataLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-[#ff6a3c]" />
                  </div>
                ) : metadataColumns.length > 0 ? (
                  <div className="space-y-2">
                    {/* Columns Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <Columns className="w-5 h-5 text-purple-400" />
                      <span className="text-sm font-bold text-muted-foreground uppercase">Columns</span>
                      <span className="ml-auto px-2 py-1 bg-muted border border-border rounded-full text-xs font-bold text-foreground">
                        {metadataColumns.length}
                      </span>
                    </div>

                    {/* Columns List */}
                    {metadataColumns.map((col, idx) => (
                      <div 
                        key={idx}
                        className="p-3 bg-muted border border-border rounded-lg hover:border-[#ff6a3c]/50 transition-all"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-yellow-400 mt-0.5">🔑</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-sm text-foreground font-semibold truncate">
                              {col.name}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1.5 ml-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Type:</span>
                            <span className="px-2 py-0.5 bg-muted border border-border rounded text-cyan-400 font-mono text-xs">
                              {col.data_type || 'unknown'}
                            </span>
                          </div>
                          {col.is_nullable !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Nullable:</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                col.is_nullable
                                  ? 'bg-yellow-600/20 border border-yellow-600/30 text-yellow-400'
                                  : 'bg-green-600/20 border border-green-600/30 text-green-400'
                              }`}>
                                {col.is_nullable ? 'NULL' : 'NOT NULL'}
                              </span>
                            </div>
                          )}
                          {col.position !== undefined && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Position:</span>
                              <span className="text-xs text-foreground">{col.position}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : selectedModelInfo ? (
                  <div className="flex flex-col items-center justify-center h-32 text-[#8d857b]">
                    <Columns className="w-10 h-10 mb-2 opacity-50" />
                    <p className="text-sm">No columns found</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-[#8d857b]">
                    <Database className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-sm text-center">Select a table to view<br/>details</p>
                  </div>
                )}
              </div>
          </div>
        </div>
      )}

      {/* Documentation Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 bg-modal-overlay/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-muted border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-semibold text-white">{viewingDoc.objectName}</h2>
                <span className="text-xs px-2 py-1 bg-purple-600/20 border border-purple-600/30 text-purple-400 rounded-full font-medium">
                  AI Documentation
                </span>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-2 hover:bg-[#2d2a27] rounded-lg transition-colors"
                aria-label="Close"
              >
                <XCircle className="h-5 w-5 text-[#8d857b]" />
              </button>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDoc ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : (
                <DocumentationViewer
                  documentation={viewingDoc.doc}
                  objectName={viewingDoc.objectName}
                  objectId={viewingDoc.objectId}
                  organizationId={viewingDoc.organizationId}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
