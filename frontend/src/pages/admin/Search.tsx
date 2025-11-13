import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SearchBar } from '@/components/search/SearchBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, RefreshCw, BarChart3, Database } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../../config/supabaseClient';

interface ObjectDetails {
  id: string;
  name: string;
  full_name?: string;
  description?: string;
  object_type: string;
  definition?: string;
  files?: { relative_path: string };
  repositories?: { name: string };
}

export const SearchPage: React.FC = () => {
  const [objectDetails, setObjectDetails] = useState<ObjectDetails | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexStats, setIndexStats] = useState<{ num_docs: number; size_bytes: number } | null>(null);

  // Use backend URL instead of calling Tantivy directly
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Get organization ID from user session
  const getOrganizationId = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data: userProfile } = await supabase
      .schema('duckcode')
      .from('user_profiles')
      .select('organization_id')
      .eq('id', session.user.id)
      .single();

    if (!userProfile?.organization_id) {
      throw new Error('No organization found');
    }

    return userProfile.organization_id;
  };

  // Trigger re-indexing
  const handleReindex = async () => {
    setIsIndexing(true);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      
      const response = await axios.post(`${API_URL}/api/search/rebuild-index`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      alert(`Successfully indexed ${response.data.objects_indexed} objects`);
      await fetchIndexStats();
    } catch (error) {
      console.error('Indexing failed:', error);
      alert('Failed to trigger indexing. Check console for details.');
    } finally {
      setIsIndexing(false);
    }
  };

  // Fetch index statistics
  const fetchIndexStats = async () => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        console.error('No auth token available');
        return;
      }
      
      // Backend doesn't expose stats endpoint yet - commenting out for now
      // const response = await axios.get(`${API_URL}/api/search/stats`, {
      //   headers: {
      //     'Authorization': `Bearer ${token}`
      //   }
      // });
      // setIndexStats(response.data);
      console.log('Stats endpoint not yet implemented in backend');
    } catch (error) {
      console.error('Failed to fetch index stats:', error);
    }
  };

  // Load object details when selected
  const handleSelectObject = async (objectId: string) => {
    
    try {
      const { data, error } = await supabase
        .schema('metadata')
        .from('objects')
        .select('*, files(*), repositories(*)')
        .eq('id', objectId)
        .single();

      if (error) throw error;
      setObjectDetails(data);
    } catch (error) {
      console.error('Failed to load object details:', error);
    }
  };

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  React.useEffect(() => {
    fetchIndexStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [organizationId, setOrganizationId] = useState<string>('');

  React.useEffect(() => {
    getOrganizationId().then(setOrganizationId).catch(console.error);
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="w-8 h-8" />
            Metadata Search
          </h1>
          <p className="text-muted-foreground mt-1">
            Powered by Tantivy - Sub-100ms full-text search
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchIndexStats}
            size="sm"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Stats
          </Button>
          <Button
            onClick={handleReindex}
            disabled={isIndexing}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isIndexing ? 'animate-spin' : ''}`} />
            Re-index
          </Button>
        </div>
      </div>

      {/* Index Stats */}
      {indexStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4" />
                Indexed Objects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{indexStats.num_docs.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Tables, views, models</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Index Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(indexStats.size_bytes)}</div>
              <p className="text-xs text-muted-foreground">On-disk storage</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">&lt; 100ms</div>
              <p className="text-xs text-muted-foreground">Average query time</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          {organizationId && (
            <SearchBar
              organizationId={organizationId}
              onSelectObject={handleSelectObject}
            />
          )}
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <span>💡 Press <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono">Cmd+K</kbd> to focus search</span>
            <span>• Type 2+ characters to search</span>
            <span>• Fuzzy matching enabled</span>
          </div>
        </CardContent>
      </Card>

      {/* Object Details */}
      {objectDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Object Details: {objectDetails.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value="overview" onValueChange={() => {}}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="definition">Definition</TabsTrigger>
                <TabsTrigger value="lineage">Lineage</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">Type</h4>
                    <p className="text-sm mt-1">{objectDetails.object_type}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">Full Name</h4>
                    <p className="text-sm mt-1">{objectDetails.full_name || objectDetails.name}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">Repository</h4>
                    <p className="text-sm mt-1">{objectDetails.repositories?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500">File Path</h4>
                    <p className="text-sm mt-1">{objectDetails.files?.relative_path || 'N/A'}</p>
                  </div>
                </div>
                {objectDetails.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">Description</h4>
                    <p className="text-sm">{objectDetails.description}</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="definition">
                {objectDetails.definition ? (
                  <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                    <code>{objectDetails.definition}</code>
                  </pre>
                ) : (
                  <p className="text-sm text-gray-500">No definition available</p>
                )}
              </TabsContent>
              
              <TabsContent value="lineage">
                <p className="text-sm text-gray-500">Lineage visualization coming soon...</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Search Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Search Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-400">
            <li>• <strong>Fuzzy matching:</strong> "custmer" will match "customer"</li>
            <li>• <strong>Multi-word:</strong> "customer orders" searches all fields</li>
            <li>• <strong>Autocomplete:</strong> Start typing to see suggestions</li>
            <li>• <strong>Fast:</strong> Results typically return in &lt;50ms</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
