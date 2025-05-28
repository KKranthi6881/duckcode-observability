import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  MarkerType,
  useNodesState,
  useEdgesState,
  Panel,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronDown, ChevronRight, Database, Search, Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { createCustomerLineage, createOrderLineage, lineageModels } from './lineageData';
import { Link } from 'react-router-dom';

// Column Lineage Graph Component
const ColumnLineageGraph = ({ isOverviewMode = false }) => {
  // State for search term and visualization
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("customer");
  const [expandedView, setExpandedView] = useState(false);
  
  // Custom node representing a table with columns
  const TableNode = ({ data, isConnectable }) => {
    const [expanded, setExpanded] = useState(true);
    
    return (
      <div className={`bg-white rounded-md border border-slate-300 shadow-md ${expandedView ? 'w-96' : 'w-72'}`}>
        {/* Table Header */}
        <div className={`p-3 border-b border-slate-200 flex items-center justify-between ${data.highlighted ? 'bg-blue-50' : ''}`}>
          <div className="flex items-center">
            <Database className="h-4 w-4 mr-2 text-blue-600" />
            <div className="font-medium text-sm">{data.label}</div>
          </div>
          <button
            className="p-1 rounded hover:bg-slate-200"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-500" />
            )}
          </button>
        </div>

        {/* Columns */}
        {expanded && (
          <div className="p-2 max-h-72 overflow-y-auto">
            {data.columns.map((column) => (
              <div 
                key={column.id} 
                className={`py-1 px-2 text-xs rounded mb-1 flex items-center justify-between ${column.highlighted ? 'bg-blue-100' : (data.highlighted ? 'bg-blue-50' : 'bg-slate-50')}`}
              >
                <div className="flex items-center">
                  <div 
                    className={`w-2 h-2 rounded-full mr-2 ${column.isPrimaryKey ? 'bg-amber-500' : (column.isForeignKey ? 'bg-purple-500' : 'bg-slate-400')}`} 
                    title={column.isPrimaryKey ? 'Primary Key' : (column.isForeignKey ? 'Foreign Key' : 'Regular Column')}
                  />
                  <div className="font-mono">
                    {column.name}
                  </div>
                </div>
                <span className="text-slate-400 ml-2">{column.type}</span>
                
                {/* Add handles for connecting edges */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`${column.id}-source`}
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
                  id={`${column.id}-target`}
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

        {/* Schema and Type Labels */}
        <div className="p-2 border-t border-slate-200 flex items-center text-xs text-slate-500">
          <div className="bg-slate-100 rounded px-2 py-1 mr-2">{data.schema}</div>
          <div className={`rounded px-2 py-1 ${
            data.type === 'source' ? 'bg-emerald-50 text-emerald-700' : 
            (data.type === 'transformation' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700')
          }`}>
            {data.type}
          </div>
          {data.description && (
            <div className="ml-2 text-xs italic truncate" title={data.description}>
              {data.description.length > 30 
                ? data.description.substring(0, 30) + '...' 
                : data.description}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Define node types
  const nodeTypes = useMemo(() => ({ tableNode: TableNode }), [expandedView]);

  // Get the appropriate lineage data based on selection
  const getLineageData = useCallback(() => {
    switch (selectedModelId) {
      case 'order':
        return createOrderLineage();
      case 'customer':
      default:
        return createCustomerLineage();
    }
  }, [selectedModelId]);

  // Initialize nodes and edges with lineage data
  const initialData = useMemo(() => getLineageData(), [getLineageData]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);

  // Update nodes and edges when model changes
  const handleModelChange = useCallback((modelId) => {
    setSelectedModelId(modelId);
    const newData = modelId === 'order' ? createOrderLineage() : createCustomerLineage();
    setNodes(newData.nodes);
    setEdges(newData.edges);
  }, [setNodes, setEdges]);

  // Function to highlight nodes and edges based on search
  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      // Reset all highlights if search is empty
      setNodes((nds) =>
        nds.map((node) => {
          const newNode = { ...node };
          newNode.data = {
            ...newNode.data,
            highlighted: false,
            columns: newNode.data.columns.map((col) => ({
              ...col,
              highlighted: false,
            })),
          };
          return newNode;
        })
      );
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          style: { ...edge.style, strokeWidth: 1 },
          animated: true,
        }))
      );
      return;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();

    // Find matching column IDs
    const matchingColumnIds = new Set();
    const nodeWithMatchingColumns = new Set();
    
    // First pass - find direct matches
    nodes.forEach((node) => {
      const nodeHasMatch = node.data.columns.some((column) => {
        const isMatch = 
          column.name.toLowerCase().includes(lowerSearchTerm) || 
          column.description?.toLowerCase().includes(lowerSearchTerm);
        
        if (isMatch) {
          matchingColumnIds.add(column.id);
          nodeWithMatchingColumns.add(node.id);
        }
        return isMatch;
      });

      // Also check if table name or description matches
      if (
        node.data.label.toLowerCase().includes(lowerSearchTerm) ||
        node.data.description?.toLowerCase().includes(lowerSearchTerm)
      ) {
        nodeWithMatchingColumns.add(node.id);
      }
    });

    // Find connected edges
    const connectedEdges = new Set();
    edges.forEach((edge) => {
      // Check if this edge connects any matching columns
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      
      if (sourceNode && targetNode) {
        // Add edge if it's part of a path between highlighted nodes
        if (nodeWithMatchingColumns.has(edge.source) || nodeWithMatchingColumns.has(edge.target)) {
          connectedEdges.add(edge.id);
        }
        
        // Also add edge if its description matches the search
        if (edge.data?.description?.toLowerCase().includes(lowerSearchTerm) ||
            edge.data?.relationship?.toLowerCase().includes(lowerSearchTerm)) {
          connectedEdges.add(edge.id);
          nodeWithMatchingColumns.add(edge.source);
          nodeWithMatchingColumns.add(edge.target);
        }
      }
    });

    // Highlight matching nodes and columns
    setNodes((nds) =>
      nds.map((node) => {
        const isNodeMatched = nodeWithMatchingColumns.has(node.id);
        const newNode = { ...node };
        newNode.data = {
          ...newNode.data,
          highlighted: isNodeMatched,
          columns: newNode.data.columns.map((col) => ({
            ...col,
            highlighted: matchingColumnIds.has(col.id),
          })),
        };
        return newNode;
      })
    );

    // Highlight matching edges
    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        style: {
          ...edge.style,
          strokeWidth: connectedEdges.has(edge.id) ? 2 : 1,
          stroke: connectedEdges.has(edge.id) ? '#3B82F6' : edge.style.stroke,
        },
        animated: true,
      }))
    );
  }, [searchTerm, nodes, edges, setNodes, setEdges]);

  return (
    <div style={{ width: "100%", height: isOverviewMode ? "400px" : "80vh" }} className="border rounded-md">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        defaultZoom={isOverviewMode ? 0.5 : 0.7}
        minZoom={0.2}
        maxZoom={1.5}
        snapGrid={[15, 15]}
        connectionMode={ConnectionMode.Strict}
        attributionPosition="bottom-right"
      >
        <Panel position="top-left" className="bg-white p-2 rounded-md shadow-md w-full max-w-sm flex flex-col space-y-3">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Select Lineage Model:</label>
            <select 
              className="flex-1 p-1 border rounded text-sm"
              value={selectedModelId}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              {lineageModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
            {!isOverviewMode && (
              <button
                onClick={() => setExpandedView(!expandedView)}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200"
                title={expandedView ? "Minimize view" : "Expand view"}
              >
                {expandedView ? (
                  <Minimize2 className="h-4 w-4 text-slate-600" />
                ) : (
                  <Maximize2 className="h-4 w-4 text-slate-600" />
                )}
              </button>
            )}
          </div>
          <div className="text-xs text-slate-500">
            {lineageModels.find(m => m.id === selectedModelId)?.description}
          </div>
          <div className="flex items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search columns, tables, or relationships..."
                className="pl-8 w-full p-2 text-sm border rounded"
              />
            </div>
            <button
              onClick={handleSearch}
              className="ml-2 px-3 py-2 bg-blue-600 text-white rounded text-sm"
            >
              Search
            </button>
          </div>
          <div className="flex space-x-3 text-xs">
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-amber-500 mr-1"></div>
              <span>Primary Key</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-purple-500 mr-1"></div>
              <span>Foreign Key</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 rounded-full bg-slate-400 mr-1"></div>
              <span>Regular Column</span>
            </div>
          </div>
          
          {isOverviewMode && (
            <div className="mt-2">
              <Link 
                to={`/dashboard/lineage?model=${selectedModelId}`}
                className="flex items-center text-blue-600 text-sm hover:underline"
              >
                <span>View full lineage details</span>
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </div>
          )}
          
          <div className="text-xs text-slate-500 italic">
            * Use mouse wheel to zoom in/out, drag to pan, and click on tables to expand/collapse columns
          </div>
        </Panel>
        <Background />
        <Controls showInteractive={!isOverviewMode} />
      </ReactFlow>
    </div>
  );
};

export default ColumnLineageGraph;
