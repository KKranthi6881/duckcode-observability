import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Database, 
  GitBranch, 
  FileText, 
  BarChart3, 
  Network, 
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';

interface ProcessingStats {
  totalFiles: number;
  processedFiles: number;
  documentationProcessed: number;
  vectorsGenerated: number;
  lineageExtracted: number;
  dependenciesResolved: number;
  errors: number;
}

interface DependencyAnalysis {
  columnDependencies: number;
  crossFileRelationships: number;
  circularDependencies: string[];
  repositoryHealth: {
    score: number;
    grade: string;
    factors: string[];
  };
}

interface MetadataItem {
  id: string;
  name: string;
  type: 'file' | 'asset' | 'column' | 'function';
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  dependencies?: number;
  impactLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export const MetadataProcessingDashboard: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('idle');
  const [stats, setStats] = useState<ProcessingStats>({
    totalFiles: 0,
    processedFiles: 0,
    documentationProcessed: 0,
    vectorsGenerated: 0,
    lineageExtracted: 0,
    dependenciesResolved: 0,
    errors: 0
  });
  const [dependencyAnalysis, setDependencyAnalysis] = useState<DependencyAnalysis | null>(null);
  const [metadataItems, setMetadataItems] = useState<MetadataItem[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<string>('');

  // Simulated processing phases
  const processingPhases = [
    { id: 'discovery', name: 'File Discovery', icon: FileText, description: 'Scanning repository for eligible files' },
    { id: 'documentation', name: 'Documentation Analysis', icon: Database, description: 'Extracting business logic and technical details' },
    { id: 'vectors', name: 'Vector Generation', icon: BarChart3, description: 'Creating searchable embeddings' },
    { id: 'lineage', name: 'Lineage Extraction', icon: GitBranch, description: 'Mapping data relationships' },
    { id: 'dependencies', name: 'Dependency Resolution', icon: Network, description: 'Building comprehensive dependency graph' },
    { id: 'analysis', name: 'Impact Analysis', icon: TrendingUp, description: 'Generating insights and recommendations' }
  ];

  const startProcessing = async () => {
    setIsProcessing(true);
    setCurrentPhase('discovery');
    
    try {
      // Phase 1: File Discovery
      await simulatePhase('discovery', async () => {
        const response = await fetch('/api/repositories/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: selectedRepository })
        });
        const data = await response.json();
        setStats(prev => ({ ...prev, totalFiles: data.totalFiles }));
      });

      // Phase 2: Documentation Analysis (Phase 2A)
      setCurrentPhase('documentation');
      await simulatePhase('documentation', async () => {
        for (let i = 0; i < stats.totalFiles; i++) {
          // Process files in batches
          await new Promise(resolve => setTimeout(resolve, 100));
          setStats(prev => ({ 
            ...prev, 
            processedFiles: i + 1,
            documentationProcessed: i + 1 
          }));
        }
      });

      // Phase 3: Vector Generation
      setCurrentPhase('vectors');
      await simulatePhase('vectors', async () => {
        const response = await fetch('/api/vectors/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: selectedRepository })
        });
        const data = await response.json();
        setStats(prev => ({ ...prev, vectorsGenerated: data.vectorsGenerated }));
      });

      // Phase 4: Lineage Extraction (Phase 2B)
      setCurrentPhase('lineage');
      await simulatePhase('lineage', async () => {
        const response = await fetch('/api/lineage/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: selectedRepository })
        });
        const data = await response.json();
        setStats(prev => ({ ...prev, lineageExtracted: data.lineageRelationships }));
      });

      // Phase 5: Dependency Resolution (Phase 2D - NEW!)
      setCurrentPhase('dependencies');
      await simulatePhase('dependencies', async () => {
        const response = await fetch('/api/dependencies/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repositoryId: selectedRepository })
        });
        const data = await response.json();
        setStats(prev => ({ ...prev, dependenciesResolved: data.dependenciesResolved }));
        setDependencyAnalysis(data.analysis);
      });

      // Phase 6: Impact Analysis
      setCurrentPhase('analysis');
      await simulatePhase('analysis', async () => {
        const response = await fetch(`/api/repositories/${selectedRepository}/metadata`);
        const data = await response.json();
        setMetadataItems(data.items);
      });

      setCurrentPhase('completed');
    } catch (error) {
      console.error('Processing error:', error);
      setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
    } finally {
      setIsProcessing(false);
    }
  };

  const simulatePhase = async (phase: string, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      console.error(`Error in phase ${phase}:`, error);
      setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
    }
  };

  const analyzeColumnImpact = async (columnId: string) => {
    try {
      const response = await fetch('/api/impact/column', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectId: columnId,
          changeType: 'modification',
          maxDepth: 10
        })
      });
      const data = await response.json();
      
      // Show impact analysis results
      console.log('Column Impact Analysis:', data);
      // You can show this in a modal or separate component
    } catch (error) {
      console.error('Error analyzing column impact:', error);
    }
  };

  const analyzeFileImpact = async (fileId: string) => {
    try {
      const response = await fetch('/api/impact/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectId: fileId,
          changeType: 'modification',
          maxDepth: 10
        })
      });
      const data = await response.json();
      
      // Show impact analysis results
      console.log('File Impact Analysis:', data);
    } catch (error) {
      console.error('Error analyzing file impact:', error);
    }
  };

  const getPhaseProgress = () => {
    const phaseIndex = processingPhases.findIndex(p => p.id === currentPhase);
    if (phaseIndex === -1) return 0;
    return ((phaseIndex + 1) / processingPhases.length) * 100;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getImpactBadge = (level?: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800'
    };
    return level ? (
      <Badge className={colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {level}
      </Badge>
    ) : null;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Metadata Processing Dashboard</h1>
          <p className="text-gray-600">Complete end-to-end metadata extraction and dependency analysis</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={startProcessing}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Processing
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Processing Progress */}
      {isProcessing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Processing Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={getPhaseProgress()} className="w-full" />
              <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                {processingPhases.map((phase, index) => {
                  const Icon = phase.icon;
                  const isActive = phase.id === currentPhase;
                  const isCompleted = processingPhases.findIndex(p => p.id === currentPhase) > index;
                  
                  return (
                    <div
                      key={phase.id}
                      className={`text-center p-3 rounded-lg border ${
                        isActive
                          ? 'border-blue-500 bg-blue-50'
                          : isCompleted
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <Icon className={`h-6 w-6 mx-auto mb-2 ${
                        isActive
                          ? 'text-blue-500'
                          : isCompleted
                          ? 'text-green-500'
                          : 'text-gray-400'
                      }`} />
                      <p className="text-sm font-medium">{phase.name}</p>
                      <p className="text-xs text-gray-500">{phase.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.totalFiles}</div>
            <p className="text-sm text-gray-600">Total Files</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.documentationProcessed}</div>
            <p className="text-sm text-gray-600">Documentation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.vectorsGenerated}</div>
            <p className="text-sm text-gray-600">Vectors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.lineageExtracted}</div>
            <p className="text-sm text-gray-600">Lineage</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.dependenciesResolved}</div>
            <p className="text-sm text-gray-600">Dependencies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-indigo-600">
              {dependencyAnalysis?.columnDependencies || 0}
            </div>
            <p className="text-sm text-gray-600">Column Deps</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
            <p className="text-sm text-gray-600">Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Repository Health */}
      {dependencyAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Repository Health Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className={`text-4xl font-bold ${
                  dependencyAnalysis.repositoryHealth.grade === 'A' ? 'text-green-600' :
                  dependencyAnalysis.repositoryHealth.grade === 'B' ? 'text-blue-600' :
                  dependencyAnalysis.repositoryHealth.grade === 'C' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {dependencyAnalysis.repositoryHealth.grade}
                </div>
                <p className="text-sm text-gray-600">Health Grade</p>
                <p className="text-xs text-gray-500">Score: {dependencyAnalysis.repositoryHealth.score}/100</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {dependencyAnalysis.columnDependencies}
                </div>
                <p className="text-sm text-gray-600">Column Dependencies</p>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${
                  dependencyAnalysis.circularDependencies.length > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {dependencyAnalysis.circularDependencies.length}
                </div>
                <p className="text-sm text-gray-600">Circular Dependencies</p>
              </div>
            </div>
            {dependencyAnalysis.circularDependencies.length > 0 && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Circular dependencies detected: {dependencyAnalysis.circularDependencies.join(', ')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed Results */}
      <Tabs defaultValue="metadata" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metadata">Metadata Items</TabsTrigger>
          <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
          <TabsTrigger value="search">Search & Query</TabsTrigger>
        </TabsList>

        <TabsContent value="metadata" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Extracted Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metadataItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(item.status)}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.type} • {item.language}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getImpactBadge(item.impactLevel)}
                      {item.dependencies && (
                        <Badge variant="outline">{item.dependencies} deps</Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => 
                          item.type === 'column' 
                            ? analyzeColumnImpact(item.id)
                            : analyzeFileImpact(item.id)
                        }
                      >
                        Analyze Impact
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dependencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dependency Network</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Network className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Dependency visualization will be rendered here</p>
                <p className="text-sm text-gray-500">
                  Column-level and file-level dependency graphs
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="impact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Impact Analysis Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button className="h-20 flex flex-col items-center gap-2">
                  <Database className="h-6 w-6" />
                  <span>Column Impact Analysis</span>
                  <span className="text-xs text-gray-500">
                    "If I change this column, what's affected?"
                  </span>
                </Button>
                <Button className="h-20 flex flex-col items-center gap-2">
                  <FileText className="h-6 w-6" />
                  <span>File Impact Analysis</span>
                  <span className="text-xs text-gray-500">
                    "If I modify this file, what dependencies break?"
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Dependency Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search for dependencies (e.g., customer_id, orders_table)..."
                    className="flex-1 px-3 py-2 border rounded-md"
                  />
                  <Button>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-gray-600">
                  <p>Search examples:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><code>customer_id</code> - Find all columns named customer_id</li>
                    <li><code>orders</code> - Find all assets related to orders</li>
                    <li><code>*.sql</code> - Find all SQL files</li>
                    <li><code>dbt_utils</code> - Find all dbt utility functions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};