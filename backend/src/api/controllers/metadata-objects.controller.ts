/**
 * Metadata Objects Controller
 * Provides metadata objects for AI documentation generation
 */

import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';

/**
 * Get all metadata objects for an organization
 * GET /api/metadata-objects/organizations/:organizationId/objects
 */
export async function getOrganizationObjects(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify user has access to this organization
    const { data: userOrg, error: orgError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();

    if (orgError || !userOrg) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Fetch ALL objects with pagination (Supabase has 1000 row limit per request)
    let allObjects: any[] = [];
    let hasMore = true;
    let offset = 0;
    const pageSize = 1000;

    while (hasMore) {
      const { data: pageData, error: objectsError } = await supabaseAdmin
        .schema('metadata')
        .from('objects')
        .select('id, name, object_type, schema_name, definition')
        .eq('organization_id', organizationId)
        .order('name')
        .range(offset, offset + pageSize - 1);

      if (objectsError) {
        throw objectsError;
      }

      if (pageData && pageData.length > 0) {
        allObjects = allObjects.concat(pageData);
        offset += pageSize;
        hasMore = pageData.length === pageSize; // Continue if we got a full page
      } else {
        hasMore = false;
      }
    }

    const objects = allObjects;

    // Fetch documentation status
    const { data: docs } = await supabaseAdmin
      .schema('metadata')
      .from('object_documentation')
      .select('object_id')
      .eq('organization_id', organizationId)
      .eq('is_current', true);

    const documentedIds = new Set(docs?.map(d => d.object_id) || []);

    // Add documentation status to each object
    const objectsWithStatus = (objects || []).map(obj => ({
      ...obj,
      has_documentation: documentedIds.has(obj.id),
    }));

    return res.json({
      objects: objectsWithStatus,
      total: objectsWithStatus.length,
    });

  } catch (error: any) {
    console.error('[Metadata Objects API] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch objects',
      details: error.message
    });
  }
}
