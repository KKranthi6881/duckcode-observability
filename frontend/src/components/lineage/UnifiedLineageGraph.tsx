/**
 * Unified Lineage Graph Component
 * 
 * Visualizes lineage from multiple sources (GitHub/dbt, Snowflake, BigQuery, etc.)
 * Shows nodes with source badges and color-coding
 */

import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '../../config/supabaseClient';
import { Database, GitBranch, Snowflake, Loader2, AlertCircle, Wind, BarChart3 } from 'lucide-react';

interface UnifiedLineageGraphProps {
  objectId: string;
  organizationId: string;
  depth?: number;
  direction?: 'upstream' | 'downstream' | 'both';
}

interface LineageNode {
  id: string;
  name: string;
  fqn: string;
  type: string;
  source: string;
}

interface LineageEdge {
  source: string;
  target: string;
  type: string;
  confidence: number;
}

interface LineageResponse {
  focal_object: LineageNode;
  nodes: LineageNode[];
  edges: LineageEdge[];
  stats: {
    total_nodes: number;
    total_edges: number;
    sources: string[];
    max_depth: number;
  };
}

interface ImpactObject {
  id: string;
  name: string;
  fqn: string;
  type: string;
  source: string;
  depth: number;
}

interface ImpactSummary {
  focal_object: {
    id: string;
    name: string;
    fqn: string;
    type: string;
    source: string;
  };
  impacted_objects: ImpactObject[];
  summary: {
    total_impacted: number;
    by_source: Record<string, { count: number }>;
    max_depth: number;
    bi_assets: {
      total: number;
      tableau: number;
      power_bi: number;
    };
    orchestration: {
      airflow: number;
    };
  };
}

// Source-specific colors and icons
const SOURCE_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ReactNode }> = {
  github: {
    color: '#6366f1',
    bgColor: '#eef2ff',
    icon: <GitBranch className="w-4 h-4" />,
  },
  dbt: {
    color: '#f97316',
    bgColor: '#fff7ed',
    icon: <GitBranch className="w-4 h-4" />,
  },
  snowflake: {
    color: '#06b6d4',
    bgColor: '#ecfeff',
    icon: <Snowflake className="w-4 h-4" />,
  },
  airflow: {
    color: '#059669',
    bgColor: '#ecfdf5',
    icon: <Wind className="w-4 h-4" />,
  },
  tableau: {
    color: '#4f46e5',
    bgColor: '#eef2ff',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  power_bi: {
    color: '#f59e0b',
    bgColor: '#fffbeb',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  bigquery: {
    color: '#3b82f6',
    bgColor: '#eff6ff',
    icon: <Database className="w-4 h-4" />,
  },
  databricks: {
    color: '#ef4444',
    bgColor: '#fee2e2',
    icon: <Database className="w-4 h-4" />,
  },
  unknown: {
    color: '#6b7280',
    bgColor: '#f3f4f6',
    icon: <Database className="w-4 h-4" />,
  },
};

// Edge type colors
const EDGE_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  dbt_dependency: { color: '#6366f1', label: 'dbt' },
  foreign_key: { color: '#10b981', label: 'FK' },
  view_lineage: { color: '#8b5cf6', label: 'view' },
};

// Custom node component
const CustomNode = ({ data }: { data: any }) => {
  const sourceConfig = SOURCE_CONFIG[data.source] || SOURCE_CONFIG.unknown;
  const isFocal = data.isFocal;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-lg transition-all ${
        isFocal
          ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
          : 'border-gray-200 bg-white hover:shadow-xl'
      }`}
      style={{
        minWidth: '200px',
        borderColor: isFocal ? '#a855f7' : sourceConfig.color,
      }}
    >
      {/* Header with source badge */}
      <div className="flex items-center justify-between mb-2">
        <div
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
          style={{
            backgroundColor: sourceConfig.bgColor,
            color: sourceConfig.color,
          }}
        >
          {sourceConfig.icon}
          <span className="uppercase">{data.source}</span>
        </div>
        <div className="text-xs text-gray-500">{data.type}</div>
      </div>

      {/* Object name */}
      <div className="font-semibold text-gray-900 mb-1">{data.label}</div>

      {/* FQN */}
      {data.fqn && (
        <div className="text-xs text-gray-500 font-mono truncate" title={data.fqn}>
          {data.fqn}
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

export function UnifiedLineageGraph({
  objectId,
  organizationId: _organizationId,
  depth = 3,
  direction = 'both',
}: UnifiedLineageGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LineageResponse['stats'] | null>(null);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);

  const fetchLineage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[UnifiedLineage] Fetching lineage for object:', objectId);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call unified lineage API
      const response = await fetch(
        `http://localhost:3001/api/lineage/unified/${objectId}?depth=${depth}&direction=${direction}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch lineage: ${response.status}`);
      }

      const data: LineageResponse = await response.json();
      console.log('[UnifiedLineage] Received lineage data:', data);

      setStats(data.stats);

      // Convert to ReactFlow nodes
      const flowNodes: Node[] = data.nodes.map((node) => {
        const isFocal = node.id === objectId;
        return {
          id: node.id,
          type: 'custom',
          position: { x: 0, y: 0 }, // Will be auto-layouted
          data: {
            label: node.name,
            fqn: node.fqn,
            type: node.type,
            source: node.source,
            isFocal,
          },
        };
      });

      // Convert to ReactFlow edges
      const flowEdges: Edge[] = data.edges.map((edge, idx) => {
        const edgeConfig = EDGE_TYPE_CONFIG[edge.type] || { color: '#6b7280', label: edge.type };
        return {
          id: `${edge.source}-${edge.target}-${idx}`,
          source: edge.source,
          target: edge.target,
          type: 'smoothstep',
          animated: edge.type === 'dbt_dependency',
          label: edgeConfig.label,
          labelStyle: { fontSize: 10, fill: edgeConfig.color },
          style: { stroke: edgeConfig.color, strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeConfig.color,
          },
        };
      });

      // Auto-layout using Dagre
      const layoutedNodes = autoLayout(flowNodes, flowEdges);

      setNodes(layoutedNodes);
      setEdges(flowEdges);
    } catch (err) {
      console.error('[UnifiedLineage] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [objectId, depth, direction, setNodes, setEdges]);

  useEffect(() => {
    fetchLineage();
  }, [fetchLineage]);

  useEffect(() => {
    const fetchImpact = async () => {
      try {
        setImpactError(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        const response = await fetch(
          `http://localhost:3001/api/lineage/unified-impact/${objectId}?depth=${depth}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch impact: ${response.status}`);
        }

        const data: ImpactSummary = await response.json();
        setImpact(data);
      } catch (err) {
        console.error('[UnifiedLineage] Impact error:', err);
        setImpactError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    fetchImpact();
  }, [objectId, depth]);

  // Simple auto-layout (hierarchical)
  const autoLayout = (nodes: Node[], edges: Edge[]): Node[] => {
    const levels = new Map<string, number>();
    const visited = new Set<string>();

    // Find focal node
    const focalNode = nodes.find(n => n.data.isFocal);
    if (!focalNode) return nodes;

    // BFS to assign levels
    const queue: Array<{ id: string; level: number }> = [{ id: focalNode.id, level: 0 }];
    levels.set(focalNode.id, 0);

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      // Find connected nodes
      edges.forEach(edge => {
        if (edge.source === id && !visited.has(edge.target)) {
          levels.set(edge.target, level + 1);
          queue.push({ id: edge.target, level: level + 1 });
        }
        if (edge.target === id && !visited.has(edge.source)) {
          levels.set(edge.source, level - 1);
          queue.push({ id: edge.source, level: level - 1 });
        }
      });
    }

    // Group nodes by level
    const levelGroups = new Map<number, string[]>();
    levels.forEach((level, nodeId) => {
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level)!.push(nodeId);
    });

    // Position nodes
    const LEVEL_HEIGHT = 200;
    const NODE_WIDTH = 300;

    return nodes.map(node => {
      const level = levels.get(node.id) ?? 0;
      const nodesInLevel = levelGroups.get(level) || [];
      const indexInLevel = nodesInLevel.indexOf(node.id);
      const totalInLevel = nodesInLevel.length;

      return {
        ...node,
        position: {
          x: (indexInLevel - totalInLevel / 2) * NODE_WIDTH,
          y: level * LEVEL_HEIGHT,
        },
      };
    });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading lineage graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Lineage</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchLineage}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Lineage Found</h3>
          <p className="text-gray-600">This object has no upstream or downstream dependencies.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats Header */}
      {stats && (
        <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-sm">
                <span className="font-semibold text-gray-900">{stats.total_nodes}</span>
                <span className="text-gray-600 ml-1">objects</span>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-gray-900">{stats.total_edges}</span>
                <span className="text-gray-600 ml-1">relationships</span>
              </div>
              <div className="flex items-center gap-2">
                {stats.sources.map(source => {
                  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.unknown;
                  return (
                    <div
                      key={source}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: config.bgColor,
                        color: config.color,
                      }}
                    >
                      {config.icon}
                      <span className="uppercase">{source}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-xs text-gray-500">Depth: {stats.max_depth} levels</div>
          </div>
        </div>
      )}

      {/* Impact Summary */}
      {impact && (
        <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-sm">
              <div className="font-semibold text-gray-900">Impact summary</div>
              <div className="text-gray-700">
                <span className="font-semibold">{impact.summary.total_impacted}</span>{' '}
                downstream objects
                {impact.summary.bi_assets.total > 0 && (
                  <span className="ml-2 text-xs text-gray-600">
                    BI: {impact.summary.bi_assets.total} (Tableau {impact.summary.bi_assets.tableau}, Power BI {impact.summary.bi_assets.power_bi})
                  </span>
                )}
                {impact.summary.orchestration.airflow > 0 && (
                  <span className="ml-2 text-xs text-gray-600">
                    Airflow DAGs: {impact.summary.orchestration.airflow}
                  </span>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs text-gray-600">
              {Object.entries(impact.summary.by_source).map(([source, info]) => {
                const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.unknown;
                return (
                  <div
                    key={source}
                    className="flex items-center gap-1 px-2 py-1 rounded"
                    style={{ backgroundColor: cfg.bgColor, color: cfg.color }}
                  >
                    {cfg.icon}
                    <span className="uppercase">{source}</span>
                    <span className="ml-1">{info.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {impact.impacted_objects.length > 0 && (
            <div className="mt-2 text-xs text-gray-700">
              <div className="font-medium mb-1">Top impacted (closest downstream):</div>
              <div className="flex flex-wrap gap-2">
                {impact.impacted_objects.slice(0, 5).map(obj => {
                  const cfg = SOURCE_CONFIG[obj.source] || SOURCE_CONFIG.unknown;
                  return (
                    <div
                      key={obj.id}
                      className="flex items-center gap-1 px-2 py-1 rounded border text-[11px]"
                      style={{ borderColor: cfg.color }}
                    >
                      <span
                        className="font-mono truncate max-w-[180px]"
                        title={obj.fqn || obj.name}
                      >
                        {obj.name}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="uppercase" style={{ color: cfg.color }}>
                        {obj.source}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span>depth {obj.depth}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {impactError && (
        <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-200 text-xs text-red-500">
          Failed to load impact summary: {impactError}
        </div>
      )}

      {/* Graph */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="flex-shrink-0 px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-6 text-xs">
          <div className="font-semibold text-gray-700">Edge Types:</div>
          {Object.entries(EDGE_TYPE_CONFIG).map(([type, config]) => (
            <div key={type} className="flex items-center gap-2">
              <div
                className="w-8 h-0.5"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-gray-600">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
