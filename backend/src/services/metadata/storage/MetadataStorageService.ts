import { supabase } from '../../../config/supabase';

/**
 * Metadata Storage Service
 * Handles all writes to Supabase metadata schema
 */
export class MetadataStorageService {
  async storeRepository(repoData: any): Promise<any> {
    const { data, error } = await supabase
      .schema('metadata')
      .from('repositories')
      .upsert(repoData, {
        onConflict: 'organization_id,path'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
  
  async storeFile(fileData: any): Promise<any> {
    const { data, error } = await supabase
      .schema('metadata')
      .from('files')
      .upsert(fileData, {
        onConflict: 'organization_id,absolute_path'
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing file:', error);
      throw error;
    }

    return data;
  }

  /**
   * Build Fully Qualified Name (FQN) for cross-source matching
   * Format: DATABASE.SCHEMA.TABLE (uppercase normalized)
   */
  private buildFQN(database?: string | null, schema?: string | null, name?: string): string {
    return [database, schema, name]
      .filter(Boolean)
      .map(s => String(s).toUpperCase())
      .join('.');
  }

  async storeObject(objectData: any): Promise<any> {
    console.log(`[STORAGE] Attempting to insert object: ${objectData.name}`);
    
    // Build FQN for cross-source matching
    const fqn = this.buildFQN(
      objectData.database_name,
      objectData.schema_name,
      objectData.name
    );
    
    // Determine source type: prefer explicit, otherwise infer from connector_id vs connection_id
    const source_type = objectData.source_type
      || (objectData.connector_id ? 'snowflake' : 'dbt');
    
    console.log(`[STORAGE] FQN: ${fqn}, source_type: ${source_type}`);
    
    const { data, error } = await supabase
      .schema('metadata')
      .from('objects')
      .insert({
        ...objectData,
        fqn,
        source_type
      })
      .select()
      .single();

    console.log(`[STORAGE] Insert result for ${objectData.name}:`, { 
      hasData: !!data, 
      hasError: !!error,
      errorDetails: error 
    });

    if (error) {
      console.error('Error storing object:', error);
      throw error;
    }

    if (!data) {
      console.error('[STORAGE] WARNING: Insert succeeded but SELECT returned null!');
      console.error('[STORAGE] This is likely an RLS issue blocking service_role SELECT');
    }

    return data;
  }

  async storeColumns(objectId: string, columns: any[], organizationId?: string): Promise<void> {
    if (!columns || columns.length === 0) return;

    const columnsData = columns.map(col => ({
      object_id: objectId,
      organization_id: organizationId || null, // FIXED: Now accepts organization_id parameter
      name: col.name,
      data_type: col.data_type,
      is_nullable: col.is_nullable,
      position: col.position
    }));

    const { error } = await supabase
      .schema('metadata')
      .from('columns')
      .insert(columnsData);

    if (error) {
      console.error('Error storing columns:', error);
      console.error('Columns data:', columnsData);
      throw error;
    }
    
    console.log(`✅ Stored ${columns.length} columns for object ${objectId}`);
  }

  async storeConstraints(objectId: string, constraints: any[], organizationId: string, objectsMap: Map<string, string>): Promise<void> {
    if (!constraints || constraints.length === 0) return;

    const constraintsData = constraints.map(c => {
      // Try to resolve referenced_object_id from the map
      let referencedObjectId = null;
      if (c.referenced_table && c.referenced_schema) {
        const refKey = `${c.referenced_schema}.${c.referenced_table}`.toUpperCase();
        referencedObjectId = objectsMap.get(refKey) || null;
      }

      return {
        object_id: objectId,
        organization_id: organizationId,
        constraint_name: c.constraint_name,
        constraint_type: c.constraint_type?.toLowerCase().replace(' ', '_'), // 'PRIMARY KEY' -> 'primary_key'
        columns: JSON.stringify(c.columns || []),
        referenced_object_id: referencedObjectId,
        referenced_columns: c.referenced_columns?.length ? JSON.stringify(c.referenced_columns) : null,
        metadata: JSON.stringify({
          update_rule: c.update_rule,
          delete_rule: c.delete_rule
        })
      };
    });

    const { error } = await supabase
      .schema('metadata')
      .from('constraints')
      .insert(constraintsData);

    if (error) {
      console.error('Error storing constraints:', error);
      console.error('Constraints data:', constraintsData);
      throw error;
    }
    
    console.log(`✅ Stored ${constraints.length} constraints for object ${objectId}`);
  }

  async storeDependency(depData: any): Promise<void> {
    const { error } = await supabase
      .schema('metadata')
      .from('dependencies')
      .insert(depData)
      .select();

    if (error && !error.message.includes('duplicate key')) {
      console.error('Error storing dependency:', error);
      throw error;
    }
  }

  async storeLineage(lineageData: any): Promise<void> {
    const { error } = await supabase
      .schema('metadata')
      .from('columns_lineage')
      .insert(lineageData)
      .select();

    if (error && !error.message.includes('duplicate key')) {
      console.error('Error storing lineage:', error);
      throw error;
    }
  }
}
