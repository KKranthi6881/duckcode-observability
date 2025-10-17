import { supabase } from '../../../config/supabase';

/**
 * Dependency Analyzer
 * Resolves cross-file dependencies and builds dependency graph
 */
export class DependencyAnalyzer {
  
  async analyzeDependencies(orgId: string, connId: string): Promise<void> {
    console.log('🕸️ Analyzing dependencies...');
    
    // Get all objects for this connection
    const { data: objects, error } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, full_name, definition, object_type')
      .eq('organization_id', orgId)
      .eq('connection_id', connId);

    if (error || !objects) {
      console.error('Failed to fetch objects:', error);
      return;
    }

    // Build name lookup map
    const nameMap = new Map<string, string>();
    for (const obj of objects) {
      nameMap.set(obj.name.toLowerCase(), obj.id);
      if (obj.full_name) {
        nameMap.set(obj.full_name.toLowerCase(), obj.id);
      }
    }

    // Analyze each object's definition
    for (const obj of objects) {
      if (!obj.definition) continue;
      
      const dependencies = this.extractDependenciesFromSQL(obj.definition);
      
      for (const depName of dependencies) {
        const targetId = nameMap.get(depName.toLowerCase());
        if (targetId && targetId !== obj.id) {
          // Store dependency
          await supabase
            .schema('metadata')
            .from('dependencies')
            .insert({
              organization_id: orgId,
              source_object_id: obj.id,
              target_object_id: targetId,
              dependency_type: 'select',
              confidence: 0.8
            })
            .select();
        }
      }
    }

    console.log(`✅ Analyzed ${objects.length} objects for dependencies`);
  }

  private extractDependenciesFromSQL(sql: string): string[] {
    const dependencies: Set<string> = new Set();
    
    // FROM/JOIN patterns
    const fromRegex = /(?:FROM|JOIN)\s+(?:(\w+)\.)?(\w+)/gi;
    let match;
    
    while ((match = fromRegex.exec(sql)) !== null) {
      const [, schema, table] = match;
      if (table && !this.isKeyword(table)) {
        dependencies.add(schema ? `${schema}.${table}` : table);
      }
    }
    
    // DBT ref() pattern
    const refRegex = /\{\{\s*ref\(['"]([\w_]+)['"]\)\s*\}\}/g;
    while ((match = refRegex.exec(sql)) !== null) {
      dependencies.add(match[1]);
    }
    
    return Array.from(dependencies);
  }

  private isKeyword(word: string): boolean {
    const keywords = ['SELECT', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'EXCEPT', 'INTERSECT'];
    return keywords.includes(word.toUpperCase());
  }
}
