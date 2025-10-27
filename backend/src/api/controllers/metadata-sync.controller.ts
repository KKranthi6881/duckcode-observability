import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { supabaseDuckCode } from '../../config/supabase';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

/**
 * Get sync package with metadata for IDE
 * Returns files, objects, columns, dependencies, and column lineage
 */
export const getSyncPackage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orgId } = req.params;
    const { 
      connection_ids,
      last_sync_timestamp,
      include_documentation = 'false',
      limit: limitParam = '1000',
      offset: offsetParam = '0'
    } = req.query;
    
    const limit = parseInt(limitParam as string, 10);
    const offset = parseInt(offsetParam as string, 10);
    const includeDocumentation = include_documentation === 'true';

    console.log('[METADATA-SYNC] Getting sync package:', { 
      orgId, 
      connection_ids, 
      last_sync_timestamp,
      limit,
      offset
    });

    // Verify user has access to organization
    const userOrgId = (req.user as any)?.organization_id;
    if (!userOrgId || userOrgId !== orgId) {
      console.log('[METADATA-SYNC] Access denied. User org:', userOrgId, 'Requested:', orgId);
      return res.status(403).json({ message: 'Access denied to organization' });
    }
    
    console.log('[METADATA-SYNC] Access granted for user org:', userOrgId);

    // Parse connection IDs
    const connectionIds = connection_ids 
      ? (Array.isArray(connection_ids) ? connection_ids : [connection_ids])
      : null;

    // Fetch files with proper query builder
    let filesQuery = supabaseDuckCode
      .schema('metadata')
      .from('files')
      .select('id, repository_id, organization_id, connection_id, relative_path, absolute_path, file_type, dialect, size_bytes, file_hash, parsed_at, parser_used, parse_confidence, created_at, updated_at')
      .eq('organization_id', orgId);

    // Add connection filter if specified
    if (connectionIds && connectionIds.length > 0) {
      filesQuery = filesQuery.in('connection_id', connectionIds);
    }

    // Add incremental sync filter if timestamp provided
    if (last_sync_timestamp) {
      filesQuery = filesQuery.gte('updated_at', last_sync_timestamp);
    }

    const { data: files, error: filesError } = await filesQuery
      .range(offset, offset + limit - 1)
      .order('updated_at', { ascending: false });

    if (filesError) {
      console.error('[METADATA-SYNC] Error fetching files:', filesError);
      return res.status(500).json({ message: 'Error fetching files', error: filesError });
    }

    // Fetch objects with proper query builder
    let objectsQuery = supabaseDuckCode
      .schema('metadata')
      .from('objects')
      .select(`
        id, file_id, repository_id, organization_id, connection_id,
        name, schema_name, database_name, full_name, object_type, 
        definition, description, metadata, line_start, line_end,
        content_hash, confidence, extracted_from, extraction_tier,
        created_at, updated_at
      `)
      .eq('organization_id', orgId);

    // Add connection filter if specified
    if (connectionIds && connectionIds.length > 0) {
      objectsQuery = objectsQuery.in('connection_id', connectionIds);
    }

    // Add incremental sync filter if timestamp provided
    if (last_sync_timestamp) {
      objectsQuery = objectsQuery.gte('updated_at', last_sync_timestamp);
    }

    const { data: objects, error: objectsError } = await objectsQuery
      .range(offset, offset + limit - 1)
      .order('updated_at', { ascending: false });

    if (objectsError) {
      console.error('[METADATA-SYNC] Error fetching objects:', objectsError);
      return res.status(500).json({ message: 'Error fetching objects', error: objectsError });
    }

    // Get object IDs for related data
    const objectIds = objects?.map(o => o.id) || [];

    // Fetch columns in batches to avoid URI too long error
    const columns: any[] = [];
    const batchSize = 100;
    for (let i = 0; i < objectIds.length; i += batchSize) {
      const batchIds = objectIds.slice(i, i + batchSize);
      const { data: batchColumns, error: columnsError } = await supabaseDuckCode
        .schema('metadata')
        .from('columns')
        .select('id, object_id, name, data_type, is_nullable, is_primary_key, is_foreign_key, default_value, description, position, metadata')
        .in('object_id', batchIds);

      if (columnsError) {
        console.error('[METADATA-SYNC] Error fetching columns batch:', columnsError);
        return res.status(500).json({ message: 'Error fetching columns', error: columnsError });
      }
      if (batchColumns) {
        columns.push(...batchColumns);
      }
    }

    // Fetch dependencies in batches
    const dependencies: any[] = [];
    for (let i = 0; i < objectIds.length; i += batchSize) {
      const batchIds = objectIds.slice(i, i + batchSize);
      const { data: batchDeps } = await supabaseDuckCode
        .schema('metadata')
        .from('dependencies')
        .select(`
          id, source_object_id, target_object_id, dependency_type,
          column_level, source_column, target_column, expression, confidence, metadata
        `)
        .or(`source_object_id.in.(${batchIds.join(',')}),target_object_id.in.(${batchIds.join(',')})`)
        .eq('organization_id', orgId);

      if (batchDeps) {
        dependencies.push(...batchDeps);
      }
    }

    // Fetch column lineage in batches
    const columnsLineage: any[] = [];
    for (let i = 0; i < objectIds.length; i += batchSize) {
      const batchIds = objectIds.slice(i, i + batchSize);
      const { data: batchLineage } = await supabaseDuckCode
        .schema('metadata')
        .from('columns_lineage')
        .select(`
          id, source_object_id, source_column, target_object_id, target_column,
          expression, transformation_type, confidence, extracted_from
        `)
        .or(`source_object_id.in.(${batchIds.join(',')}),target_object_id.in.(${batchIds.join(',')})`)
        .eq('organization_id', orgId);

      if (batchLineage) {
        columnsLineage.push(...batchLineage);
      }
    }

    // Optionally fetch AI documentation in batches
    const documentation: any[] = [];
    if (includeDocumentation && objectIds.length > 0) {
      for (let i = 0; i < objectIds.length; i += batchSize) {
        const batchIds = objectIds.slice(i, i + batchSize);
        const { data: docs, error: docsError } = await supabaseDuckCode
          .schema('metadata')
          .from('object_documentation')
          .select('*')
          .in('object_id', batchIds);

        if (docsError) {
          console.error('[METADATA-SYNC] Error fetching documentation batch:', docsError);
        } else if (docs) {
          documentation.push(...docs);
        }
      }
    }

    // Build sync package response
    const syncPackage = {
      metadata: {
        files: files || [],
        objects: objects || [],
        columns: columns || [],
        dependencies: dependencies || [],
        columns_lineage: columnsLineage || []
      },
      documentation: documentation || [],
      sync_metadata: {
        organization_id: orgId,
        connection_ids: connectionIds,
        object_count: objects?.length || 0,
        file_count: files?.length || 0,
        timestamp: new Date().toISOString(),
        incremental: !!last_sync_timestamp
      }
    };

    console.log('[METADATA-SYNC] Sync package prepared:', {
      files: files?.length || 0,
      objects: objects?.length || 0,
      columns: columns?.length || 0,
      dependencies: dependencies?.length || 0,
      columns_lineage: columnsLineage?.length || 0,
      documentation: documentation?.length || 0
    });

    return res.status(200).json(syncPackage);

  } catch (error) {
    console.error('[METADATA-SYNC] Error in getSyncPackage:', error);
    return res.status(500).json({ message: 'Internal server error', error: String(error) });
  }
};

/**
 * Match workspace connections based on workspace identifier
 * Returns matched, suggested, and other connections
 */
export const matchWorkspaceConnections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orgId } = req.params;
    const { workspace_identifier } = req.body;

    console.log('[METADATA-SYNC] Matching workspace connections:', { orgId, workspace_identifier });

    // Verify user has access to organization
    const userOrgId = (req.user as any)?.organization_id;
    if (!userOrgId || userOrgId !== orgId) {
      console.log('[METADATA-SYNC] Access denied. User org:', userOrgId, 'Requested:', orgId);
      return res.status(403).json({ message: 'Access denied to organization' });
    }
    
    console.log('[METADATA-SYNC] Access granted for user org:', userOrgId);

    // Get all connections for the organization from enterprise schema
    const { data: connections, error: connectionsError } = await supabaseDuckCode
      .schema('enterprise')
      .from('github_connections')
      .select('id, repository_name, repository_owner, repository_url, status, total_objects, last_extraction_at')
      .eq('organization_id', orgId)
      .eq('status', 'completed');

    if (connectionsError) {
      console.error('[METADATA-SYNC] Error fetching connections:', connectionsError);
      return res.status(500).json({ message: 'Error fetching connections', error: connectionsError });
    }

    // Match connections based on workspace identifier
    // Format: "owner/repo" or just "repo"
    const matched_connections = [];
    const suggested_connections = [];
    const other_connections = [];

    for (const conn of connections || []) {
      const repoIdentifier = `${conn.repository_owner}/${conn.repository_name}`;
      const repoName = conn.repository_name;

      // Exact match
      if (workspace_identifier === repoIdentifier || workspace_identifier === repoName) {
        matched_connections.push({
          id: conn.id,
          type: 'github',
          name: repoName,
          full_name: repoIdentifier,
          status: conn.status,
          object_count: conn.total_objects,
          last_extracted_at: conn.last_extraction_at
        });
      }
      // Partial match (suggested)
      else if (repoIdentifier.includes(workspace_identifier) || workspace_identifier.includes(repoName)) {
        suggested_connections.push({
          id: conn.id,
          type: 'github',
          name: repoName,
          full_name: repoIdentifier,
          reason: 'Name similarity',
          status: conn.status,
          object_count: conn.total_objects,
          last_extracted_at: conn.last_extraction_at
        });
      }
      // No match
      else {
        other_connections.push({
          id: conn.id,
          type: 'github',
          name: repoName,
          full_name: repoIdentifier,
          status: conn.status,
          object_count: conn.total_objects,
          last_extracted_at: conn.last_extraction_at
        });
      }
    }

    console.log('[METADATA-SYNC] Workspace matching complete:', {
      matched: matched_connections.length,
      suggested: suggested_connections.length,
      other: other_connections.length
    });

    return res.status(200).json({
      matched_connections,
      suggested_connections,
      other_connections
    });

  } catch (error) {
    console.error('[METADATA-SYNC] Error in matchWorkspaceConnections:', error);
    return res.status(500).json({ message: 'Internal server error', error: String(error) });
  }
};

/**
 * Get all available connections for an organization
 */
export const getConnections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId } = req.params;

    console.log('[METADATA-SYNC] Getting connections for org:', orgId);

    // Verify user has access to organization
    // Check if user's organization matches the requested orgId
    const userOrgId = (req.user as any)?.organization_id;
    if (!userOrgId || userOrgId !== orgId) {
      console.log('[METADATA-SYNC] Access denied. User org:', userOrgId, 'Requested:', orgId);
      return res.status(403).json({ message: 'Access denied to organization' });
    }
    
    console.log('[METADATA-SYNC] Access granted for user org:', userOrgId);

    // Get GitHub connections from enterprise schema
    const { data: githubConns, error: githubError } = await supabaseDuckCode
      .schema('enterprise')
      .from('github_connections')
      .select('id, repository_name, repository_owner, repository_url, status, total_objects, last_extraction_at')
      .eq('organization_id', orgId);

    if (githubError) {
      console.error('[METADATA-SYNC] Error fetching GitHub connections:', githubError);
      return res.status(500).json({ message: 'Error fetching connections', error: githubError });
    }

    const connections = (githubConns || []).map(conn => ({
      id: conn.id,
      type: 'github',
      name: conn.repository_name,
      full_name: `${conn.repository_owner}/${conn.repository_name}`,
      url: conn.repository_url,
      status: conn.status,
      object_count: conn.total_objects,
      last_extracted_at: conn.last_extraction_at
    }));

    console.log('[METADATA-SYNC] Found connections:', connections.length);

    return res.status(200).json({ connections });

  } catch (error) {
    console.error('[METADATA-SYNC] Error in getConnections:', error);
    return res.status(500).json({ message: 'Internal server error', error: String(error) });
  }
};

/**
 * Get AI documentation for objects
 */
export const getDocumentation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orgId } = req.params;
    const { connection_ids, object_ids } = req.query;

    console.log('[METADATA-SYNC] Getting documentation:', { orgId, connection_ids, object_ids });

    // Verify user has access to organization
    const userOrgId = (req.user as any)?.organization_id;
    if (!userOrgId || userOrgId !== orgId) {
      console.log('[METADATA-SYNC] Access denied. User org:', userOrgId, 'Requested:', orgId);
      return res.status(403).json({ message: 'Access denied to organization' });
    }
    
    console.log('[METADATA-SYNC] Access granted for user org:', userOrgId);

    // Build query
    let query = supabaseDuckCode
      .schema('metadata')
      .from('object_documentation')
      .select(`
        id, object_id, 
        executive_summary, business_narrative, 
        transformation_cards, code_explanations, 
        business_rules, impact_analysis,
        generated_at, model,
        objects (name, full_name, object_type, file_id, files(relative_path))
      `)
      .eq('objects.organization_id', orgId);

    // Filter by connection IDs if provided
    if (connection_ids) {
      const connIds = Array.isArray(connection_ids) ? connection_ids : [connection_ids];
      // Would need to join through objects to connection_id
      // For now, filter by object_ids
    }

    // Filter by object IDs if provided
    if (object_ids) {
      const objIds = Array.isArray(object_ids) ? object_ids : [object_ids];
      query = query.in('object_id', objIds);
    }

    const { data: documentation, error: docsError } = await query;

    if (docsError) {
      console.error('[METADATA-SYNC] Error fetching documentation:', docsError);
      return res.status(500).json({ message: 'Error fetching documentation', error: docsError });
    }

    console.log('[METADATA-SYNC] Documentation fetched:', documentation?.length || 0);

    return res.status(200).json({ documentation: documentation || [] });

  } catch (error) {
    console.error('[METADATA-SYNC] Error in getDocumentation:', error);
    return res.status(500).json({ message: 'Internal server error', error: String(error) });
  }
};

/**
 * Register or update IDE sync session
 */
export const registerSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orgId } = req.params;
    const {
      workspace_identifier,
      workspace_hash,
      ide_version,
      sync_mode,
      connection_ids
    } = req.body;

    console.log('[METADATA-SYNC] Registering IDE session:', { 
      orgId, 
      workspace_identifier,
      sync_mode
    });

    // Verify user has access to organization
    const userOrgId = (req.user as any)?.organization_id;
    if (!userOrgId || userOrgId !== orgId) {
      console.log('[METADATA-SYNC] Access denied. User org:', userOrgId, 'Requested:', orgId);
      return res.status(403).json({ message: 'Access denied to organization' });
    }
    
    console.log('[METADATA-SYNC] Access granted for user org:', userOrgId);

    // Call helper function to upsert session
    const { data: sessionId, error: sessionError } = await supabaseDuckCode
      .rpc('upsert_ide_sync_session', {
        p_organization_id: orgId,
        p_workspace_identifier: workspace_identifier,
        p_workspace_hash: workspace_hash,
        p_ide_version: ide_version,
        p_sync_mode: sync_mode || 'workspace-aware',
        p_connection_ids: connection_ids || []
      });

    if (sessionError) {
      console.error('[METADATA-SYNC] Error registering session:', sessionError);
      return res.status(500).json({ message: 'Error registering session', error: sessionError });
    }

    console.log('[METADATA-SYNC] Session registered:', sessionId);

    return res.status(200).json({ 
      session_id: sessionId,
      message: 'Session registered successfully'
    });

  } catch (error) {
    console.error('[METADATA-SYNC] Error in registerSession:', error);
    return res.status(500).json({ message: 'Internal server error', error: String(error) });
  }
};
