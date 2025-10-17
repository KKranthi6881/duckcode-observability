import { supabase } from '../../../config/supabase';

/**
 * Lineage Calculator
 * Calculates column-level lineage and lineage paths
 */
export class LineageCalculator {
  
  async calculateLineage(orgId: string, connId: string): Promise<void> {
    console.log('🔗 Calculating column lineage...');
    
    // Get all objects
    const { data: objects, error } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, full_name, definition')
      .eq('organization_id', orgId)
      .eq('connection_id', connId);

    if (error || !objects) {
      console.error('Failed to fetch objects:', error);
      return;
    }

    // Get all columns for these objects
    const objectIds = objects.map(o => o.id);
    const { data: columns } = await supabase
      .schema('metadata')
      .from('columns')
      .select('id, name, data_type, object_id')
      .in('object_id', objectIds);

    // Build column map
    const columnMap = new Map<string, any[]>();
    if (columns) {
      for (const col of columns) {
        if (!columnMap.has(col.object_id)) {
          columnMap.set(col.object_id, []);
        }
        columnMap.get(col.object_id)!.push(col);
      }
    }

    // Analyze SELECT statements for column lineage
    for (const obj of objects) {
      if (!obj.definition) continue;
      
      const lineages = this.extractColumnLineage(obj, objects, columnMap);
      
      for (const lineage of lineages) {
        await supabase
          .schema('metadata')
          .from('columns_lineage')
          .insert({
            organization_id: orgId,
            source_object_id: lineage.sourceObjectId,
            source_column: lineage.sourceColumn,
            target_object_id: obj.id,
            target_column: lineage.targetColumn,
            transformation_type: lineage.transformationType,
            confidence: lineage.confidence
          })
          .select();
      }
    }

    // Calculate lineage paths
    await supabase.rpc('metadata.calculate_lineage_paths', {
      p_organization_id: orgId
    });

    console.log(`✅ Calculated column lineage for ${objects.length} objects`);
  }

  private extractColumnLineage(targetObj: any, allObjects: any[], columnMap: Map<string, any[]>): any[] {
    const lineages: any[] = [];
    
    if (!targetObj.definition) return lineages;
    
    // Simple pattern: SELECT a.col1, b.col2 FROM tableA a JOIN tableB b
    const selectRegex = /SELECT\s+([\s\S]*?)\s+FROM/i;
    const match = selectRegex.exec(targetObj.definition);
    
    if (!match) return lineages;
    
    const selectClause = match[1];
    const columns = selectClause.split(',').map(c => c.trim());
    
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      
      // Pattern: table.column or table.column AS alias
      const colMatch = col.match(/(?:(\w+)\.)?(\w+)(?:\s+AS\s+(\w+))?/i);
      if (!colMatch) continue;
      
      const [, tableAlias, sourceCol, alias] = colMatch;
      const targetCol = alias || sourceCol;
      
      // Find source object
      if (tableAlias) {
        const sourceObj = this.findObjectByAlias(targetObj.definition, tableAlias, allObjects);
        if (sourceObj) {
          lineages.push({
            sourceObjectId: sourceObj.id,
            sourceColumn: sourceCol,
            targetColumn: targetCol,
            transformationType: 'direct',
            confidence: 0.8
          });
        }
      }
    }
    
    return lineages;
  }

  private findObjectByAlias(sql: string, alias: string, objects: any[]): any | null {
    // Pattern: FROM table_name alias or JOIN table_name alias
    const regex = new RegExp(`(?:FROM|JOIN)\\s+(\\w+)\\s+${alias}\\b`, 'i');
    const match = regex.exec(sql);
    
    if (match) {
      const tableName = match[1];
      return objects.find(o => 
        o.name.toLowerCase() === tableName.toLowerCase() ||
        o.full_name?.toLowerCase() === tableName.toLowerCase()
      );
    }
    
    return null;
  }
}
