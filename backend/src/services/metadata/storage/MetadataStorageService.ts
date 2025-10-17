import { supabase } from '../../../config/supabase';

/**
 * Metadata Storage Service
 * Handles all writes to Supabase metadata schema
 */
export class MetadataStorageService {
  
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
    const { data, error } = await supabase
      .schema('metadata')
      .from('objects')
      .insert(objectData)
      .select()
      .single();

    if (error) {
      console.error('Error storing object:', error);
      throw error;
    }

    return data;
  }

  async storeColumns(objectId: string, columns: any[]): Promise<void> {
    if (!columns || columns.length === 0) return;

    const columnsData = columns.map(col => ({
      object_id: objectId,
      organization_id: null, // Will be set by trigger or need to pass
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
      throw error;
    }
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
