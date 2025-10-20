import { supabase } from '../../../config/supabase';

/**
 * Enhanced Dependency Analyzer (Phase 2)
 * 
 * Improvements over basic analyzer:
 * - Cross-file dependency resolution
 * - Alias and CTE handling
 * - Advanced confidence scoring
 * - Fuzzy table name matching
 * - Ambiguity detection
 */

interface AnalyzedObject {
  id: string;
  name: string;
  full_name: string | null;
  definition: string | null;
  object_type: string;
  file_id: string;
}

interface DependencyMatch {
  sourceName: string;
  targetId: string;
  targetName: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'alias' | 'cte' | 'inferred';
  context?: string;
}

interface SQLContext {
  ctes: Map<string, string>; // CTE name -> definition
  aliases: Map<string, string>; // Alias -> actual table name
  tables: Set<string>; // All referenced tables
}

export class EnhancedDependencyAnalyzer {
  
  /**
   * Main analysis entry point
   */
  async analyzeDependencies(orgId: string, connId: string): Promise<void> {
    console.log('🕸️ [PHASE 2] Enhanced dependency analysis starting...');
    
    // Get all objects with file information
    const { data: objects, error } = await supabase
      .schema('metadata')
      .from('objects')
      .select('id, name, full_name, definition, object_type, file_id')
      .eq('organization_id', orgId)
      .eq('connection_id', connId);

    if (error || !objects) {
      console.error('Failed to fetch objects:', error);
      return;
    }

    console.log(`📊 Analyzing ${objects.length} objects...`);

    // Build comprehensive name index
    const nameIndex = this.buildNameIndex(objects);
    
    // Analyze each object
    let totalDependencies = 0;
    let highConfidenceDeps = 0;
    let ambiguousDeps = 0;

    for (const obj of objects) {
      if (!obj.definition) continue;
      
      try {
        const dependencies = await this.analyzeSingleObject(
          obj as AnalyzedObject,
          nameIndex,
          orgId
        );
        
        totalDependencies += dependencies.length;
        highConfidenceDeps += dependencies.filter(d => d.confidence >= 0.9).length;
        ambiguousDeps += dependencies.filter(d => d.confidence < 0.7).length;

        // Store dependencies
        await this.storeDependencies(dependencies, obj.id, orgId);
        
      } catch (error) {
        console.error(`Error analyzing object ${obj.name}:`, error);
      }
    }

    console.log(`✅ Dependency analysis complete:`);
    console.log(`   Total dependencies: ${totalDependencies}`);
    console.log(`   High confidence (≥0.9): ${highConfidenceDeps}`);
    console.log(`   Ambiguous (<0.7): ${ambiguousDeps}`);
    console.log(`   Accuracy rate: ${((highConfidenceDeps / totalDependencies) * 100).toFixed(1)}%`);
  }

  /**
   * Build comprehensive name index with multiple lookup strategies
   */
  private buildNameIndex(objects: any[]): Map<string, string[]> {
    const index = new Map<string, string[]>();
    
    for (const obj of objects) {
      // Index by exact name (lowercase)
      const exactName = obj.name.toLowerCase();
      if (!index.has(exactName)) {
        index.set(exactName, []);
      }
      index.get(exactName)!.push(obj.id);

      // Index by full_name if available
      if (obj.full_name) {
        const fullName = obj.full_name.toLowerCase();
        if (!index.has(fullName)) {
          index.set(fullName, []);
        }
        index.get(fullName)!.push(obj.id);
      }

      // Index by parts for schema.table lookups
      const parts = obj.name.split('.');
      if (parts.length > 1) {
        const tableName = parts[parts.length - 1].toLowerCase();
        if (!index.has(tableName)) {
          index.set(tableName, []);
        }
        index.get(tableName)!.push(obj.id);
      }
    }

    return index;
  }

  /**
   * Analyze a single object for dependencies
   */
  private async analyzeSingleObject(
    obj: AnalyzedObject,
    nameIndex: Map<string, string[]>,
    orgId: string
  ): Promise<DependencyMatch[]> {
    const dependencies: DependencyMatch[] = [];
    
    if (!obj.definition) return dependencies;

    // Parse SQL context (CTEs, aliases)
    const context = this.parseSQLContext(obj.definition);

    // Extract table references
    const tableRefs = this.extractTableReferences(obj.definition, context);

    // Resolve each reference
    for (const ref of tableRefs) {
      const matches = this.resolveTableReference(ref, nameIndex, context, obj.id);
      dependencies.push(...matches);
    }

    return dependencies;
  }

  /**
   * Parse SQL to extract CTEs and aliases
   */
  private parseSQLContext(sql: string): SQLContext {
    const context: SQLContext = {
      ctes: new Map(),
      aliases: new Map(),
      tables: new Set()
    };

    // Extract CTEs (WITH clauses)
    const cteRegex = /WITH\s+(\w+)\s+AS\s*\(/gi;
    let match;
    while ((match = cteRegex.exec(sql)) !== null) {
      const cteName = match[1].toLowerCase();
      context.ctes.set(cteName, match[0]);
      console.log(`   Found CTE: ${cteName}`);
    }

    // Extract table aliases
    // Pattern: FROM table_name AS alias or FROM table_name alias
    const aliasRegex = /(?:FROM|JOIN)\s+(?:(\w+)\.)?(\w+)(?:\s+AS\s+|\s+)(\w+)(?:\s|,|$)/gi;
    while ((match = aliasRegex.exec(sql)) !== null) {
      const [, schema, table, alias] = match;
      const tableName = schema ? `${schema}.${table}` : table;
      const aliasName = alias.toLowerCase();
      
      if (!this.isKeyword(alias)) {
        context.aliases.set(aliasName, tableName.toLowerCase());
        console.log(`   Found alias: ${alias} → ${tableName}`);
      }
    }

    return context;
  }

  /**
   * Extract all table references from SQL
   */
  private extractTableReferences(sql: string, context: SQLContext): string[] {
    const references: Set<string> = new Set();
    
    // Pattern 1: FROM/JOIN clauses
    const fromRegex = /(?:FROM|JOIN)\s+(?:(\w+)\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi;
    let match;
    
    while ((match = fromRegex.exec(sql)) !== null) {
      const [, schema, table, alias] = match;
      const tableName = schema ? `${schema}.${table}` : table;
      
      if (!this.isKeyword(table)) {
        // Check if it's a CTE
        if (context.ctes.has(table.toLowerCase())) {
          console.log(`   Skipping CTE reference: ${table}`);
          continue;
        }
        references.add(tableName);
      }
    }
    
    // Pattern 2: DBT ref() syntax
    const refRegex = /\{\{\s*ref\(['"]([\w_]+)['"]\)\s*\}\}/g;
    while ((match = refRegex.exec(sql)) !== null) {
      references.add(match[1]);
    }

    // Pattern 3: Subquery references (less common but possible)
    const subqueryRegex = /\(\s*SELECT\s+.*?\s+FROM\s+(?:(\w+)\.)?(\w+)/gi;
    while ((match = subqueryRegex.exec(sql)) !== null) {
      const [, schema, table] = match;
      const tableName = schema ? `${schema}.${table}` : table;
      
      if (!this.isKeyword(table) && !context.ctes.has(table.toLowerCase())) {
        references.add(tableName);
      }
    }
    
    return Array.from(references);
  }

  /**
   * Resolve a table reference to actual object(s)
   */
  private resolveTableReference(
    tableName: string,
    nameIndex: Map<string, string[]>,
    context: SQLContext,
    sourceObjId: string
  ): DependencyMatch[] {
    const matches: DependencyMatch[] = [];
    const searchName = tableName.toLowerCase();

    // 1. Check if it's an alias
    if (context.aliases.has(searchName)) {
      const actualTable = context.aliases.get(searchName)!;
      const targetIds = nameIndex.get(actualTable) || [];
      
      for (const targetId of targetIds) {
        if (targetId !== sourceObjId) {
          matches.push({
            sourceName: tableName,
            targetId,
            targetName: actualTable,
            confidence: 0.95,
            matchType: 'alias',
            context: `Alias resolved: ${tableName} → ${actualTable}`
          });
        }
      }
      
      if (matches.length > 0) return matches;
    }

    // 2. Exact match
    const exactMatches = nameIndex.get(searchName) || [];
    if (exactMatches.length === 1 && exactMatches[0] !== sourceObjId) {
      matches.push({
        sourceName: tableName,
        targetId: exactMatches[0],
        targetName: tableName,
        confidence: 1.0,
        matchType: 'exact'
      });
      return matches;
    }

    // 3. Multiple exact matches (ambiguous)
    if (exactMatches.length > 1) {
      for (const targetId of exactMatches) {
        if (targetId !== sourceObjId) {
          matches.push({
            sourceName: tableName,
            targetId,
            targetName: tableName,
            confidence: 0.6, // Ambiguous
            matchType: 'exact',
            context: `Ambiguous: ${exactMatches.length} matches found`
          });
        }
      }
      return matches;
    }

    // 4. Fuzzy match (for typos or variations)
    const fuzzyMatches = this.fuzzyMatchTable(searchName, nameIndex);
    if (fuzzyMatches.length > 0) {
      for (const { name, ids, similarity } of fuzzyMatches) {
        for (const targetId of ids) {
          if (targetId !== sourceObjId) {
            matches.push({
              sourceName: tableName,
              targetId,
              targetName: name,
              confidence: similarity,
              matchType: 'fuzzy',
              context: `Fuzzy match: ${tableName} ≈ ${name}`
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Fuzzy match table names (for typos, case variations, etc.)
   */
  private fuzzyMatchTable(
    searchName: string,
    nameIndex: Map<string, string[]>
  ): Array<{ name: string; ids: string[]; similarity: number }> {
    const matches: Array<{ name: string; ids: string[]; similarity: number }> = [];
    
    for (const [indexedName, ids] of nameIndex.entries()) {
      const similarity = this.calculateSimilarity(searchName, indexedName);
      
      // Only consider matches with >80% similarity
      if (similarity > 0.8 && similarity < 1.0) {
        matches.push({ name: indexedName, ids, similarity });
      }
    }

    // Sort by similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);
    
    // Return top 3 matches
    return matches.slice(0, 3);
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return 1 - (distance / maxLen);
  }

  /**
   * Store dependencies in database
   */
  private async storeDependencies(
    dependencies: DependencyMatch[],
    sourceObjId: string,
    orgId: string
  ): Promise<void> {
    for (const dep of dependencies) {
      try {
        await supabase
          .schema('metadata')
          .from('dependencies')
          .insert({
            organization_id: orgId,
            source_object_id: sourceObjId,
            target_object_id: dep.targetId,
            dependency_type: dep.matchType === 'alias' ? 'aliased_select' : 'select',
            confidence: dep.confidence,
            metadata: {
              match_type: dep.matchType,
              source_name: dep.sourceName,
              target_name: dep.targetName,
              context: dep.context
            }
          })
          .select();
      } catch (error) {
        // Ignore duplicate key errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('duplicate')) {
          console.error(`Error storing dependency:`, error);
        }
      }
    }
  }

  /**
   * Check if a word is a SQL keyword
   */
  private isKeyword(word: string): boolean {
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 
      'LIMIT', 'OFFSET', 'UNION', 'EXCEPT', 'INTERSECT',
      'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS',
      'ON', 'USING', 'AND', 'OR', 'NOT', 'IN', 'EXISTS',
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'WITH'
    ];
    return keywords.includes(word.toUpperCase());
  }
}
