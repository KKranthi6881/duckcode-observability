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
   * Extract column definitions (simplified)
   */
  private extractColumns(content: string, startLine: number): any[] {
    const columns: any[] = [];
    const lines = content.split('\n');
    
    // Simple pattern: column_name TYPE
    const columnRegex = /^\s*(\w+)\s+(VARCHAR|INTEGER|INT|BIGINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|BOOLEAN|DATE|TIMESTAMP|TEXT|JSON|JSONB)/i;
    
    for (let i = startLine; i < Math.min(startLine + 50, lines.length); i++) {
      const line = lines[i];
      if (line.includes(')') || line.includes(';')) break;
      
      const match = columnRegex.exec(line);
      if (match) {
        columns.push({
          name: match[1],
          data_type: match[2],
          position: columns.length + 1
        });
      }
    }
    
    return columns;
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
