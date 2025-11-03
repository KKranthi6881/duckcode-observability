import { supabase } from '../config/supabaseClient';

export interface SchemaItem { schema_name: string; object_count: number }
export interface ObjectItem { id: string; name: string; schema_name: string | null; database_name: string | null; object_type: string }
export interface ColumnItem { name: string; data_type: string | null; is_nullable: boolean | null; position: number | null }

class SnowflakeMetadataService {
  async listSchemas(connectorId: string): Promise<SchemaItem[]> {
    // Fetch schema names and compute counts client-side (simple and RLS-safe)
    const { data, error } = await supabase
      .schema('metadata')
      .from('objects')
      .select('schema_name')
      .eq('connector_id', connectorId)
      .not('schema_name', 'is', null)
      .limit(10000);

    if (error) throw error;
    const rows = (data as { schema_name: string | null }[]) || [];
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const key = r.schema_name || 'UNKNOWN';
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([schema_name, object_count]) => ({ schema_name, object_count }))
      .sort((a, b) => b.object_count - a.object_count);
  }

  async listObjects(connectorId: string, schema?: string, search?: string): Promise<ObjectItem[]> {
    let query = supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, schema_name, database_name, object_type')
      .eq('connector_id', connectorId)
      .order('schema_name', { ascending: true })
      .order('name', { ascending: true });

    if (schema) query = query.eq('schema_name', schema);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return (data as ObjectItem[]) || [];
  }

  async listColumns(objectId: string): Promise<ColumnItem[]> {
    const { data, error } = await supabase
      .schema('metadata')
      .from('columns')
      .select('name, data_type, is_nullable, position')
      .eq('object_id', objectId)
      .order('position', { ascending: true });

    if (error) throw error;
    return (data as ColumnItem[]) || [];
  }
}

export const snowflakeMetadataService = new SnowflakeMetadataService();
