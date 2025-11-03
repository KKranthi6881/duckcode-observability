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

  async storeObject(objectData: any): Promise<any> {
    console.log(`[STORAGE] Attempting to insert object: ${objectData.name}`);
    
    const { data, error } = await supabase
      .schema('metadata')
      .from('objects')
      .insert(objectData)
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
