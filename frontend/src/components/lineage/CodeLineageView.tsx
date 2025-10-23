import { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeTypes,
  MarkerType,
  BackgroundVariant,
  Position,
  useReactFlow,
  ReactFlowProvider
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { supabase } from '../../config/supabaseClient';
import { Loader2, AlertCircle, Database, Maximize2, EyeOff, Maximize, Minimize } from 'lucide-react';
import ModernModelNode from './ModernModelNode';
import ExpandNode from './ExpandNode';

interface CodeLineageViewProps {
  connectionId: string;
  fileName?: string;
  filePath?: string;
}

interface LineageNode {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

const nodeTypes: NodeTypes = {
  expandableModel: ModernModelNode,
  expandButton: ExpandNode,
};

const defaultEdgeOptions = {
  type: 'default' as const,
  markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
  style: { stroke: '#cbd5e1', strokeWidth: 2 }
};

// Layout with dagre - same as FocusedLineageView with better spacing
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ 
    rankdir: 'LR', 
    ranksep: 250,  // More horizontal space between levels
    nodesep: 100,  // More vertical space between nodes
    edgesep: 50    // Space between edges
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 320, height: 120 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Left;
    node.sourcePosition = Position.Right;
    node.position = {
      x: nodeWithPosition.x - 150,
      y: nodeWithPosition.y - 50,
    };
  });

  return { nodes, edges };
};

function CodeLineageViewContent({ connectionId, fileName, filePath }: CodeLineageViewProps) {
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Progressive loading state - Start with only 2 to keep it simple
  const [upstreamLimit, setUpstreamLimit] = useState(2);
  const [downstreamLimit, setDownstreamLimit] = useState(2);
  const [lineageMetadata, setLineageMetadata] = useState<any>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  
  // Highlighting state for better navigation
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredColumnPath, setHoveredColumnPath] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Handle node expansion
  const handleExpand = (nodeId: string) => {
    setNodes(nodes => 
      nodes.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, expanded: true } }
          : node
      )
    );
  };

  const handleCollapse = (nodeId: string) => {
    setNodes(nodes => 
      nodes.map(node => 
        node.id === nodeId 
          ? { ...node, data: { ...node.data, expanded: false } }
          : node
      )
    );
  };

  // Handle expanding upstream/downstream - Load 5 more at a time
  const handleExpandUpstream = useCallback(() => {
    console.log('[CodeLineage] Expanding upstream');
    setIsExpanding(true);
    setUpstreamLimit(prev => prev + 5);
  }, []);

  const handleExpandDownstream = useCallback(() => {
    console.log('[CodeLineage] Expanding downstream');
    setIsExpanding(true);
    setDownstreamLimit(prev => prev + 5);
  }, []);

  // Clear all highlighting and reset to normal view
  const clearHighlight = useCallback(() => {
    setSelectedNodeId(null);
    setHoveredColumnPath(null);
    
    // Reset all edges to default
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: false,
        style: {
          stroke: '#9ca3af',
          strokeWidth: 2,
          opacity: 1
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#9ca3af'
        }
      }))
    );
    
    // Reset all nodes to default
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        style: {
          ...node.style,
          opacity: 1,
          boxShadow: undefined
        }
      }))
    );
  }, [setEdges, setNodes]);

  // Fit view to see all nodes
  const fitToView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
  }, [reactFlowInstance]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!graphContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await graphContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  }, []);

  // Listen for fullscreen changes and update nodes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);
      
      // Update all nodes to use new tooltip container (for fullscreen tooltips)
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            tooltipContainer: graphContainerRef.current
          }
        }))
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [setNodes]);

  // Focus on a specific node with highlighting
  const focusNode = useCallback((nodeId: string) => {
    const node = reactFlowInstance.getNode(nodeId);
    if (node) {
      // Center on node with animation
      reactFlowInstance.setCenter(
        node.position.x + 150,
        node.position.y + 50,
        { zoom: 1.2, duration: 800 }
      );
      
      // Set as selected for highlighting
      setSelectedNodeId(nodeId);
      
      // Highlight this node and its direct connections
      const connectedEdges = new Set<string>();
      const connectedNodes = new Set<string>();
      connectedNodes.add(nodeId);
      
      setEdges((eds) => {
        eds.forEach((edge) => {
          if (edge.source === nodeId || edge.target === nodeId) {
            connectedEdges.add(edge.id);
            connectedNodes.add(edge.source);
            connectedNodes.add(edge.target);
          }
        });
        
        return eds.map((edge) => {
          const isConnected = connectedEdges.has(edge.id);
          return {
            ...edge,
            animated: isConnected,
            style: {
              ...edge.style,
              stroke: isConnected ? '#10b981' : '#d1d5db',
              strokeWidth: isConnected ? 3 : 2,
              opacity: isConnected ? 1 : 0.3
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isConnected ? '#10b981' : '#d1d5db'
            }
          };
        });
      });
      
      // Highlight connected nodes
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: {
            ...n.style,
            opacity: connectedNodes.has(n.id) ? 1 : 0.3,
            boxShadow: n.id === nodeId ? '0 0 0 3px #10b981' : n.style?.boxShadow
          }
        }))
      );
    }
  }, [reactFlowInstance, setEdges, setNodes]);

  // Extract model name from file path (e.g., "models/customers.sql" -> "customers")
  const getModelName = () => {
    if (!fileName && !filePath) return null;
    const name = fileName || filePath?.split('/').pop() || '';
    return name.replace(/\.(sql|py|yml|yaml)$/i, '');
  };

  useEffect(() => {
    fetchModelLineage();
  }, [connectionId, fileName, filePath, upstreamLimit, downstreamLimit]); // Re-fetch when limits change

  const fetchFileSpecificLineage = async (accessToken: string, skipLoadingState = false) => {
    try {
      // Don't show loading spinner if we're just expanding (skipLoadingState = true)
      if (!skipLoadingState) {
        setLoading(true);
      }
      
      // Extract dbt-relative path from full repository path
      // e.g., "transform/snowflake-dbt/models/common_mart_marketing/mart_crm_person.sql" 
      // becomes "models/common_mart_marketing/mart_crm_person.sql"
      let dbtRelativePath = filePath!;
      if (filePath!.includes('/models/')) {
        dbtRelativePath = 'models/' + filePath!.split('/models/')[1];
      }
      
      console.log('===================== CODE LINEAGE DEBUG =====================');
      console.log('[CodeLineageView] Connection ID:', connectionId);
      console.log('[CodeLineageView] Original file path:', filePath);
      console.log('[CodeLineageView] DBT-relative path:', dbtRelativePath);
      console.log('[CodeLineageView] File name:', fileName);
      console.log('============================================================');
      
      const response = await fetch(
        `http://localhost:3001/api/metadata/lineage/by-file/${connectionId}?filePath=${encodeURIComponent(dbtRelativePath)}&upstreamLimit=${upstreamLimit}&downstreamLimit=${downstreamLimit}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json();
          setError(errorData.message || 'No lineage data found for this file. Make sure metadata has been extracted.');
        } else {
          throw new Error(`Failed to fetch file lineage: ${response.statusText}`);
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[CodeLineageView] ✅ File lineage data received:');
      console.log('  - File:', data.file);
      console.log('  - Focal objects:', data.focalObjects);
      console.log('  - Total nodes:', data.nodes?.length);
      console.log('  - Total edges:', data.edges?.length);
      console.log('  - Metadata:', data.metadata);

      // Convert to ReactFlow format with ModernModelNode
      const flowNodes: Node[] = await Promise.all(data.nodes.map(async (node: any) => {
        // Fetch columns for each model
        let columns = [];
        try {
          const columnsResponse = await fetch(
            `http://localhost:3001/api/metadata/lineage/columns/${node.id}?limit=100`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (columnsResponse.ok) {
            const columnsData = await columnsResponse.json();
            columns = columnsData.columns || [];
          }
        } catch (err) {
          console.warn(`Failed to fetch columns for ${node.name}:`, err);
        }

        // Calculate upstream/downstream counts
        const upstreamCount = data.edges.filter((e: any) => e.target === node.id).length;
        const downstreamCount = data.edges.filter((e: any) => e.source === node.id).length;

        return {
          id: node.id,
          type: 'expandableModel',
          data: { 
            id: node.id,
            name: node.name,  // Use simple name instead of full_name to avoid "dummy_dummy" prefix
            label: node.name,
            type: node.object_type || 'model',
            description: node.description,
            filePath: node.filePath,
            fileName: node.fileName,
            updatedAt: node.updatedAt,
            extractionTier: node.extractionTier,
            extractedFrom: node.extractedFrom,
            confidence: node.confidence,
            metadata: node.metadata,
            fullName: node.full_name,  // Keep full_name in metadata for reference
            upstreamCount,
            downstreamCount,
            isFocal: node.isFocal,  // Highlight the clicked file's objects
            expanded: false,
            loading: false,
            onExpand: handleExpand,
            onCollapse: handleCollapse,
            onNodeClick: focusNode,
            tooltipContainer: graphContainerRef.current,
            columns: columns.map((col: any) => ({
              id: col.id || col.name,
              name: col.name,
              type: col.data_type || col.type || 'string',
              data_type: col.data_type || col.type || 'string'
            }))
          },
          position: { x: 0, y: 0 }
        };
      }));

      const flowEdges: Edge[] = data.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...defaultEdgeOptions
      }));

      // Store metadata for expand controls
      setLineageMetadata(data.metadata);

      // Add expand button nodes if there are more to load
      const focalNodeId = data.focalObjects?.[0]?.id;
      const allNodes = [...flowNodes];
      
      if (data.metadata.hasMoreUpstream && focalNodeId) {
        const remainingUpstream = data.metadata.totalUpstreamCount - data.metadata.upstreamCount;
        const displayCount = Math.min(remainingUpstream, 5); // Cap at 5 to load incrementally
        
        allNodes.push({
          id: 'expand-upstream',
          type: 'expandButton',
          data: {
            direction: 'upstream' as const,
            count: displayCount,
            onExpand: handleExpandUpstream
          },
          position: { x: 0, y: 0 }
        });
        
        // Add edge connecting expand button to focal node
        flowEdges.push({
          id: 'edge-expand-upstream',
          source: 'expand-upstream',
          target: focalNodeId,
          ...defaultEdgeOptions
        });
      }

      if (data.metadata.hasMoreDownstream && focalNodeId) {
        const remainingDownstream = data.metadata.totalDownstreamCount - data.metadata.downstreamCount;
        const displayCount = Math.min(remainingDownstream, 5); // Cap at 5 to load incrementally
        
        allNodes.push({
          id: 'expand-downstream',
          type: 'expandButton',
          data: {
            direction: 'downstream' as const,
            count: displayCount,
            onExpand: handleExpandDownstream
          },
          position: { x: 0, y: 0 }
        });
        
        // Add edge connecting focal node to expand button
        flowEdges.push({
          id: 'edge-expand-downstream',
          source: focalNodeId,
          target: 'expand-downstream',
          ...defaultEdgeOptions
        });
      }

      // Apply dagre layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(allNodes, flowEdges);
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      setLoading(false);
      setIsExpanding(false);
    } catch (err: any) {
      console.error('Error fetching file-specific lineage:', err);
      setError(err.message || 'Failed to load lineage data');
      setLoading(false);
      setIsExpanding(false);
    }
  };

  const fetchModelLineage = async () => {
    try {
      // Only set loading if not expanding (to avoid full page refresh)
      if (!isExpanding) {
        setLoading(true);
      }
      setError(null);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to view lineage');
        setLoading(false);
        return;
      }

      // NEW: Use file-based lineage API if we have a file path
      if (filePath) {
        console.log('[CodeLineageView] Fetching file-specific lineage for:', filePath);
        await fetchFileSpecificLineage(session.access_token, isExpanding); // Pass isExpanding to skip loading state
        return;
      }

      // FALLBACK: Show all lineage if no file selected
      console.log('[CodeLineageView] No file selected, showing all lineage');
      
      // First, get all models to find the ID of the current file
      const modelName = getModelName();
      
      // Fetch all models
      const allModelsResponse = await fetch(
        `http://localhost:3001/api/metadata/lineage/model/${connectionId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!allModelsResponse.ok) {
        throw new Error(`Failed to fetch models: ${allModelsResponse.statusText}`);
      }

      const allModelsData = await allModelsResponse.json();
      const { nodes: allNodes } = allModelsData;

      // Find the model ID for the current file
      const currentModel = modelName 
        ? allNodes.find((n: LineageNode) => n.name.toLowerCase() === modelName.toLowerCase())
        : null;

      if (!currentModel && modelName) {
        // If we have a file but can't find the model, show all lineage
        console.warn(`Model not found for file: ${modelName}`);
      }

      let apiNodes, apiEdges;

      if (currentModel) {
        // Fetch focused lineage for this specific model
        const focusedResponse = await fetch(
          `http://localhost:3001/api/metadata/lineage/focused/${connectionId}/${currentModel.id}?upstreamLimit=10&downstreamLimit=10`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!focusedResponse.ok) {
          throw new Error(`Failed to fetch focused lineage: ${focusedResponse.statusText}`);
        }

        const focusedData = await focusedResponse.json();
        apiNodes = focusedData.nodes;
        apiEdges = focusedData.edges;
      } else {
        // Show all lineage if no specific file
        apiNodes = allModelsData.nodes;
        apiEdges = allModelsData.edges;
      }

      // Convert to ReactFlow format with ModernModelNode
      const flowNodes: Node[] = await Promise.all(apiNodes.map(async (node: any) => {
        // Fetch columns for each model
        let columns = [];
        try {
          const columnsResponse = await fetch(
            `http://localhost:3001/api/metadata/lineage/columns/${node.id}?limit=100`,
            {
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (columnsResponse.ok) {
            const columnsData = await columnsResponse.json();
            columns = columnsData.columns || [];
          }
        } catch (err) {
          console.warn(`Failed to fetch columns for ${node.name}:`, err);
        }

        // Calculate upstream/downstream counts
        const upstreamCount = apiEdges.filter((e: any) => e.target === node.id).length;
        const downstreamCount = apiEdges.filter((e: any) => e.source === node.id).length;
        const isFocal = currentModel && node.id === currentModel.id;

        return {
          id: node.id,
          type: 'expandableModel',
          data: { 
            id: node.id,
            name: node.name,  // Model name (e.g., "customers")
            label: node.name,
            type: node.type || 'model',  // Object type (e.g., "table in model")
            description: node.description,
            filePath: node.filePath,
            updatedAt: node.updatedAt,
            extractionTier: node.extractionTier,
            extractedFrom: node.extractedFrom,
            confidence: node.confidence,
            metadata: node.metadata,
            upstreamCount,
            downstreamCount,
            isFocal,
            expanded: false,
            loading: false,
            onExpand: handleExpand,
            onCollapse: handleCollapse,
            onNodeClick: focusNode,
            tooltipContainer: graphContainerRef.current,
            columns: columns.map((col: any) => ({
              id: col.id || col.name,
              name: col.name,
              type: col.data_type || col.type || 'string',
              data_type: col.data_type || col.type || 'string'
            }))
          },
          position: { x: 0, y: 0 }
        };
      }));

      const flowEdges: Edge[] = apiEdges.map((edge: LineageEdge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...defaultEdgeOptions
      }));

      // Apply dagre layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(flowNodes, flowEdges);
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err: any) {
      console.error('Error fetching model lineage:', err);
      setError(err.response?.data?.error || 'Failed to load lineage data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading code lineage...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Lineage</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lineage Data</h3>
          <p className="text-gray-600">
            No model dependencies found for this repository. Make sure metadata has been extracted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={graphContainerRef}
      className="h-full w-full"
      style={{
        position: 'relative',
        backgroundColor: isFullscreen ? '#ffffff' : '#ffffff',
        overflow: 'visible'
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-right"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap 
          nodeColor={(node) => {
            if (node.data.isFocal) return '#3b82f6';
            if (node.type === 'expandButton') return '#e5e7eb';
            return '#9ca3af';
          }}
          maskColor="rgba(0, 0, 0, 0.05)"
          style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb'
          }}
        />
        
        {/* Custom Control Buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          {/* Clear Highlight Button */}
          {(selectedNodeId || hoveredColumnPath) && (
            <button
              onClick={clearHighlight}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-md hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium text-gray-700"
              title="Clear highlighting"
            >
              <EyeOff className="w-4 h-4" />
              Clear Highlight
            </button>
          )}
          
          {/* Fit View Button */}
          <button
            onClick={fitToView}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-md hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium text-gray-700"
            title="Fit all nodes to view"
          >
            <Maximize2 className="w-4 h-4" />
            Fit View
          </button>
          
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-md hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium text-gray-700"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-4 h-4" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4" />
                Fullscreen
              </>
            )}
          </button>
        </div>
      </ReactFlow>
    </div>
  );
}

// Wrapper with ReactFlowProvider
export function CodeLineageView(props: CodeLineageViewProps) {
  return (
    <ReactFlowProvider>
      <CodeLineageViewContent {...props} />
    </ReactFlowProvider>
  );
}
