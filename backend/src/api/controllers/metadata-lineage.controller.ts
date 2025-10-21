import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    organization_id: string;
  };
}

/**
 * Get model-level lineage graph for a connection
 * Returns nodes (models) and edges (dependencies) for visualization
 */
export async function getModelLineage(req: AuthenticatedRequest, res: Response) {
  try {
    const { connectionId } = req.params;
    const organizationId = req.user.organization_id;

    console.log(`[ModelLineage] Fetching for connection: ${connectionId}`);

    // Get all objects (models) for this connection
    const { data: objects, error: objectsError } = await supabase
      .schema('metadata')
      .from('objects')
      .select(`
        id,
        name,
        object_type,
        description,
        metadata
      `)
      .eq('connection_id', connectionId)
      .eq('organization_id', organizationId)
      .order('name');

    if (objectsError) {
      console.error('[ModelLineage] Error fetching objects:', objectsError);
      return res.status(500).json({ error: 'Failed to fetch models' });
    }

    // Get all model dependencies
    const { data: dependencies, error: depsError } = await supabase
      .schema('metadata')
      .from('dependencies')
      .select(`
        id,
        source_object_id,
        target_object_id,
        dependency_type,
        confidence,
        metadata
      `)
      .eq('organization_id', organizationId);

    if (depsError) {
      console.error('[ModelLineage] Error fetching dependencies:', depsError);
      return res.status(500).json({ error: 'Failed to fetch dependencies' });
    }

    // Filter dependencies to only include objects in this connection
    const objectIds = new Set((objects || []).map(o => o.id));
    const filteredDeps = (dependencies || []).filter(dep =>
      objectIds.has(dep.source_object_id) && objectIds.has(dep.target_object_id)
    );

    // Format for ReactFlow
    const nodes = (objects || []).map(obj => ({
      id: obj.id,
      name: obj.name,
      type: obj.object_type,
      description: obj.description,
      metadata: obj.metadata,
      // Calculate statistics
      stats: {
        upstreamCount: filteredDeps.filter(d => d.target_object_id === obj.id).length,
        downstreamCount: filteredDeps.filter(d => d.source_object_id === obj.id).length
      }
    }));

    const edges = filteredDeps.map(dep => ({
      id: dep.id,
      source: dep.source_object_id,
      target: dep.target_object_id,
      type: dep.dependency_type,
      confidence: dep.confidence,
      metadata: dep.metadata
    }));

    console.log(`[ModelLineage] ✅ Found ${nodes.length} models, ${edges.length} dependencies`);

    res.json({
      nodes,
      edges,
      metadata: {
        connectionId,
        totalModels: nodes.length,
        totalDependencies: edges.length
      }
    });

  } catch (error: any) {
    console.error('[ModelLineage] ❌ Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get columns for a specific model (for expansion)
 * Returns columns and their lineage relationships
 */
export async function getModelColumns(req: AuthenticatedRequest, res: Response) {
  try {
    const { objectId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    const organizationId = req.user.organization_id;

    console.log(`[ModelColumns] Fetching for object: ${objectId}`);

    // Get the object details
    const { data: object, error: objectError } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, object_type')
      .eq('id', objectId)
      .eq('organization_id', organizationId)
      .single();

    if (objectError || !object) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Get columns for this object
    const { data: columns, error: columnsError } = await supabase
      .schema('metadata')
      .from('columns')
      .select(`
        id,
        name,
        data_type,
        description,
        metadata
      `)
      .eq('object_id', objectId)
      .eq('organization_id', organizationId)
      .order('name')
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (columnsError) {
      console.error('[ModelColumns] Error fetching columns:', columnsError);
      return res.status(500).json({ error: 'Failed to fetch columns' });
    }

    // Get total column count
    const { count } = await supabase
      .schema('metadata')
      .from('columns')
      .select('id', { count: 'exact', head: true })
      .eq('object_id', objectId)
      .eq('organization_id', organizationId);

    // Get column lineage for these columns (both incoming and outgoing)
    const columnNames = (columns || []).map(c => c.name);
    
    // Get incoming lineages (this object as target)
    const { data: incomingLineages } = await supabase
      .schema('metadata')
      .from('columns_lineage')
      .select(`
        id,
        source_object_id,
        source_column,
        target_object_id,
        target_column,
        transformation_type,
        confidence,
        extracted_from,
        expression,
        metadata
      `)
      .eq('target_object_id', objectId)
      .in('target_column', columnNames)
      .eq('organization_id', organizationId);

    // Get outgoing lineages (this object as source)
    const { data: outgoingLineages } = await supabase
      .schema('metadata')
      .from('columns_lineage')
      .select(`
        id,
        source_object_id,
        source_column,
        target_object_id,
        target_column,
        transformation_type,
        confidence,
        extracted_from,
        expression,
        metadata
      `)
      .eq('source_object_id', objectId)
      .in('source_column', columnNames)
      .eq('organization_id', organizationId);

    // Combine both directions
    const columnLineages = [
      ...(incomingLineages || []),
      ...(outgoingLineages || [])
    ];

    console.log(`[ModelColumns] ✅ Found ${columns?.length || 0} columns, ${columnLineages?.length || 0} lineages (${incomingLineages?.length || 0} incoming, ${outgoingLineages?.length || 0} outgoing)`);

    res.json({
      object: {
        id: object.id,
        name: object.name,
        type: object.object_type
      },
      columns: columns || [],
      columnLineages: columnLineages || [],
      pagination: {
        total: count || 0,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: (Number(offset) + Number(limit)) < (count || 0)
      }
    });

  } catch (error: any) {
    console.error('[ModelColumns] ❌ Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get column lineage for a specific column
 * Traces the full path from source to target
 */
export async function getColumnLineage(req: AuthenticatedRequest, res: Response) {
  try {
    const { objectId, columnName } = req.params;
    const { direction = 'both' } = req.query;
    const organizationId = req.user.organization_id;

    console.log(`[ColumnLineage] Tracing ${objectId}.${columnName} (${direction})`);

    // Get the object details
    const { data: object, error: objectError } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, object_type')
      .eq('id', objectId)
      .eq('organization_id', organizationId)
      .single();

    if (objectError || !object) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Trace upstream (sources)
    let upstreamPath: any[] = [];
    if (direction === 'both' || direction === 'upstream') {
      upstreamPath = await traceUpstream(objectId, columnName, organizationId);
    }

    // Trace downstream (targets)
    let downstreamPath: any[] = [];
    if (direction === 'both' || direction === 'downstream') {
      downstreamPath = await traceDownstream(objectId, columnName, organizationId);
    }

    console.log(`[ColumnLineage] ✅ Upstream: ${upstreamPath.length}, Downstream: ${downstreamPath.length}`);

    res.json({
      column: {
        objectId,
        objectName: object.name,
        columnName
      },
      upstream: upstreamPath,
      downstream: downstreamPath,
      metadata: {
        totalHops: upstreamPath.length + downstreamPath.length,
        direction
      }
    });

  } catch (error: any) {
    console.error('[ColumnLineage] ❌ Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Helper: Trace column lineage upstream (sources)
 */
async function traceUpstream(
  targetObjectId: string,
  targetColumn: string,
  organizationId: string,
  visited = new Set<string>(),
  depth = 0,
  maxDepth = 10
): Promise<any[]> {
  if (depth >= maxDepth) return [];

  const key = `${targetObjectId}:${targetColumn}`;
  if (visited.has(key)) return []; // Prevent cycles
  visited.add(key);

  const { data: lineages } = await supabase
    .schema('metadata')
    .from('columns_lineage')
    .select(`
      id,
      source_object_id,
      source_column,
      target_object_id,
      target_column,
      transformation_type,
      confidence,
      expression,
      extracted_from
    `)
    .eq('target_object_id', targetObjectId)
    .eq('target_column', targetColumn)
    .eq('organization_id', organizationId);

  if (!lineages || lineages.length === 0) return [];

  const path: any[] = [];

  for (const lineage of lineages) {
    // Get source object details
    const { data: sourceObject } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, object_type')
      .eq('id', lineage.source_object_id)
      .single();

    if (sourceObject) {
      path.push({
        objectId: sourceObject.id,
        objectName: sourceObject.name,
        objectType: sourceObject.object_type,
        columnName: lineage.source_column,
        transformationType: lineage.transformation_type,
        confidence: lineage.confidence,
        expression: lineage.expression,
        extractedFrom: lineage.extracted_from,
        depth
      });

      // Recurse upstream
      const upstream = await traceUpstream(
        lineage.source_object_id,
        lineage.source_column,
        organizationId,
        visited,
        depth + 1,
        maxDepth
      );
      path.push(...upstream);
    }
  }

  return path;
}

/**
 * Helper: Trace column lineage downstream (targets)
 */
async function traceDownstream(
  sourceObjectId: string,
  sourceColumn: string,
  organizationId: string,
  visited = new Set<string>(),
  depth = 0,
  maxDepth = 10
): Promise<any[]> {
  if (depth >= maxDepth) return [];

  const key = `${sourceObjectId}:${sourceColumn}`;
  if (visited.has(key)) return [];
  visited.add(key);

  const { data: lineages } = await supabase
    .schema('metadata')
    .from('columns_lineage')
    .select(`
      id,
      source_object_id,
      source_column,
      target_object_id,
      target_column,
      transformation_type,
      confidence,
      expression,
      extracted_from
    `)
    .eq('source_object_id', sourceObjectId)
    .eq('source_column', sourceColumn)
    .eq('organization_id', organizationId);

  if (!lineages || lineages.length === 0) return [];

  const path: any[] = [];

  for (const lineage of lineages) {
    // Get target object details
    const { data: targetObject } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, object_type')
      .eq('id', lineage.target_object_id)
      .single();

    if (targetObject) {
      path.push({
        objectId: targetObject.id,
        objectName: targetObject.name,
        objectType: targetObject.object_type,
        columnName: lineage.target_column,
        transformationType: lineage.transformation_type,
        confidence: lineage.confidence,
        expression: lineage.expression,
        extractedFrom: lineage.extracted_from,
        depth
      });

      // Recurse downstream
      const downstream = await traceDownstream(
        lineage.target_object_id,
        lineage.target_column,
        organizationId,
        visited,
        depth + 1,
        maxDepth
      );
      path.push(...downstream);
    }
  }

  return path;
}

/**
 * Get lineage statistics for a connection
 */
export async function getLineageStats(req: AuthenticatedRequest, res: Response) {
  try {
    const { connectionId } = req.params;
    const organizationId = req.user.organization_id;

    console.log(`[LineageStats] Fetching for connection: ${connectionId}`);

    // Count objects
    const { count: objectCount } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id', { count: 'exact', head: true })
      .eq('connection_id', connectionId)
      .eq('organization_id', organizationId);

    // Count dependencies
    const { data: objects } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id')
      .eq('connection_id', connectionId)
      .eq('organization_id', organizationId);

    const objectIds = (objects || []).map(o => o.id);

    const { count: depCount } = await supabase
      .schema('metadata')
      .from('dependencies')
      .select('id', { count: 'exact', head: true })
      .in('source_object_id', objectIds)
      .eq('organization_id', organizationId);

    // Count column lineages
    const { count: columnLineageCount } = await supabase
      .schema('metadata')
      .from('columns_lineage')
      .select('id', { count: 'exact', head: true })
      .in('target_object_id', objectIds)
      .eq('organization_id', organizationId);

    // Get average confidence
    const { data: avgConfidence } = await supabase
      .schema('metadata')
      .from('columns_lineage')
      .select('confidence')
      .in('target_object_id', objectIds)
      .eq('organization_id', organizationId);

    const avgConf = avgConfidence && avgConfidence.length > 0
      ? avgConfidence.reduce((sum, c) => sum + (c.confidence || 0), 0) / avgConfidence.length
      : 0;

    console.log(`[LineageStats] ✅ Models: ${objectCount}, Deps: ${depCount}, Col Lineages: ${columnLineageCount}`);

    res.json({
      connectionId,
      statistics: {
        totalModels: objectCount || 0,
        totalDependencies: depCount || 0,
        totalColumnLineages: columnLineageCount || 0,
        averageConfidence: Math.round(avgConf * 100) / 100
      }
    });

  } catch (error: any) {
    console.error('[LineageStats] ❌ Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get focused lineage for a specific model
 * Returns upstream and downstream models from a focal point
 */
export async function getFocusedLineage(req: AuthenticatedRequest, res: Response) {
  try {
    const { connectionId, modelId } = req.params;
    const { upstreamLimit = 5, downstreamLimit = 5 } = req.query;
    const organizationId = req.user.organization_id;

    console.log(`[FocusedLineage] Fetching for model: ${modelId}, upstream: ${upstreamLimit}, downstream: ${downstreamLimit}`);

    // Get the focal model
    const { data: focalModel, error: focalError } = await supabase
      .schema('metadata')
      .from('objects')
      .select('*')
      .eq('id', modelId)
      .eq('connection_id', connectionId)
      .eq('organization_id', organizationId)
      .single();

    if (focalError || !focalModel) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Recursive function to get upstream models
    async function getUpstreamModels(startId: string, limit: number, visited = new Set<string>()): Promise<any[]> {
      if (visited.has(startId) || visited.size >= limit) return [];
      visited.add(startId);

      const { data: deps } = await supabase
        .schema('metadata')
        .from('dependencies')
        .select('source_object_id, confidence, metadata')
        .eq('target_object_id', startId)
        .eq('organization_id', organizationId);

      if (!deps || deps.length === 0) return [];

      const sourceIds = deps.map(d => d.source_object_id);
      const { data: models } = await supabase
        .schema('metadata')
        .from('objects')
        .select('*')
        .in('id', sourceIds)
        .eq('connection_id', connectionId);

      const results = models || [];
      
      // Recursively get more upstream if we haven't hit the limit
      for (const model of results) {
        if (visited.size < limit) {
          const moreUpstream = await getUpstreamModels(model.id, limit, visited);
          results.push(...moreUpstream);
        }
      }

      return results;
    }

    // Recursive function to get downstream models
    async function getDownstreamModels(startId: string, limit: number, visited = new Set<string>()): Promise<any[]> {
      if (visited.has(startId) || visited.size >= limit) return [];
      visited.add(startId);

      const { data: deps } = await supabase
        .schema('metadata')
        .from('dependencies')
        .select('target_object_id, confidence, metadata')
        .eq('source_object_id', startId)
        .eq('organization_id', organizationId);

      if (!deps || deps.length === 0) return [];

      const targetIds = deps.map(d => d.target_object_id);
      const { data: models } = await supabase
        .schema('metadata')
        .from('objects')
        .select('*')
        .in('id', targetIds)
        .eq('connection_id', connectionId);

      const results = models || [];
      
      // Recursively get more downstream if we haven't hit the limit
      for (const model of results) {
        if (visited.size < limit) {
          const moreDownstream = await getDownstreamModels(model.id, limit, visited);
          results.push(...moreDownstream);
        }
      }

      return results;
    }

    // Get upstream and downstream models
    const upstreamModels = await getUpstreamModels(modelId, Number(upstreamLimit));
    const downstreamModels = await getDownstreamModels(modelId, Number(downstreamLimit));

    // Get all dependencies between these models
    const allModelIds = [
      modelId,
      ...upstreamModels.map(m => m.id),
      ...downstreamModels.map(m => m.id)
    ];

    const { data: allDeps } = await supabase
      .schema('metadata')
      .from('dependencies')
      .select('*')
      .in('source_object_id', allModelIds)
      .in('target_object_id', allModelIds)
      .eq('organization_id', organizationId);

    // Calculate stats for each model
    const modelStats = new Map();
    allDeps?.forEach(dep => {
      const source = modelStats.get(dep.source_object_id) || { upstreamCount: 0, downstreamCount: 0 };
      const target = modelStats.get(dep.target_object_id) || { upstreamCount: 0, downstreamCount: 0 };
      source.downstreamCount++;
      target.upstreamCount++;
      modelStats.set(dep.source_object_id, source);
      modelStats.set(dep.target_object_id, target);
    });

    // Format response
    const allModels = [focalModel, ...upstreamModels, ...downstreamModels];
    const uniqueModels = Array.from(new Map(allModels.map(m => [m.id, m])).values());

    const nodes = uniqueModels.map(model => ({
      id: model.id,
      name: model.name,
      type: model.object_type,
      description: model.description,
      metadata: model.metadata,
      stats: modelStats.get(model.id) || { upstreamCount: 0, downstreamCount: 0 },
      isFocal: model.id === modelId
    }));

    const edges = (allDeps || []).map(dep => ({
      id: dep.id,
      source: dep.source_object_id,
      target: dep.target_object_id,
      confidence: dep.confidence || 1.0,
      metadata: dep.metadata
    }));

    res.json({
      focalModel: {
        id: focalModel.id,
        name: focalModel.name,
        type: focalModel.object_type
      },
      nodes,
      edges,
      metadata: {
        connectionId,
        totalModels: nodes.length,
        totalDependencies: edges.length,
        upstreamCount: upstreamModels.length,
        downstreamCount: downstreamModels.length
      }
    });

  } catch (error: any) {
    console.error('[FocusedLineage] ❌ Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
