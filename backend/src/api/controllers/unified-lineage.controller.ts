/**
 * Unified Lineage Controller
 * 
 * Handles multi-source lineage queries combining:
 * - GitHub/dbt dependencies
 * - Snowflake foreign keys
 * - View column lineage
 * - Future: BigQuery, Databricks, etc.
 */

import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';

interface LineageNode {
  id: string;
  name: string;
  fqn: string;
  type: 'table' | 'view' | 'model' | 'source';
  source: string; // Primary source: 'github', 'snowflake', 'bigquery', etc.
  sources?: string[]; // All sources if object exists in multiple systems
  repository_id?: string;
  connector_id?: string;
  metadata?: any;
}

interface LineageEdge {
  source: string;
  target: string;
  type: 'dbt_dependency' | 'foreign_key' | 'view_lineage';
  confidence: number;
}

interface UnifiedLineageResponse {
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

interface UnifiedImpactObject {
  id: string;
  name: string;
  fqn: string;
  type: string;
  source: string;
  depth: number;
}

interface UnifiedImpactSummary {
  focal_object: {
    id: string;
    name: string;
    fqn: string;
    type: string;
    source: string;
  };
  impacted_objects: UnifiedImpactObject[];
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

/**
 * Get unified lineage graph for an object
 * Combines all lineage sources into a single graph
 */
export async function getUnifiedLineage(req: Request, res: Response) {
  try {
    const { objectId } = req.params;
    const { 
      depth = 3, 
      direction = 'both',
      includeTypes 
    } = req.query;

    if (!objectId) {
      return res.status(400).json({ error: 'Object ID required' });
    }

    // Get organization_id from user profile
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .schema('duckcode')
      .from('user_profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('[UnifiedLineage] Failed to get organization_id:', profileError);
      return res.status(401).json({ error: 'Organization ID required' });
    }

    const organizationId = profile.organization_id;
    console.log(`[UnifiedLineage] Fetching lineage for object ${objectId}, org ${organizationId}`);

    // Get the focal object details
    const { data: focalObject, error: focalError } = await supabaseAdmin
      .schema('metadata')
      .from('objects')
      .select('id, name, fqn, object_type, source_type, repository_id, metadata')
      .eq('id', objectId)
      .eq('organization_id', organizationId)
      .single();

    if (focalError || !focalObject) {
      console.error('[UnifiedLineage] Focal object not found:', focalError);
      return res.status(404).json({ error: 'Object not found' });
    }

    // Use the database function to get lineage graph
    const { data: lineageData, error: lineageError } = await supabaseAdmin
      .schema('metadata')
      .rpc('get_lineage_graph', {
        p_object_id: objectId,
        p_organization_id: organizationId,
        p_depth: parseInt(depth as string),
        p_direction: direction as string
      });

    if (lineageError) {
      console.error('[UnifiedLineage] Error fetching lineage:', lineageError);
      return res.status(500).json({ error: 'Failed to fetch lineage' });
    }

    console.log(`[UnifiedLineage] Found ${lineageData?.length || 0} lineage relationships`);

    // Build nodes and edges
    const nodesMap = new Map<string, LineageNode>();
    const edges: LineageEdge[] = [];
    const sources = new Set<string>();

    // Add focal object as a node with sources array
    nodesMap.set(focalObject.id, {
      id: focalObject.id,
      name: focalObject.name,
      fqn: focalObject.fqn,
      type: focalObject.object_type,
      source: focalObject.source_type || 'unknown',
      sources: [focalObject.source_type || 'unknown'], // Array for multiple sources
      repository_id: focalObject.repository_id,
      metadata: focalObject.metadata
    });
    sources.add(focalObject.source_type || 'unknown');

    // Process lineage data
    if (lineageData && lineageData.length > 0) {
      for (const row of lineageData) {
        // Add source node
        if (!nodesMap.has(row.source_id)) {
          nodesMap.set(row.source_id, {
            id: row.source_id,
            name: row.source_name,
            fqn: row.source_fqn,
            type: row.source_object_type || 'table',
            source: row.source_type || 'unknown'
          });
          sources.add(row.source_type || 'unknown');
        }

        // Add target node
        if (!nodesMap.has(row.target_id)) {
          nodesMap.set(row.target_id, {
            id: row.target_id,
            name: row.target_name,
            fqn: row.target_fqn,
            type: row.target_object_type || 'table',
            source: row.target_type || 'unknown'
          });
          sources.add(row.target_type || 'unknown');
        }

        // Add edge
        edges.push({
          source: row.source_id,
          target: row.target_id,
          type: row.lineage_type,
          confidence: parseFloat(row.confidence) || 1.0
        });
      }
    }

    // Filter by source types if specified
    let filteredNodes = Array.from(nodesMap.values());
    let filteredEdges = edges;

    if (includeTypes) {
      const types = (includeTypes as string).split(',');
      filteredNodes = filteredNodes.filter(n => types.includes(n.source));
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = edges.filter(e => 
        filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
      );
    }

    const response: UnifiedLineageResponse = {
      focal_object: nodesMap.get(focalObject.id)!,
      nodes: filteredNodes,
      edges: filteredEdges,
      stats: {
        total_nodes: filteredNodes.length,
        total_edges: filteredEdges.length,
        sources: Array.from(sources),
        max_depth: parseInt(depth as string)
      }
    };

    console.log(`[UnifiedLineage] Returning ${response.nodes.length} nodes, ${response.edges.length} edges`);
    res.json(response);

  } catch (error) {
    console.error('[UnifiedLineage] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUnifiedImpact(req: Request, res: Response) {
  try {
    const { objectId } = req.params;
    const { depth = 3 } = req.query;

    if (!objectId) {
      return res.status(400).json({ error: 'Object ID required' });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .schema('duckcode')
      .from('user_profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('[UnifiedImpact] Failed to get organization_id:', profileError);
      return res.status(401).json({ error: 'Organization ID required' });
    }

    const organizationId = profile.organization_id;

    const { data: focalObject, error: focalError } = await supabaseAdmin
      .schema('metadata')
      .from('objects')
      .select('id, name, fqn, object_type, source_type')
      .eq('id', objectId)
      .eq('organization_id', organizationId)
      .single();

    if (focalError || !focalObject) {
      console.error('[UnifiedImpact] Focal object not found:', focalError);
      return res.status(404).json({ error: 'Object not found' });
    }

    const { data: lineageData, error: lineageError } = await supabaseAdmin
      .schema('metadata')
      .rpc('get_lineage_graph', {
        p_object_id: objectId,
        p_organization_id: organizationId,
        p_depth: parseInt(depth as string),
        p_direction: 'downstream',
      });

    if (lineageError) {
      console.error('[UnifiedImpact] Error fetching lineage:', lineageError);
      return res.status(500).json({ error: 'Failed to fetch lineage for impact analysis' });
    }

    const adjacency = new Map<string, Set<string>>();
    const nodeMeta = new Map<
      string,
      { id: string; name: string; fqn: string; object_type: string; source_type: string }
    >();

    nodeMeta.set(focalObject.id, {
      id: focalObject.id,
      name: focalObject.name,
      fqn: focalObject.fqn,
      object_type: focalObject.object_type,
      source_type: focalObject.source_type || 'unknown',
    });

    if (Array.isArray(lineageData)) {
      for (const row of lineageData as any[]) {
        const sourceId = row.source_id as string | null;
        const targetId = row.target_id as string | null;

        if (sourceId && !nodeMeta.has(sourceId)) {
          nodeMeta.set(sourceId, {
            id: sourceId,
            name: row.source_name,
            fqn: row.source_fqn,
            object_type: row.source_object_type || 'table',
            source_type: row.source_type || 'unknown',
          });
        }

        if (targetId && !nodeMeta.has(targetId)) {
          nodeMeta.set(targetId, {
            id: targetId,
            name: row.target_name,
            fqn: row.target_fqn,
            object_type: row.target_object_type || 'table',
            source_type: row.target_type || 'unknown',
          });
        }

        if (sourceId && targetId) {
          if (!adjacency.has(sourceId)) {
            adjacency.set(sourceId, new Set<string>());
          }
          adjacency.get(sourceId)!.add(targetId);
        }
      }
    }

    const depths = new Map<string, number>();
    const queue: string[] = [];

    depths.set(focalObject.id, 0);
    queue.push(focalObject.id);

    while (queue.length > 0) {
      const current = queue.shift() as string;
      const currentDepth = depths.get(current) || 0;
      const neighbors = adjacency.get(current);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (!depths.has(neighbor)) {
          depths.set(neighbor, currentDepth + 1);
          queue.push(neighbor);
        }
      }
    }

    const impacted: UnifiedImpactObject[] = [];
    const bySource: Record<string, { count: number }> = {};
    let maxDepthSeen = 0;
    let biTableau = 0;
    let biPowerBi = 0;
    let orchestrationAirflow = 0;

    depths.forEach((d, id) => {
      if (id === focalObject.id || d <= 0) {
        return;
      }
      const meta = nodeMeta.get(id);
      if (!meta) {
        return;
      }
      const source = meta.source_type || 'unknown';
      if (!bySource[source]) {
        bySource[source] = { count: 0 };
      }
      bySource[source].count += 1;
      if (source === 'tableau') {
        biTableau += 1;
      }
      if (source === 'power_bi') {
        biPowerBi += 1;
      }
      if (source === 'airflow') {
        orchestrationAirflow += 1;
      }
      if (d > maxDepthSeen) {
        maxDepthSeen = d;
      }
      impacted.push({
        id: meta.id,
        name: meta.name,
        fqn: meta.fqn,
        type: meta.object_type,
        source,
        depth: d,
      });
    });

    impacted.sort((a, b) => a.depth - b.depth);

    const response: UnifiedImpactSummary = {
      focal_object: {
        id: focalObject.id,
        name: focalObject.name,
        fqn: focalObject.fqn,
        type: focalObject.object_type,
        source: focalObject.source_type || 'unknown',
      },
      impacted_objects: impacted,
      summary: {
        total_impacted: impacted.length,
        by_source: bySource,
        max_depth: maxDepthSeen,
        bi_assets: {
          total: biTableau + biPowerBi,
          tableau: biTableau,
          power_bi: biPowerBi,
        },
        orchestration: {
          airflow: orchestrationAirflow,
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[UnifiedImpact] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get lineage statistics for an organization
 */
export async function getLineageStats(req: Request, res: Response) {
  try {
    // Get organization_id from user profile
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User ID required' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .schema('duckcode')
      .from('user_profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.organization_id) {
      console.error('[UnifiedLineage] Failed to get organization_id:', profileError);
      return res.status(401).json({ error: 'Organization ID required' });
    }

    const organizationId = profile.organization_id;

    // Count objects by source type
    const { data: objectStats, error: objError } = await supabaseAdmin
      .schema('metadata')
      .from('objects')
      .select('source_type')
      .eq('organization_id', organizationId);

    if (objError) {
      throw objError;
    }

    const sourceTypeCounts = objectStats.reduce((acc: any, obj: any) => {
      const type = obj.source_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Count lineage relationships by type
    const { data: lineageStats, error: lineageError } = await supabaseAdmin
      .schema('metadata')
      .from('unified_lineage')
      .select('lineage_type')
      .eq('organization_id', organizationId);

    if (lineageError) {
      throw lineageError;
    }

    const lineageTypeCounts = lineageStats.reduce((acc: any, rel: any) => {
      const type = rel.lineage_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      objects_by_source: sourceTypeCounts,
      lineage_by_type: lineageTypeCounts,
      total_objects: objectStats.length,
      total_relationships: lineageStats.length
    });

  } catch (error) {
    console.error('[UnifiedLineage] Error getting stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
