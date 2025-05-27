import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  MiniMap,
  useReactFlow,
  Panel,
  ConnectionMode,
  Node,
  Edge, // Import Edge type
  NodeProps,
  EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronDown, ChevronRight, Database, Download, Info, ZoomIn, ZoomOut, Maximize2, Minimize2, Search, X } from 'lucide-react';
import { createFctOrderItemsCompleteLineage } from './components/charts/lineageData/fctOrderItemsCompleteLineage';

// Define types for our data structures
interface ColumnData {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  description?: string;
  highlighted?: boolean;
}

interface TableNodeData {
  label: string;
  schema: string;
  type: string;
  level: number;
  description?: string;
  columns: ColumnData[];
  highlighted?: boolean;
}

interface EdgeData {
  relationship: string;
  transformationType?: string;
  description?: string;
  sql?: string;
  sourceTable?: string;
  targetTable?: string;
  tooltipLocked?: boolean;
}

interface SearchResult {
  type: 'table' | 'column';
  nodeId: string;
  name: string;
  tableName?: string;
  level: number;
  schema: string;
}

// Type-safe custom node
const TableNode: React.FC<NodeProps<TableNodeData>> = ({ data, isConnectable }) => {
  const [expanded, setExpanded] = useState(true);
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  
  // Different colors for different level nodes
  const getLevelColor = (level: number) => {
    switch(level) {
      case 0: return 'bg-indigo-100';
      case 1: return 'bg-emerald-100';
      case 2: return 'bg-amber-100';
      case 3: return 'bg-rose-100';
      default: return 'bg-slate-100';
    }
  };
  
  const getLevelBorderColor = (level: number) => {
    switch(level) {
      case 0: return 'border-indigo-300';
      case 1: return 'border-emerald-300';
      case 2: return 'border-amber-300';
      case 3: return 'border-rose-300';
      default: return 'border-slate-300';
    }
  };
  
  return (
    <div className={`bg-white rounded-md border-2 ${data.highlighted ? 'border-blue-500 shadow-lg' : getLevelBorderColor(data.level)} w-64 shadow-md`}>
      {/* Table Header */}
      <div className={`p-3 border-b ${getLevelBorderColor(data.level)} flex items-center justify-between ${data.highlighted ? 'bg-blue-50' : getLevelColor(data.level)}`}>
        <div className="flex items-center">
          <Database className={`h-4 w-4 mr-2 ${data.level === 3 ? 'text-rose-600' : (data.level === 0 ? 'text-indigo-600' : (data.level === 1 ? 'text-emerald-600' : 'text-amber-600'))}`} />
          <div className="font-medium text-sm text-slate-800">{data.label}</div>
        </div>
        <div className="flex items-center">
          <div className="text-xs font-medium text-slate-600 mr-2">{data.schema}</div>
          <button
            className="p-1 rounded hover:bg-white/50"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-slate-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>

      {/* Description if present */}
      {data.description && (
        <div className={`px-3 py-1 text-xs text-slate-700 italic border-b ${getLevelBorderColor(data.level)}`}>
          {data.description}
        </div>
      )}

      {/* Columns */}
      {expanded && (
        <div className="p-2 max-h-[300px] overflow-y-auto bg-white/80">
          {data.columns.map((column) => (
            <div 
              key={column.name} 
              className={`py-1.5 px-2 text-xs rounded mb-1 flex items-center justify-between ${
                hoveredColumn === column.name ? 'bg-blue-100' : 
                (column.highlighted ? 'bg-blue-100' : 
                (data.highlighted ? 'bg-blue-50' : 'bg-slate-50/90'))
              } border border-slate-200 shadow-sm`}
              onMouseEnter={() => setHoveredColumn(column.name)}
              onMouseLeave={() => setHoveredColumn(null)}
            >
              <div className="flex items-center flex-grow min-w-0 mr-2">
                <div 
                  className={`flex-shrink-0 w-2 h-2 rounded-full mr-1.5 ${
                    column.isPrimaryKey ? 'bg-amber-500' : (column.isForeignKey ? 'bg-purple-500' : 'bg-slate-400')
                  }`} 
                  title={column.isPrimaryKey ? 'Primary Key' : (column.isForeignKey ? 'Foreign Key' : 'Regular Column')}
                />
                <div className="font-mono font-medium truncate text-slate-800">
                  {column.name}
                </div>
              </div>
              <div className="text-slate-600 text-right flex-shrink-0 ml-1 whitespace-nowrap font-mono text-[10px]">
                {column.type}
              </div>
              
              {/* Add handles for connecting edges */}
              <Handle
                type="source"
                position={Position.Right}
                id={`${column.name}-source`}
                style={{ 
                  background: '#555', 
                  width: 8, 
                  height: 8, 
                  right: -4,
                  visibility: 'hidden' 
                }}
                isConnectable={isConnectable}
              />
              <Handle
                type="target"
                position={Position.Left}
                id={`${column.name}-target`}
                style={{ 
                  background: '#555', 
                  width: 8, 
                  height: 8, 
                  left: -4,
                  visibility: 'hidden' 
                }}
                isConnectable={isConnectable}
              />
            </div>
          ))}
        </div>
      )}

      {/* Type Label */}
      <div className="p-2 border-t border-slate-200 flex items-center text-xs text-slate-500 bg-white/90">
        <div className={`rounded-full px-2 py-1 font-semibold ${
          data.type === 'source' ? 'bg-indigo-100 text-indigo-700' : 
          (data.type === 'transformation' ? 'bg-emerald-100 text-emerald-700' : 
          (data.type === 'mart_fact' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'))
        }`}>
          {data.type.charAt(0).toUpperCase() + data.type.slice(1)}
        </div>
        {data.level !== undefined && (
          <div className="ml-2 bg-slate-100 rounded-full px-2 py-0.5 font-medium border border-slate-200">
            Level {data.level}
          </div>
        )}
      </div>
    </div>
  );
};

// Edge with tooltip for relationship details
const RelationshipEdge: React.FC<EdgeProps<EdgeData>> = ({ 
  id, 
  source, 
  target, 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  sourcePosition, 
  targetPosition, 
  style, 
  markerEnd, 
  data 
}) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipLocked, setTooltipLocked] = useState(false);
  
  // Calculate a bezier curve with more space for better visibility
  const edgePath = `M${sourceX},${sourceY} C${sourceX + 200},${sourceY} ${targetX - 200},${targetY} ${targetX},${targetY}`;
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  
  // Get relationship color based on type
  const getEdgeColor = () => {
    if (!data) return '#64748b'; // default slate color
    
    if (data.relationship?.includes('source')) return '#4f46e5'; // indigo for source to staging
    if (data.relationship?.includes('join')) return '#059669'; // emerald for joins
    if (data.transformationType?.includes('aggregate')) return '#d97706'; // amber for aggregates
    if (data.transformationType?.includes('transform')) return '#e11d48'; // rose for transformations
    
    return '#64748b'; // default slate color
  };
  
  // Custom edge style with stronger color
  const edgeStyle = {
    ...style,
    stroke: getEdgeColor(),
    strokeWidth: tooltipVisible || tooltipLocked ? 4 : 2.5,
    strokeOpacity: tooltipVisible || tooltipLocked ? 1 : 0.8,
    cursor: 'pointer',
  };

  const handleMouseEnter = () => {
    if (!tooltipLocked) {
      setTooltipVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (!tooltipLocked) {
      setTooltipVisible(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTooltipLocked(!tooltipLocked);
    setTooltipVisible(true);
  };
  
  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        strokeWidth={3}
      />
      {(tooltipVisible || tooltipLocked) && data && (
        <foreignObject
          width={240}
          height={160}
          x={midX - 120}
          y={midY - 80}
          className="overflow-visible"
        >
          <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-xs relative">
            {tooltipLocked && (
              <button 
                className="absolute -top-2 -right-2 bg-slate-100 hover:bg-slate-200 p-1 rounded-full border border-slate-300 text-slate-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltipLocked(false);
                  setTooltipVisible(false);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
            <div className="font-semibold text-sm text-slate-800 mb-1">{data.relationship}</div>
            {data.sourceTable && data.targetTable && (
              <div className="text-xs text-slate-600 mb-2">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">{data.sourceTable}</span>
                <span className="mx-1">→</span>
                <span className="bg-slate-100 px-1.5 py-0.5 rounded-md border border-slate-200">{data.targetTable}</span>
              </div>
            )}
            {data.transformationType && (
              <div className="mt-1 text-xs">
                <span className="font-medium text-slate-700">Type: </span>
                <span className="px-1.5 py-0.5 bg-slate-100 rounded-full border border-slate-200 text-slate-700">{data.transformationType}</span>
              </div>
            )}
            {data.description && <div className="mt-1 text-slate-700">{data.description}</div>}
            {data.sql && (
              <div className="mt-2">
                <div className="text-xs font-medium text-slate-700 mb-1">SQL Transformation:</div>
                <div className="font-mono bg-slate-50 p-1.5 rounded text-xs border border-slate-200 text-slate-700 max-h-24 overflow-y-auto">
                  {data.sql}
                </div>
              </div>
            )}
            {tooltipLocked && (
              <div className="mt-2 text-[10px] text-slate-500 italic">
                Click edge or X button to dismiss
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </>
  );
};

// Main component for the fct_order_items lineage page
const FctOrderItemsLineage = () => {
  // Define node types with proper typing
  const nodeTypes = useMemo(() => ({ tableNode: TableNode as any }), []);
  const edgeTypes = useMemo(() => ({ relationship: RelationshipEdge as any }), []);

  // Create a reference to the ReactFlow instance
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Get lineage data
  const lineageData = useMemo(() => createFctOrderItemsCompleteLineage(), []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>(lineageData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<EdgeData>>(lineageData.edges);
  
  // Search functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  // State for fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-layout state - minimizing dependencies to prevent re-renders
  const [layouting, setLayouting] = useState(false);
  const layoutingRef = useRef(false); // Use ref to avoid dependency cycle
  const initialLayoutAppliedRef = useRef(false); // Ensures initial layout runs only once

  // State for the relationship detail panel
  const [selectedEdgeForPanel, setSelectedEdgeForPanel] = useState<Edge<EdgeData> | null>(null);
  const [isRelationshipPanelOpen, setIsRelationshipPanelOpen] = useState<boolean>(false);

  // Zoom controls
  const [zoom, setZoom] = useState(0.5);

  // Initialize the flow with proper dimensions
  const onInit = useCallback((instance: any) => {
    setReactFlowInstance(instance);
    setTimeout(() => {
      instance.fitView({ padding: 0.2, includeHiddenNodes: false });
    }, 100);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomIn();
      setZoom(prev => Math.min(prev + 0.1, 2.5));
    }
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.zoomOut();
      setZoom(prev => Math.max(prev - 0.1, 0.1));
    }
  }, [reactFlowInstance]);
  
  // Auto-fit on window resize
  useEffect(() => {
    const handleResize = () => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ padding: 0.2, includeHiddenNodes: false });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [reactFlowInstance]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const element = document.getElementById('lineage-container');
    if (element) {
      if (!isFullscreen) {
        if (element.requestFullscreen) {
          element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
          element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
          element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          element.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
      setIsFullscreen(!isFullscreen);
      
      // Refit view after fullscreen toggle
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.fitView({ padding: 0.2, includeHiddenNodes: false });
        }
      }, 300);
    }
  }, [isFullscreen, reactFlowInstance]);
  
  // Handle search functionality
  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    
    // Search in nodes and their columns
    const results: SearchResult[] = [];
    
    nodes.forEach(node => {
      if (!node.data) return;
      
      // Check if node label matches
      if (node.data.label.toLowerCase().includes(term)) {
        results.push({
          type: 'table',
          nodeId: node.id,
          name: node.data.label,
          level: node.data.level,
          schema: node.data.schema
        });
      }
      
      // Check if any column matches
      node.data.columns.forEach(column => {
        if (column.name.toLowerCase().includes(term)) {
          results.push({
            type: 'column',
            nodeId: node.id,
            name: column.name,
            tableName: node.data.label,
            level: node.data.level,
            schema: node.data.schema
          });
        }
      });
    });
    
    setSearchResults(results);
  }, [nodes]);

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
  };
  
  // Focus on a node when selected from search
  const focusNode = useCallback((nodeId: string) => {
    if (reactFlowInstance) {
      // Reset highlighted state on all nodes
      const updatedNodes = nodes.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              highlighted: true
            }
          };
        }
        return {
          ...node,
          data: {
            ...node.data,
            highlighted: false
          }
        };
      });
      
      setNodes(updatedNodes);
      setSelectedNode(nodeId);
      
      // Center view on selected node
      const node = updatedNodes.find(n => n.id === nodeId);
      if (node) {
        reactFlowInstance.setCenter(node.position.x, node.position.y, { zoom: 1, duration: 800 });
      }
    }
  }, [nodes, setNodes, reactFlowInstance]);

  // Handler for edge clicks to open the detail panel
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, clickedEdge: Edge<EdgeData>) => {
      // Unpin any existing tooltips from other edges
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.data?.tooltipLocked) { // Unpin all tooltips
            return { ...edge, data: { ...edge.data, tooltipLocked: false } };
          }
          return edge;
        })
      );

      setSelectedEdgeForPanel(clickedEdge);
      setIsRelationshipPanelOpen(true);
      console.log('Edge clicked, opening panel for:', clickedEdge); // For debugging
    },
    [setEdges] // setEdges is stable
  );

  // Legend for relationship types
  const relationshipTypes = [
    { name: 'Source to Staging', color: '#4f46e5' },
    { name: 'Join Transformation', color: '#059669' },
    { name: 'Aggregate Transformation', color: '#d97706' },
    { name: 'Final Transformation', color: '#e11d48' },
  ];

  // Export diagram as image
  const exportDiagram = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.toImage({ download: true, fileName: 'fct_order_items_lineage.png' });
    }
  }, [reactFlowInstance]);

  // Run auto-layout with improved animation
  const runAutoLayout = useCallback(() => {
    if (layoutingRef.current) return; // Prevent re-entry if already layouting

    const currentNodes = reactFlowInstance?.getNodes();
    if (!currentNodes || currentNodes.length === 0) {
      console.warn("AutoLayout: No nodes to layout or ReactFlow instance not ready.");
      return;
    }
    
    layoutingRef.current = true;
    setLayouting(true);
    
    const nodesToUpdate = currentNodes.map((n: Node<TableNodeData>) => ({ ...n })); // Create deep copies for modification
    
    // Create level-based layout
    const levelMap: { [key: number]: Node<TableNodeData>[] } = {};
    
    nodesToUpdate.forEach(node => {
      if (!node.data) return;
      const level = node.data.level || 0;
      if (!levelMap[level]) {
        levelMap[level] = [];
      }
      levelMap[level].push(node);
    });
    
    // Calculate positions for each level
    const levels = Object.keys(levelMap).sort((a, b) => Number(a) - Number(b));
    const horizontalSpacing = 500; // Increased for better readability
    const verticalSpacing = 250;   // Increased for better readability
    const basePadding = 150;
    
    const maxNodesInAnyLevel = Math.max(0, ...levels.map(level => levelMap[level].length)); // Ensure Math.max doesn't get NaN if levels is empty
    const totalHeight = maxNodesInAnyLevel * verticalSpacing;
    
    levels.forEach((level, levelIndex) => {
      const nodesInLevel = levelMap[level];
      if (!nodesInLevel) return; // Should not happen if levelMap is built correctly
      const levelHeight = nodesInLevel.length * verticalSpacing;
      const startY = (totalHeight - levelHeight) / 2 + basePadding;
      
      nodesInLevel.forEach((node, nodeIndex) => {
        node.position = {
          x: levelIndex * horizontalSpacing + basePadding,
          y: startY + nodeIndex * verticalSpacing
        };
        node.draggable = true;
      });
    });
    
    // Use functional update for setNodes
    setNodes(prevNodes =>
      prevNodes.map(prevNode => {
        if (!prevNode.data) return prevNode;
        const updatedNode = nodesToUpdate.find(n => n.id === prevNode.id);
        if (updatedNode && updatedNode.position) {
          return {
            ...prevNode,
            position: updatedNode.position,
            draggable: true,
          };
        }
        return prevNode;
      })
    );
    
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ 
          padding: 0.25, // Slightly more padding
          includeHiddenNodes: false, 
          duration: 800 
        });
      }
      setTimeout(() => {
        layoutingRef.current = false;
        setLayouting(false);
      }, 800);
    }, 100); // Increased delay slightly for positions to settle before fitView
  }, [reactFlowInstance, setNodes]); // Removed 'nodes' from here, using reactFlowInstance.getNodes() instead

  // Run layout ONLY on initial render - Don't re-run on node changes
  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0 && !initialLayoutAppliedRef.current) {
      const timer = setTimeout(() => {
        console.log("Running initial auto layout (one-time)");
        runAutoLayout();
        initialLayoutAppliedRef.current = true; // Mark as applied
      }, 1200); // Increased delay to ensure everything is mounted
      return () => clearTimeout(timer);
    }
  }, [reactFlowInstance, nodes.length, runAutoLayout]); // nodes.length ensures nodes are loaded

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">fct_order_items Lineage</h1>
          <p className="text-slate-500">
            Complete column-level lineage diagram for the fct_order_items model from dbt-example-keppel
          </p>
        </div>
        <div className="flex space-x-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input 
              type="text" 
              placeholder="Search tables or columns..." 
              className="pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-md text-sm"
              value={searchTerm}
              onChange={handleSearch}
            />
            {searchTerm && (
              <button className="absolute right-2 top-1/2 transform -translate-y-1/2" onClick={clearSearch}>
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>
          <button
            className={`flex items-center justify-center p-2 rounded-full ${layouting ? 'bg-blue-50 text-blue-500' : 'hover:bg-slate-100'} transition-colors`}
            onClick={() => {
              // Manual trigger for auto-layout
              if (!layoutingRef.current) {
                console.log("Manually triggering auto layout");
                runAutoLayout();
              }
            }}
            disabled={layouting}
            title="Auto-arrange diagram (one-time action)"
          >
            {layouting ? (
              <div className="h-4 w-4 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            )}
          </button>
          <button
            className="flex items-center justify-center p-2 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <button
            className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 transition-colors"
            onClick={exportDiagram}
          >
            <Download className="h-4 w-4 mr-1" />
            Export Diagram
          </button>
        </div>
      </div>
      
      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-4 bg-white border border-slate-200 rounded-md shadow-sm">
          <div className="p-2 border-b border-slate-200 bg-slate-50 text-sm font-medium">
            Search Results ({searchResults.length})
          </div>
          <div className="max-h-48 overflow-y-auto">
            {searchResults.map((result, index) => (
              <div 
                key={`${result.nodeId}-${result.name}-${index}`}
                className="p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 flex items-center justify-between"
                onClick={() => focusNode(result.nodeId)}
              >
                <div className="flex items-center">
                  {result.type === 'table' ? (
                    <Database className="h-4 w-4 mr-2 text-indigo-500" />
                  ) : (
                    <div className="w-4 h-4 mr-2 flex items-center justify-center">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">
                      {result.name}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {result.type === 'column' ? `in ${result.tableName}` : ''}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {result.schema} • Level {result.level}
                    </div>
                  </div>
                </div>
                <div className={`text-xs px-2 py-1 rounded ${
                  result.level === 0 ? 'bg-indigo-50 text-indigo-700' :
                  result.level === 1 ? 'bg-emerald-50 text-emerald-700' :
                  result.level === 2 ? 'bg-amber-50 text-amber-700' :
                  'bg-rose-50 text-rose-700'
                }`}>
                  {result.level === 0 ? 'Source' :
                   result.level === 1 ? 'Staging' :
                   result.level === 2 ? 'Intermediate' : 'Fact'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div 
        id="lineage-container"
        ref={reactFlowWrapper}
        className={`border rounded-md bg-slate-50 ${isFullscreen ? 'h-screen' : 'h-[80vh]'}`}
        onClick={() => {
          // Close all locked tooltips when clicking on the background
          const updatedEdges = edges.map(edge => ({
            ...edge,
            data: {
              ...edge.data,
              tooltipLocked: false
            }
          }));
          setEdges(updatedEdges);
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeClick={handleEdgeClick} // Pass handleEdgeClick to ReactFlow
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          snapToGrid={false}
          minZoom={0.1}
          maxZoom={2.5}
          defaultZoom={0.5}
          attributionPosition="bottom-right"
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={true}
          nodesConnectable={false}
          panOnScroll={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          zoomOnDoubleClick={true}
          panOnDrag={true}
          elementsSelectable={true}
          defaultMarkerColor="#64748b"
        >
          <Panel position="top-right" className="bg-white p-4 rounded-lg shadow-lg w-64 border border-slate-200">
            <div className="font-semibold text-sm mb-3 text-slate-800">Transformation Legend</div>
            <div className="space-y-2.5">
              {relationshipTypes.map(type => (
                <div key={type.name} className="flex items-center text-xs">
                  <div 
                    className="w-5 h-2.5 mr-2 rounded-sm" 
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="text-slate-700">{type.name}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-medium text-slate-700">Level 0: Source Tables</div>
                <div className="bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 text-xs font-medium border border-indigo-200">
                  {nodes.filter(n => n.data?.level === 0).length}
                </div>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-medium text-slate-700">Level 1: Staging Models</div>
                <div className="bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 text-xs font-medium border border-emerald-200">
                  {nodes.filter(n => n.data?.level === 1).length}
                </div>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-xs font-medium text-slate-700">Level 2: Intermediate</div>
                <div className="bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-medium border border-amber-200">
                  {nodes.filter(n => n.data?.level === 2).length}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-700">Level 3: Fact Table</div>
                <div className="bg-rose-100 text-rose-700 rounded-full px-2 py-0.5 text-xs font-medium border border-rose-200">
                  {nodes.filter(n => n.data?.level === 3).length}
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-600">
              <div className="flex items-start">
                <Info className="h-3.5 w-3.5 mr-1.5 mt-0.5 text-slate-500" />
                <span>Click on connections to pin relationship details</span>
              </div>
            </div>
          </Panel>
          
          <Panel position="bottom-right" className="bg-white border border-slate-200 rounded-lg shadow-md p-1.5 flex items-center space-x-2">
            <button
              className={`p-1.5 rounded-md ${layouting ? 'bg-blue-50 text-blue-500' : 'hover:bg-slate-100'} transition-colors`}
              onClick={() => {
                // Manual trigger for auto-layout
                if (!layoutingRef.current) {
                  console.log("Manually triggering auto layout");
                  runAutoLayout();
                }
              }}
              disabled={layouting}
              title="Auto-arrange diagram (one-time action)"
            >
              {layouting ? (
                <div className="h-4 w-4 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
              )}
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <button
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
              onClick={handleZoomIn}
              title="Zoom in"
            >
              <ZoomIn className="h-4 w-4 text-slate-700" />
            </button>
            <button
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
              onClick={handleZoomOut}
              title="Zoom out"
            >
              <ZoomOut className="h-4 w-4 text-slate-700" />
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <button
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </Panel>
          
          <MiniMap 
            nodeStrokeColor={(n: Node<TableNodeData>) => {
              if (n.data?.level === 0) return '#4f46e5';
              if (n.data?.level === 1) return '#059669';
              if (n.data?.level === 2) return '#d97706';
              if (n.data?.level === 3) return '#e11d48';
              return '#64748b';
            }}
            nodeColor={(n: Node<TableNodeData>) => {
              if (n.data?.level === 0) return '#e0e7ff';
              if (n.data?.level === 1) return '#d1fae5';
              if (n.data?.level === 2) return '#fef3c7';
              if (n.data?.level === 3) return '#ffe4e6';
              return '#f8fafc';
            }}
            maskColor="rgba(240, 245, 255, 0.6)"
            style={{
              borderRadius: '0.375rem',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
            }}
          />
          <Background 
            variant="dots" 
            gap={12} 
            size={1} 
            color="#e2e8f0" 
          />
          <Controls 
            showInteractive={true}
            className="bg-white border border-slate-200 rounded-lg shadow-md p-1"
            style={{ 
              button: { 
                backgroundColor: 'white',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '0.375rem',
                padding: '0.25rem'
              } 
            }}
          />
        </ReactFlow>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        <p>
          <span className="font-medium">Source SQL:</span> 
          <a 
            href="https://github.com/dbt-labs/dbt-example-keppel/blob/main/models/marts/core/fct_order_items.sql" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline ml-1"
          >
            models/marts/core/fct_order_items.sql
          </a>
        </p>
        <div className="mt-2">
          <span className="font-medium">Lineage Metadata:</span>
          <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-slate-100 p-2 rounded">
              <div className="text-xs font-medium">Generated</div>
              <div className="text-sm">2025-05-26</div>
            </div>
            <div className="bg-slate-100 p-2 rounded">
              <div className="text-xs font-medium">Lineage Type</div>
              <div className="text-sm">Column Level</div>
            </div>
            <div className="bg-slate-100 p-2 rounded">
              <div className="text-xs font-medium">Total Models</div>
              <div className="text-sm">8</div>
            </div>
            <div className="bg-slate-100 p-2 rounded">
              <div className="text-xs font-medium">Total Sources</div>
              <div className="text-sm">4</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FctOrderItemsLineage;
