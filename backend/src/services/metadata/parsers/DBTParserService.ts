/**
 * DBT Parser Service
 * Extracts metadata from DBT projects
 */
export class DBTParserService {
  
  async parseDBTProject(filePath: string, content: string): Promise<any> {
    const objects: any[] = [];
    
    if (filePath.includes('dbt_project.yml')) {
      // Parse project configuration
      return this.parseProjectConfig(content);
    }
    
    if (filePath.includes('/models/') && filePath.endsWith('.sql')) {
      // Parse DBT model
      return this.parseDBTModel(filePath, content);
    }
    
    return { objects, parserUsed: 'dbt', confidence: 0.85 };
  }

  private parseProjectConfig(content: string): any {
    return {
      objects: [],
      parserUsed: 'dbt-config',
      confidence: 0.9
    };
  }

  private parseDBTModel(filePath: string, content: string): any {
    const modelName = filePath.split('/').pop()?.replace('.sql', '') || 'unknown';
    
    // Extract ref() calls
    const refs = this.extractRefs(content);
    
    // Extract source() calls  
    const sources = this.extractSources(content);
    
    // Extract columns from SELECT statement
    const columns = this.extractColumnsFromSelect(content);
    
    return {
      objects: [{
        name: modelName,
        object_type: 'dbt_model',
        definition: content,
        dependencies: [...refs, ...sources],
        columns: columns, // FIXED: Now includes columns
        confidence: 0.85
      }],
      parserUsed: 'dbt-model',
      confidence: 0.85
    };
  }

  private extractRefs(content: string): string[] {
    const refs: string[] = [];
    const refRegex = /\{\{\s*ref\(['"]([\w_]+)['"]\)\s*\}\}/g;
    let match;
    
    while ((match = refRegex.exec(content)) !== null) {
      refs.push(match[1]);
    }
    
    return refs;
  }

  private extractSources(content: string): string[] {
    const sources: string[] = [];
    const sourceRegex = /\{\{\s*source\(['"]([\w_]+)['"]\s*,\s*['"]([\w_]+)['"]\)\s*\}\}/g;
    let match;
    
    while ((match = sourceRegex.exec(content)) !== null) {
      sources.push(`${match[1]}.${match[2]}`);
    }
    
    return sources;
  }

  /**
   * Extract column names from SELECT statement
   * Handles: column_name, alias, function() as alias, table.column
   */
  private extractColumnsFromSelect(content: string): any[] {
    const columns: any[] = [];
    
    // Find SELECT clause (between SELECT and FROM/WHERE/GROUP/ORDER/LIMIT)
    const selectMatch = content.match(/SELECT\s+(.*?)\s+FROM/is);
    if (!selectMatch) return columns;
    
    const selectClause = selectMatch[1];
    
    // Split by comma (but not inside parentheses)
    const columnExpressions = this.splitByComma(selectClause);
    
    let position = 1;
    for (const expr of columnExpressions) {
      const trimmed = expr.trim();
      if (!trimmed || trimmed === '*') continue;
      
      // Extract column name/alias
      let columnName = '';
      let dataType = 'UNKNOWN';
      
      // Pattern: "expression AS alias" or "expression alias"
      const asMatch = trimmed.match(/\s+(?:AS\s+)?(\w+)\s*$/i);
      if (asMatch) {
        columnName = asMatch[1];
      } else {
        // No alias - extract last word
        const lastWord = trimmed.match(/(\w+)\s*$/);
        if (lastWord) {
          columnName = lastWord[1];
        }
      }
      
      // Detect data type from function
      if (trimmed.match(/COUNT\(/i)) dataType = 'BIGINT';
      else if (trimmed.match(/SUM\(|AVG\(/i)) dataType = 'NUMERIC';
      else if (trimmed.match(/CAST\(.*AS\s+(\w+)/i)) {
        const castMatch = trimmed.match(/CAST\(.*AS\s+(\w+)/i);
        if (castMatch) dataType = castMatch[1].toUpperCase();
      }
      
      if (columnName) {
        columns.push({
          name: columnName,
          data_type: dataType,
          position: position++
        });
      }
    }
    
    return columns;
  }

  /**
   * Split string by comma, but not inside parentheses
   */
  private splitByComma(str: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0) {
        result.push(current);
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      result.push(current);
    }
    
    return result;
  }
}
