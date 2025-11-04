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
