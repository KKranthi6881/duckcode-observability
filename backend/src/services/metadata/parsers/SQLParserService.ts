import axios from 'axios';

interface SQLParseOptions {
  dialect?: string;
  filePath?: string;
  extractLineage?: boolean;
}

interface ParsedSQLObject {
  name: string;
  schema_name?: string;
  database_name?: string;
  object_type: string;
  definition: string;
  line_start?: number;
  line_end?: number;
  columns?: any[];
  dependencies?: string[];
  confidence: number;
}

/**
 * SQL Parser Service
 * Communicates with Python microservice that uses SQLglot
 * 
 * TODO: Deploy Python microservice separately
 * For now, uses inline parsing logic
 */
export class SQLParserService {
  private pythonServiceUrl: string;

  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_PARSER_URL || 'http://localhost:8001';
  }

  /**
   * Parse SQL file using SQLglot
   */
  async parseSQL(content: string, options: SQLParseOptions = {}): Promise<any> {
    try {
      // Option 1: Call Python microservice (if deployed)
      if (process.env.USE_PYTHON_SERVICE === 'true') {
        return await this.callPythonService(content, options);
      }

      // Option 2: Inline basic parsing (fallback)
      return this.basicSQLParse(content, options);
    } catch (error) {
      console.error('SQL parsing failed:', error);
      throw error;
    }
  }

  /**
   * Call Python microservice with SQLglot
   */
  private async callPythonService(content: string, options: SQLParseOptions): Promise<any> {
    try {
      const response = await axios.post(`${this.pythonServiceUrl}/parse/sql`, {
        content,
        dialect: options.dialect || 'ansi',
        extract_lineage: options.extractLineage !== false
      }, {
        timeout: 30000
      });

      return {
        objects: response.data.objects || [],
        parserUsed: 'python-sqlglot',
        confidence: response.data.confidence || 0.95
      };
    } catch (error) {
      console.error('Python service call failed:', error);
      // Fallback to basic parsing
      return this.basicSQLParse(content, options);
    }
  }

  /**
   * Basic SQL parsing (regex-based fallback)
   * This is a simplified version - production should use SQLglot via Python
   */
  private basicSQLParse(content: string, options: SQLParseOptions): any {
    const objects: ParsedSQLObject[] = [];
    const lines = content.split('\n');

    // Pattern: CREATE [OR REPLACE] {TABLE|VIEW|FUNCTION|PROCEDURE} [schema.]name
    const createTableRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP\s+|TEMPORARY\s+)?(TABLE|VIEW|MATERIALIZED\s+VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)/gi;
    
    // Pattern: WITH cte_name AS (...)
    const cteRegex = /WITH\s+(\w+)\s+AS\s*\(/gi;
    
    // Pattern: CREATE FUNCTION/PROCEDURE
    const functionRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE)\s+(?:(\w+)\.)?(\w+)/gi;

    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      
      // Match CREATE TABLE/VIEW
      let match;
      while ((match = createTableRegex.exec(line)) !== null) {
        const [, objectType, schemaName, tableName] = match;
        objects.push({
          name: tableName,
          schema_name: schemaName,
          object_type: objectType.toLowerCase().replace(/\s+/g, '_'),
          definition: this.extractDefinition(content, lineNum),
          line_start: lineNum,
          columns: this.extractColumns(content, lineNum),
          dependencies: this.extractDependencies(content),
          confidence: 0.75 // Lower confidence for regex parsing
        });
      }

      // Match CTEs
      while ((match = cteRegex.exec(line)) !== null) {
        const [, cteName] = match;
        objects.push({
          name: cteName,
          object_type: 'cte',
          definition: this.extractDefinition(content, lineNum),
          line_start: lineNum,
          confidence: 0.7
        });
      }

      // Match FUNCTION/PROCEDURE
      while ((match = functionRegex.exec(line)) !== null) {
        const [, objectType, schemaName, functionName] = match;
        objects.push({
          name: functionName,
          schema_name: schemaName,
          object_type: objectType.toLowerCase(),
          definition: this.extractDefinition(content, lineNum),
          line_start: lineNum,
          confidence: 0.75
        });
      }
    }

    return {
      objects,
      parserUsed: 'basic-regex',
      confidence: 0.70 // Lower overall confidence
    };
  }

  /**
   * Extract column definitions (improved)
   * Handles CREATE TABLE columns AND SELECT statement columns
   */
  private extractColumns(content: string, startLine: number): any[] {
    const columns: any[] = [];
    const lines = content.split('\n');
    
    // Check if this is a CREATE TABLE or a SELECT/VIEW
    const fullContent = lines.slice(startLine - 1).join('\n');
    const isCreateTable = /CREATE\s+(?:TABLE|TEMPORARY\s+TABLE|TEMP\s+TABLE)/i.test(fullContent);
    
    if (isCreateTable) {
      // Extract columns from CREATE TABLE definition
      return this.extractCreateTableColumns(lines, startLine);
    } else {
      // Extract columns from SELECT statement
      return this.extractSelectColumns(fullContent);
    }
  }

  /**
   * Extract columns from CREATE TABLE (...) definition
   */
  private extractCreateTableColumns(lines: string[], startLine: number): any[] {
    const columns: any[] = [];
    
    // Enhanced pattern: column_name TYPE [constraints]
    const columnRegex = /^\s*(\w+)\s+(VARCHAR|INTEGER|INT|BIGINT|SMALLINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BOOLEAN|BOOL|DATE|TIMESTAMP|TIMESTAMPTZ|TIME|TEXT|JSON|JSONB|UUID|BYTEA|ARRAY|SERIAL|BIGSERIAL)(?:\([\d,\s]+\))?/i;
    
    for (let i = startLine; i < Math.min(startLine + 100, lines.length); i++) {
      const line = lines[i];
      
      // Stop at closing parenthesis or semicolon
      if (line.trim().startsWith(')') || line.includes(');')) break;
      
      // Skip constraint lines
      if (/^\s*(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(line)) continue;
      
      const match = columnRegex.exec(line);
      if (match) {
        const isNullable = !line.toUpperCase().includes('NOT NULL');
        columns.push({
          name: match[1],
          data_type: match[2].toUpperCase(),
          is_nullable: isNullable,
          position: columns.length + 1
        });
      }
    }
    
    return columns;
  }

  /**
   * Extract columns from SELECT statement (for VIEWs and CTEs)
   */
  private extractSelectColumns(content: string): any[] {
    const columns: any[] = [];
    
    // Find SELECT clause
    const selectMatch = content.match(/SELECT\s+(.*?)\s+FROM/is);
    if (!selectMatch) return columns;
    
    const selectClause = selectMatch[1];
    
    // Split by comma (but not inside parentheses or CASE statements)
    const columnExpressions = this.splitSelectColumns(selectClause);
    
    let position = 1;
    for (const expr of columnExpressions) {
      const trimmed = expr.trim();
      if (!trimmed || trimmed === '*') continue;
      
      // Extract column name/alias
      let columnName = '';
      let dataType = 'VARCHAR'; // Default for SELECT columns
      
      // Pattern: "expression AS alias" or "expression alias"
      const asMatch = trimmed.match(/\s+(?:AS\s+)?["']?(\w+)["']?\s*$/i);
      if (asMatch) {
        columnName = asMatch[1];
      } else {
        // No alias - extract table.column or just column
        const columnMatch = trimmed.match(/(\w+)\s*$/);
        if (columnMatch) {
          columnName = columnMatch[1];
        }
      }
      
      // Infer data type from functions
      if (trimmed.match(/COUNT\(/i)) dataType = 'BIGINT';
      else if (trimmed.match(/SUM\(|AVG\(|STDDEV\(/i)) dataType = 'NUMERIC';
      else if (trimmed.match(/MAX\(|MIN\(/i)) dataType = 'VARCHAR';
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
   * Split SELECT column list by comma (respecting parentheses and CASE statements)
   */
  private splitSelectColumns(selectClause: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    let inCase = false;
    
    for (let i = 0; i < selectClause.length; i++) {
      const char = selectClause[i];
      const remaining = selectClause.substring(i);
      
      // Track CASE...END blocks
      if (remaining.match(/^CASE\s/i)) inCase = true;
      if (remaining.match(/^END\s/i)) inCase = false;
      
      if (char === '(') depth++;
      else if (char === ')') depth--;
      else if (char === ',' && depth === 0 && !inCase) {
        if (current.trim()) result.push(current.trim());
        current = '';
        continue;
      }
      
      current += char;
    }
    
    if (current.trim()) {
      result.push(current.trim());
    }
    
    return result;
  }

  /**
   * Extract dependencies (table references in FROM/JOIN)
   */
  private extractDependencies(content: string): string[] {
    const dependencies: Set<string> = new Set();
    
    // Pattern: FROM table_name or JOIN table_name
    const fromRegex = /(?:FROM|JOIN)\s+(?:(\w+)\.)?(\w+)/gi;
    
    let match;
    while ((match = fromRegex.exec(content)) !== null) {
      const [, schema, table] = match;
      dependencies.add(schema ? `${schema}.${table}` : table);
    }
    
    return Array.from(dependencies);
  }

  /**
   * Extract definition text
   */
  private extractDefinition(content: string, startLine: number, maxLines: number = 100): string {
    const lines = content.split('\n');
    let definition = '';
    let parenCount = 0;
    
    for (let i = startLine - 1; i < Math.min(startLine + maxLines, lines.length); i++) {
      const line = lines[i];
      definition += line + '\n';
      
      parenCount += (line.match(/\(/g) || []).length;
      parenCount -= (line.match(/\)/g) || []).length;
      
      if (parenCount === 0 && (line.includes(';') || i - startLine > 3)) {
        break;
      }
    }
    
    return definition.trim().substring(0, 5000); // Limit size
  }
}
