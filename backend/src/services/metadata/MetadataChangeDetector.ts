import { supabaseAdmin } from '../../config/supabase';

/**
 * Interface for change detection results
 */
export interface ChangeReport {
  added: Array<{
    id: string;
    name: string;
    object_type: string;
    content_hash: string;
  }>;
  modified: Array<{
    id: string;
    name: string;
    object_type: string;
    old_hash: string;
    new_hash: string;
  }>;
  deleted: Array<{
    id: string;
    name: string;
    object_type: string;
  }>;
  unchanged: Array<{
    id: string;
    name: string;
  }>;
  summary: {
    totalChanges: number;
    addedCount: number;
    modifiedCount: number;
    deletedCount: number;
    unchangedCount: number;
  };
}

/**
 * Service to detect changes in metadata objects
 * Compares old vs new metadata to identify what changed
 */
export class MetadataChangeDetector {
  
  /**
   * Detect changes in metadata after extraction
   * Takes a snapshot before extraction and compares with current state
   */
  async detectChanges(
    connectionId: string,
    organizationId: string
  ): Promise<ChangeReport> {
    console.log(`[ChangeDetector] Detecting changes for connection: ${connectionId}`);

    try {
      // Get current objects (after extraction)
      const { data: currentObjects, error: currentError } = await supabaseAdmin
        .schema('metadata')
        .from('objects')
        .select('id, name, object_type, content_hash')
        .eq('connection_id', connectionId);

      if (currentError) {
        console.error('[ChangeDetector] Error fetching current objects:', currentError);
        throw currentError;
      }

      // Get previous snapshot (objects that existed before this extraction)
      // We use updated_at or a separate snapshot table if we implement it
      // For now, we'll compare with objects that have different content_hash
      // This is a simplified version - in production you'd want a snapshot table
      
      const changes: ChangeReport = {
        added: [],
        modified: [],
        deleted: [],
        unchanged: [],
        summary: {
          totalChanges: 0,
          addedCount: 0,
          modifiedCount: 0,
          deletedCount: 0,
          unchangedCount: 0
        }
      };

      // For this implementation, we'll mark objects that need documentation update
      // based on their creation time (new) or updated time (modified)
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      for (const obj of currentObjects || []) {
        // Check if object was created recently (new)
        const { data: objDetails } = await supabaseAdmin
          .schema('metadata')
          .from('objects')
          .select('created_at, updated_at')
          .eq('id', obj.id)
          .single();

        if (objDetails) {
          const createdAt = new Date(objDetails.created_at);
          const updatedAt = new Date(objDetails.updated_at || objDetails.created_at);

          if (createdAt > fiveMinutesAgo) {
            // Newly added object
            changes.added.push({
              id: obj.id,
              name: obj.name,
              object_type: obj.object_type,
              content_hash: obj.content_hash || ''
            });
          } else if (updatedAt > fiveMinutesAgo && updatedAt > createdAt) {
            // Modified object (updated recently)
            changes.modified.push({
              id: obj.id,
              name: obj.name,
              object_type: obj.object_type,
              old_hash: '',
              new_hash: obj.content_hash || ''
            });
          } else {
            // Unchanged
            changes.unchanged.push({
              id: obj.id,
              name: obj.name
            });
          }
        }
      }

      // Calculate summary
      changes.summary = {
        totalChanges: changes.added.length + changes.modified.length + changes.deleted.length,
        addedCount: changes.added.length,
        modifiedCount: changes.modified.length,
        deletedCount: changes.deleted.length,
        unchangedCount: changes.unchanged.length
      };

      console.log(`[ChangeDetector] Changes detected:`, changes.summary);
      console.log(`[ChangeDetector] Added: ${changes.added.map(o => o.name).join(', ') || 'none'}`);
      console.log(`[ChangeDetector] Modified: ${changes.modified.map(o => o.name).join(', ') || 'none'}`);

      return changes;

    } catch (error) {
      console.error('[ChangeDetector] Error detecting changes:', error);
      throw error;
    }
  }

  /**
   * Check if documentation exists for an object
   */
  async hasDocumentation(objectId: string, organizationId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin
      .schema('metadata')
      .from('object_documentation')
      .select('id')
      .eq('object_id', objectId)
      .eq('organization_id', organizationId)
      .eq('is_current', true)
      .single();

    return !error && !!data;
  }

  /**
   * Filter changes to only include objects that need documentation updates
   * (i.e., objects that already have documentation or should have it)
   */
  async filterDocumentableChanges(
    changes: ChangeReport,
    organizationId: string
  ): Promise<string[]> {
    const objectsToDocument: string[] = [];

    // Check which changed objects already have documentation
    const changedObjects = [...changes.added, ...changes.modified];
    
    for (const obj of changedObjects) {
      const hasDoc = await this.hasDocumentation(obj.id, organizationId);
      
      // Update documentation for:
      // 1. Objects that already have documentation (modified)
      // 2. New objects (to be decided by user or auto-generate)
      if (hasDoc || changes.modified.some(m => m.id === obj.id)) {
        objectsToDocument.push(obj.id);
      }
    }

    console.log(`[ChangeDetector] Objects needing doc updates: ${objectsToDocument.length}`);
    return objectsToDocument;
  }
}
