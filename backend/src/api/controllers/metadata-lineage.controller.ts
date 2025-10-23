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
    async function getUpstreamModels(startId: string, limit: number, visited = new Set<string>(), countOnly = false): Promise<any[]> {
      if (visited.has(startId)) return [];
      
      // If counting, don't apply limit
      if (!countOnly && visited.size >= limit) return [];
      
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
      
      // Recursively get more upstream
      for (const model of results) {
        if (countOnly || visited.size < limit) {
          const moreUpstream = await getUpstreamModels(model.id, limit, visited, countOnly);
          results.push(...moreUpstream);
        }
      }

      return results;
    }

    // Recursive function to get downstream models
    async function getDownstreamModels(startId: string, limit: number, visited = new Set<string>(), countOnly = false): Promise<any[]> {
      if (visited.has(startId)) return [];
      
      // If counting, don't apply limit
      if (!countOnly && visited.size >= limit) return [];
      
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
      
      // Recursively get more downstream
      for (const model of results) {
        if (countOnly || visited.size < limit) {
          const moreDownstream = await getDownstreamModels(model.id, limit, visited, countOnly);
          results.push(...moreDownstream);
        }
      }

      return results;
    }

    // Get upstream and downstream models with limits
    const upstreamModels = await getUpstreamModels(modelId, Number(upstreamLimit));
    const downstreamModels = await getDownstreamModels(modelId, Number(downstreamLimit));

    // Count total available (without limits) for metadata
    const totalUpstreamModels = await getUpstreamModels(modelId, 9999, new Set(), true);
    const totalDownstreamModels = await getDownstreamModels(modelId, 9999, new Set(), true);
    
    const totalUpstreamCount = totalUpstreamModels.length;
    const totalDownstreamCount = totalDownstreamModels.length;
    const hasMoreUpstream = totalUpstreamCount > upstreamModels.length;
    const hasMoreDownstream = totalDownstreamCount > downstreamModels.length;

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

    // Get file paths for models
    const fileIds = uniqueModels.map(m => m.file_id).filter(Boolean);
    const { data: files } = await supabase
      .schema('metadata')
      .from('files')
      .select('id, relative_path')
      .in('id', fileIds);
    
    const fileMap = new Map(files?.map(f => [f.id, f.relative_path]) || []);

    const nodes = uniqueModels.map(model => ({
      id: model.id,
      name: model.name,
      type: model.object_type,
      description: model.description,
      filePath: fileMap.get(model.file_id),
      updatedAt: model.updated_at,
      extractionTier: model.extraction_tier,
      extractedFrom: model.extracted_from,
      confidence: model.confidence,
      metadata: model.metadata,
      stats: modelStats.get(model.id) || { upstreamCount: 0, downstreamCount: 0 },
      isFocal: model.id === modelId
    }));

    const edges = (allDeps || []).map(dep => ({
      id: dep.id,
      source: dep.source_object_id,
      target: dep.target_object_id,
      type: dep.dependency_type,
      confidence: dep.confidence || 1.0,
      metadata: dep.metadata,
      expression: dep.expression
    }));

    console.log(`[FocusedLineage] ✅ Returning: ${upstreamModels.length}/${totalUpstreamCount} upstream, ${downstreamModels.length}/${totalDownstreamCount} downstream`);

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
        downstreamCount: downstreamModels.length,
        totalUpstreamCount,
        totalDownstreamCount,
        hasMoreUpstream,
        hasMoreDownstream
      }
    });

  } catch (error: any) {
    console.error('[FocusedLineage] ❌ Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get lineage for a specific file path
 * This is the primary endpoint for file-specific lineage in the CodeBase UI
 */
export async function getLineageByFilePath(req: AuthenticatedRequest, res: Response) {
  try {
    const { connectionId } = req.params;
    const { filePath, upstreamLimit = '4', downstreamLimit = '4' } = req.query;
    const organizationId = req.user.organization_id;

    console.log('===================== BACKEND FILE LINEAGE DEBUG =====================');
    console.log(`[FileLineage] Connection ID received: ${connectionId}`);
    console.log(`[FileLineage] File path received: ${filePath}`);
    console.log(`[FileLineage] Upstream limit: ${upstreamLimit}, Downstream limit: ${downstreamLimit}`);
    console.log(`[FileLineage] Organization ID: ${organizationId}`);
    console.log('=====================================================================');

    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath query parameter is required' });
    }

    const upLimit = parseInt(upstreamLimit as string, 10);
    const downLimit = parseInt(downstreamLimit as string, 10);

    // Step 0: Get the metadata repository_id from the connection_id
    const { data: metadataRepo, error: repoError } = await supabase
      .schema('metadata')
      .from('repositories')
      .select('id')
      .eq('connection_id', connectionId)
      .eq('organization_id', organizationId)
      .single();

    if (repoError || !metadataRepo) {
      console.log(`[FileLineage] ❌ Metadata repository not found for connection: ${connectionId}`);
      console.log(`[FileLineage] Error:`, repoError);
      return res.status(404).json({ 
        error: 'Repository not found in metadata',
        message: 'This repository has not been processed for metadata extraction yet.',
        connectionId 
      });
    }

    const repositoryId = metadataRepo.id;
    console.log(`[FileLineage] ✅ Found metadata repository ID: ${repositoryId}`);

    // Step 1: Find the file in metadata
    // Try exact match first
    let { data: file, error: fileError } = await supabase
      .schema('metadata')
      .from('files')
      .select('id, relative_path, file_type')
      .eq('repository_id', repositoryId)
      .eq('relative_path', filePath)
      .eq('organization_id', organizationId)
      .single();

    // If exact match fails, try matching by filename only
    // (dbt manifest stores flat paths like "models/file.sql" without subdirectories)
    if (fileError || !file) {
      const fileName = filePath.split('/').pop();
      console.log(`[FileLineage] ⚠️  Exact path not found, trying filename match: ${fileName}`);
      console.log(`[FileLineage] File error:`, fileError);
      
      const { data: filesByName, error: nameError } = await supabase
        .schema('metadata')
        .from('files')
        .select('id, relative_path, file_type')
        .eq('repository_id', repositoryId)
        .ilike('relative_path', `%${fileName}`)
        .eq('organization_id', organizationId);

      console.log(`[FileLineage] Files found by name (${fileName}):`, filesByName?.length || 0);
      if (filesByName && filesByName.length > 0) {
        console.log('[FileLineage] Matching files:', filesByName.map(f => f.relative_path));
      }

      if (nameError || !filesByName || filesByName.length === 0) {
        console.log(`[FileLineage] ❌ File not found by name either: ${fileName}`);
        console.log(`[FileLineage] Name error:`, nameError);
        return res.status(404).json({ 
          error: 'File not found in metadata',
          message: 'This file has not been processed yet or does not exist in the repository.',
          filePath,
          fileName
        });
      }

      // If multiple files match, prefer exact filename match
      file = filesByName.find(f => f.relative_path.endsWith(`/${fileName}`)) || filesByName[0];
      console.log(`[FileLineage] ✅ Found file by name: ${file.relative_path} (ID: ${file.id})`);
    } else {
      console.log(`[FileLineage] ✅ Found file by exact path: ${file.relative_path} (ID: ${file.id})`);
    }

    // Step 2: Get all objects from this file
    const { data: objects, error: objectsError } = await supabase
      .schema('metadata')
      .from('objects')
      .select(`
        id,
        name,
        full_name,
        schema_name,
        database_name,
        object_type,
        description,
        metadata,
        confidence
      `)
      .eq('file_id', file.id)
      .eq('organization_id', organizationId)
      .order('name');

    if (objectsError) {
      console.error('[FileLineage] Error fetching objects:', objectsError);
      return res.status(500).json({ error: 'Failed to fetch objects from file' });
    }

    if (!objects || objects.length === 0) {
      console.log(`[FileLineage] No objects found in file: ${filePath}`);
      return res.status(404).json({ 
        error: 'No objects found in this file',
        message: 'This file does not contain any extractable database objects (tables, views, models).',
        file: {
          id: file.id,
          path: file.relative_path,
          name: file.relative_path.split('/').pop() || file.relative_path
        }
      });
    }

    console.log(`[FileLineage] Found ${objects.length} objects in file`);

    const objectIds = objects.map(o => o.id);

    // Step 3: Get upstream dependencies (what this file depends on) - LIMITED
    // First get total count
    const { count: totalUpstreamCount } = await supabase
      .schema('metadata')
      .from('dependencies')
      .select('id', { count: 'exact', head: true })
      .in('target_object_id', objectIds)
      .eq('organization_id', organizationId);

    const { data: upstreamDeps, error: upstreamError } = await supabase
      .schema('metadata')
      .from('dependencies')
      .select(`
        id,
        source_object_id,
        target_object_id,
        dependency_type,
        confidence,
        metadata,
        expression
      `)
      .in('target_object_id', objectIds)
      .eq('organization_id', organizationId)
      .limit(upLimit);

    if (upstreamError) {
      console.error('[FileLineage] Error fetching upstream deps:', upstreamError);
    }

    // Step 4: Get downstream dependencies (what depends on this file) - LIMITED
    // First get total count
    const { count: totalDownstreamCount } = await supabase
      .schema('metadata')
      .from('dependencies')
      .select('id', { count: 'exact', head: true })
      .in('source_object_id', objectIds)
      .eq('organization_id', organizationId);

    const { data: downstreamDeps, error: downstreamError } = await supabase
      .schema('metadata')
      .from('dependencies')
      .select(`
        id,
        source_object_id,
        target_object_id,
        dependency_type,
        confidence,
        metadata,
        expression
      `)
      .in('source_object_id', objectIds)
      .eq('organization_id', organizationId)
      .limit(downLimit);

    if (downstreamError) {
      console.error('[FileLineage] Error fetching downstream deps:', downstreamError);
    }

    const hasMoreUpstream = (totalUpstreamCount || 0) > upLimit;
    const hasMoreDownstream = (totalDownstreamCount || 0) > downLimit;
    
    console.log(`[FileLineage] Upstream: ${upstreamDeps?.length || 0}/${totalUpstreamCount || 0}, Downstream: ${downstreamDeps?.length || 0}/${totalDownstreamCount || 0}`);

    // Step 5: Combine and deduplicate nodes
    const allDeps = [...(upstreamDeps || []), ...(downstreamDeps || [])];
    console.log(`[FileLineage] Total dependencies: ${allDeps.length} (${upstreamDeps?.length || 0} upstream, ${downstreamDeps?.length || 0} downstream)`);
    
    const nodeMap = new Map();

    // Add focal objects (from the clicked file)
    const fileName = file.relative_path.split('/').pop() || file.relative_path;
    objects.forEach(obj => {
      nodeMap.set(obj.id, { 
        ...obj, 
        isFocal: true, 
        filePath: file.relative_path,
        fileName: fileName
      });
    });

    console.log(`[FileLineage] Added ${objects.length} focal objects to nodeMap`);

    // Add related objects from dependencies
    // We need to fetch the related objects separately since Supabase joins aren't working
    const relatedObjectIds = new Set<string>();
    allDeps.forEach(dep => {
      // Add source object IDs (for upstream dependencies)
      if (dep.source_object_id && !objectIds.includes(dep.source_object_id)) {
        relatedObjectIds.add(dep.source_object_id);
      }
      // Add target object IDs (for downstream dependencies)
      if (dep.target_object_id && !objectIds.includes(dep.target_object_id)) {
        relatedObjectIds.add(dep.target_object_id);
      }
    });

    console.log(`[FileLineage] Found ${relatedObjectIds.size} related object IDs from dependencies`);

    // Fetch all related objects in one query
    if (relatedObjectIds.size > 0) {
      const { data: relatedObjects, error: relatedError } = await supabase
        .schema('metadata')
        .from('objects')
        .select(`
          id,
          name,
          full_name,
          object_type,
          description,
          file_id,
          metadata,
          confidence
        `)
        .in('id', Array.from(relatedObjectIds))
        .eq('organization_id', organizationId);

      if (relatedError) {
        console.error('[FileLineage] Error fetching related objects:', relatedError);
      } else {
        console.log(`[FileLineage] Fetched ${relatedObjects?.length || 0} related objects`);
        relatedObjects?.forEach(obj => {
          if (!nodeMap.has(obj.id)) {
            nodeMap.set(obj.id, { 
              ...obj, 
              isFocal: false 
            });
          }
        });
      }
    }

    // Get file paths for all related objects
    const allFileIds = Array.from(nodeMap.values())
      .map(n => n.file_id)
      .filter(Boolean);
    
    const { data: relatedFiles } = await supabase
      .schema('metadata')
      .from('files')
      .select('id, relative_path, file_name')
      .in('id', allFileIds);

    const filePathMap = new Map(
      relatedFiles?.map(f => [f.id, { path: f.relative_path, name: f.file_name }]) || []
    );

    // Enrich nodes with file paths
    const enrichedNodes = Array.from(nodeMap.values()).map(node => ({
      ...node,
      filePath: node.filePath || filePathMap.get(node.file_id)?.path,
      fileName: node.fileName || filePathMap.get(node.file_id)?.name
    }));

    const edges = allDeps.map(dep => ({
      id: dep.id,
      source: dep.source_object_id,
      target: dep.target_object_id,
      type: dep.dependency_type,
      confidence: dep.confidence || 1.0,
      metadata: dep.metadata,
      expression: dep.expression
    }));

    console.log(`[FileLineage] ✅ Returning ${enrichedNodes.length} nodes (${objects.length} focal, ${enrichedNodes.length - objects.length} related), ${edges.length} edges`);

    res.json({
      file: {
        id: file.id,
        path: file.relative_path,
        name: fileName,
        type: file.file_type
      },
      focalObjects: objects.map(obj => ({
        id: obj.id,
        name: obj.name,
        fullName: obj.full_name,
        type: obj.object_type
      })),
      nodes: enrichedNodes,
      edges,
      metadata: {
        connectionId,
        filePath,
        totalNodes: enrichedNodes.length,
        totalEdges: edges.length,
        focalObjectCount: objects.length,
        upstreamCount: (upstreamDeps || []).length,
        downstreamCount: (downstreamDeps || []).length,
        totalUpstreamCount: totalUpstreamCount || 0,
        totalDownstreamCount: totalDownstreamCount || 0,
        hasMoreUpstream,
        hasMoreDownstream,
        upstreamLimit: upLimit,
        downstreamLimit: downLimit
      }
    });

  } catch (error: any) {
    console.error('[FileLineage] ❌ Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
