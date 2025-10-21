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
  columns?: ParsedColumn[];
  dependencies?: string[];
  confidence: number;
}

interface ParsedColumn {
  name: string;
  data_type?: string;
  is_nullable?: boolean;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  default_value?: string;
  position?: number;
  metadata?: any;
}

/**
 * Enterprise SQL Parser Service
 * 
 * Ported from IDE's SQLGLOTParser with comprehensive column extraction:
 * - CREATE TABLE/VIEW statements
 * - SELECT statements (models, CTEs, views)
 * - DBT Jinja templates
 * - Column aliases and calculated fields
 * - Complex expressions and functions
 * 
 * Goal: 95%+ extraction accuracy matching IDE version
 */
export class EnhancedSQLParser {
  private pythonServiceUrl: string;

  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_PARSER_URL || 'http://localhost:8001';
  }

  /**
   * Parse SQL file with comprehensive column extraction
   */
  async parseSQL(content: string, options: SQLParseOptions = {}): Promise<any> {
    try {
      console.log('[SQL] Starting enhanced parsing...');
      
      // Try Python microservice first (if available)
      if (process.env.USE_PYTHON_SERVICE === 'true') {
        try {
          return await this.callPythonService(content, options);
        } catch (error) {
          console.warn('[SQL] Python service unavailable, using enhanced regex parser');
        }
      }

      // Enhanced inline parsing (production-ready)
      return this.enhancedParse(content, options);
    } catch (error) {
      console.error('[SQL] Parsing failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced SQL parsing with comprehensive column extraction
   */
  private enhancedParse(content: string, options: SQLParseOptions): any {
    const objects: ParsedSQLObject[] = [];
    const lines = content.split('\n');

    console.log(`[SQL] Parsing ${lines.length} lines of SQL`);

    // Detect if this is a DBT file
    const isDBTFile = this.isDBTContent(content);
    
    if (isDBTFile) {
      console.log('[SQL] Detected DBT content');
      // Parse as DBT model
      const dbtObjects = this.parseDBTModel(content, options.filePath || '');
      objects.push(...dbtObjects);
    } else {
      // Parse traditional SQL objects
      objects.push(...this.parseTraditionalSQL(content, lines));
    }

    // Extract columns for each object
    for (const obj of objects) {
      try {
        obj.columns = this.extractColumnsFromDefinition(
          obj.definition,
          obj.object_type
        );
        console.log(`[SQL] Extracted ${obj.columns.length} columns for ${obj.name}`);
      } catch (error) {
        console.error(`[SQL] Failed to extract columns for ${obj.name}:`, error);
        obj.columns = [];
      }
    }

    // Extract dependencies
    const dependencies = this.extractDependencies(content);

    return {
      objects,
      parserUsed: 'enhanced-sql-parser',
      confidence: 0.85,
      dependencies
    };
  }

  /**
   * Check if content is DBT model
   */
  private isDBTContent(content: string): boolean {
    return content.includes('{{ ref(') || 
           content.includes('{{ source(') ||
           content.includes('{% set ') ||
           /with\s+\w+\s+as\s*\(/i.test(content);
  }

  /**
   * Parse DBT model file
   */
  private parseDBTModel(content: string, filePath: string): ParsedSQLObject[] {
    const objects: ParsedSQLObject[] = [];
    const lines = content.split('\n');

    // Extract model name from file path (e.g., models/staging/stg_customers.sql -> stg_customers)
    const modelName = this.extractModelName(filePath);
    
    if (modelName) {
      // Main model object
      objects.push({
        name: modelName,
        object_type: 'model',
        definition: content,
        line_start: 1,
        line_end: lines.length,
        confidence: 0.90
      });
    }

    // Extract CTEs (Common Table Expressions)
    const cteRegex = /(?:with\s+)?(\w+)\s+as\s*\(/gi;
    let match;
    while ((match = cteRegex.exec(content)) !== null) {
      const cteName = match[1];
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      // Extract CTE definition
      const cteDefinition = this.extractCTEDefinition(content, match.index);
      
      objects.push({
        name: cteName,
        object_type: 'cte',
        definition: cteDefinition,
        line_start: lineNumber,
        confidence: 0.85
      });
    }

    return objects;
  }

  /**
   * Extract model name from file path
   */
  private extractModelName(filePath: string): string | null {
    if (!filePath) return null;
    
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    
    // Remove .sql extension
    return fileName.replace(/\.sql$/i, '');
  }

  /**
   * Extract CTE definition
   */
  private extractCTEDefinition(content: string, startIndex: number): string {
    let depth = 0;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '(') depth++;
      if (content[i] === ')') depth--;
      
      if (depth === 0 && i > startIndex) {
        endIndex = i + 1;
        break;
      }
    }
    
    return content.substring(startIndex, endIndex);
  }

  /**
   * Parse traditional SQL (CREATE statements)
   */
  private parseTraditionalSQL(content: string, lines: string[]): ParsedSQLObject[] {
    const objects: ParsedSQLObject[] = [];
    
    // Pattern: CREATE [OR REPLACE] {TABLE|VIEW|FUNCTION|PROCEDURE} [schema.]name
    const createTableRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TEMP\s+|TEMPORARY\s+)?(TABLE|VIEW|MATERIALIZED\s+VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)/gi;
    
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
          confidence: 0.80
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

    return objects;
  }

  /**
   * COMPREHENSIVE COLUMN EXTRACTION
   * 
   * This is the key method ported from IDE's SQLGLOTParser
   * Handles both CREATE statements and SELECT statements
   */
  private extractColumnsFromDefinition(definition: string, objectType: string): ParsedColumn[] {
    console.log(`[SQL] Extracting columns from ${objectType} definition (${definition.length} chars)`);

    // Handle different object types with different parsing strategies
    if (objectType === 'model' || objectType === 'cte' || objectType === 'view' || objectType === 'materialized_view') {
      // For models, CTEs, and views - parse SELECT statements
      return this.extractColumnsFromSelectStatement(definition, objectType);
    } else {
      // For tables - parse CREATE TABLE definition
      return this.extractColumnsFromCreateStatement(definition, objectType);
    }
  }

  /**
   * Extract columns from SELECT statement (for models/CTEs/views)
   * 
   * Handles:
   * - SELECT column1, column2 FROM table
   * - SELECT col AS alias
   * - SELECT func(col) AS calculated
   * - SELECT * FROM table (marks as unknown)
   */
  private extractColumnsFromSelectStatement(definition: string, objectType: string): ParsedColumn[] {
    const columns: ParsedColumn[] = [];

    console.log(`[SQL] Parsing SELECT statement for ${objectType}`);

    // Remove Jinja templates temporarily for parsing
    let cleanDefinition = definition
      .replace(/\{\{[^}]+\}\}/g, 'placeholder_table') // Replace {{ ref() }} with placeholder
      .replace(/\{%[^%]+%\}/g, '') // Remove {% set %} blocks
      .replace(/\{#[^#]+#\}/g, ''); // Remove comments

    // Find the main SELECT statement (not in CTEs)
    const selectMatch = this.findMainSelectStatement(cleanDefinition);
    if (!selectMatch) {
      console.log(`[SQL] No main SELECT statement found`);
      
      // If SELECT * pattern, we can't extract columns without upstream table info
      if (cleanDefinition.toLowerCase().includes('select *')) {
        console.log(`[SQL] Found SELECT * pattern - columns need upstream resolution`);
        return [{
          name: '*',
          data_type: 'unknown',
          is_nullable: true,
          position: 0,
          metadata: {
            needs_upstream_resolution: true,
            object_type: objectType
          }
        }];
      }
      
      return columns;
    }

    console.log(`[SQL] Found main SELECT: ${selectMatch.substring(0, 200)}...`);

    // Extract column list from SELECT
    const columnExpressions = this.parseSelectColumns(selectMatch);

    let position = 0;
    for (const col of columnExpressions) {
      columns.push({
        name: col.name,
        data_type: col.dataType || 'VARCHAR',
        is_nullable: true, // Default for SELECT columns
        is_primary_key: false,
        is_foreign_key: false,
        position: position++,
        metadata: {
          object_type: objectType,
          expression: col.expression,
          is_calculated: col.isCalculated
        }
      });
    }

    console.log(`[SQL] Extracted ${columns.length} columns from SELECT statement`);
    return columns;
  }

  /**
   * Find the main SELECT statement (after all CTEs)
   */
  private findMainSelectStatement(definition: string): string | null {
    const lines = definition.split('\n');
    let inFinalSelect = false;
    let selectLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toLowerCase();

      // Look for final SELECT (not part of a CTE)
      if (line.startsWith('select') && !inFinalSelect) {
        // Check if this is the final select (after all CTEs)
        const remainingContent = lines.slice(i).join('\n');
        if (!remainingContent.toLowerCase().includes(') as (') &&
            !remainingContent.toLowerCase().includes('),')) {
          inFinalSelect = true;
          selectLines.push(lines[i]);
        }
      } else if (inFinalSelect) {
        selectLines.push(lines[i]);
        // Stop at FROM clause for now
        if (line.includes('from ')) {
          break;
        }
      }
    }

    return selectLines.length > 0 ? selectLines.join('\n') : null;
  }

  /**
   * Parse SELECT column list
   */
  private parseSelectColumns(selectStatement: string): Array<{
    name: string;
    dataType?: string;
    expression: string;
    isCalculated: boolean;
  }> {
    const columns: Array<{
      name: string;
      dataType?: string;
      expression: string;
      isCalculated: boolean;
    }> = [];

    // Extract the column list between SELECT and FROM
    const selectContent = selectStatement
      .replace(/^\s*select\s+/i, '') // Remove SELECT keyword
      .replace(/\s+from\s+.*/is, '') // Remove FROM clause onwards
      .trim();

    console.log(`[SQL] Parsing column list: ${selectContent.substring(0, 200)}...`);

    // Handle SELECT * case
    if (selectContent.trim() === '*') {
      return [{
        name: '*',
        dataType: 'unknown',
        expression: '*',
        isCalculated: false
      }];
    }

    // Split by comma, but be careful with nested functions
    const columnExpressions = this.splitSelectColumns(selectContent);

    for (const expr of columnExpressions) {
      const column = this.parseColumnExpression(expr.trim());
      if (column) {
        columns.push(column);
      }
    }

    return columns;
  }

  /**
   * Split SELECT columns by comma (respecting parentheses)
   */
  private splitSelectColumns(content: string): string[] {
    const columns: string[] = [];
    let current = '';
    let parenDepth = 0;
    let inCase = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const remaining = content.substring(i);

      // Track CASE...END blocks
      if (remaining.match(/^CASE\s/i)) inCase = true;
      if (remaining.match(/^END\s/i)) inCase = false;

      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
      } else if (char === ',' && parenDepth === 0 && !inCase) {
        if (current.trim()) columns.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) {
      columns.push(current.trim());
    }

    return columns;
  }

  /**
   * Parse individual column expression
   * Handles: col, col AS alias, func(col) AS alias, complex expressions
   */
  private parseColumnExpression(expression: string): {
    name: string;
    dataType?: string;
    expression: string;
    isCalculated: boolean;
  } | null {
    console.log(`[SQL] Parsing column expression: ${expression}`);

    // Pattern: "expression AS alias" or "expression alias"
    const asMatch = expression.match(/^(.+?)\s+(?:AS\s+)?["']?(\w+)["']?\s*$/i);
    if (asMatch) {
      const [, expr, alias] = asMatch;
      return {
        name: alias,
        expression: expr.trim(),
        isCalculated: !this.isSimpleColumnReference(expr.trim()),
        dataType: this.inferDataType(expr.trim())
      };
    }

    // Simple column reference without alias
    if (this.isSimpleColumnReference(expression)) {
      // Handle table.column format
      const parts = expression.split('.');
      const columnName = parts[parts.length - 1];
      
      return {
        name: columnName,
        expression: expression,
        isCalculated: false,
        dataType: 'VARCHAR'
      };
    }

    // Complex expression without alias - try to generate a name
    const generatedName = this.generateColumnName(expression);
    return {
      name: generatedName,
      expression: expression,
      isCalculated: true,
      dataType: this.inferDataType(expression)
    };
  }

  /**
   * Check if expression is a simple column reference
   */
  private isSimpleColumnReference(expression: string): boolean {
    // Check if it's just a column name (possibly with table prefix)
    return /^\w+(\.\w+)?$/.test(expression.trim());
  }

  /**
   * Generate column name from complex expression
   */
  private generateColumnName(expression: string): string {
    const expr = expression.toLowerCase().trim();

    if (expr.includes('count(')) return 'count';
    if (expr.includes('sum(')) return 'sum';
    if (expr.includes('avg(')) return 'avg';
    if (expr.includes('max(')) return 'max';
    if (expr.includes('min(')) return 'min';
    if (expr.includes('case when')) return 'calculated_field';

    // Extract potential column name from expression
    const match = expr.match(/(\w+)/);
    return match ? match[1] : 'expression';
  }

  /**
   * Infer data type from expression
   */
  private inferDataType(expression: string): string {
    const expr = expression.toLowerCase().trim();

    if (expr.includes('count(') || expr.includes('sum(')) return 'BIGINT';
    if (expr.includes('avg(') || expr.includes('stddev(')) return 'NUMERIC';
    if (expr.includes('date(') || expr.includes('timestamp')) return 'TIMESTAMP';
    if (expr.includes('concat(') || expr.includes("'")) return 'VARCHAR';
    if (expr.includes('case when')) return 'VARCHAR';
    
    // Check CAST expressions
    const castMatch = expr.match(/cast\(.*as\s+(\w+)/i);
    if (castMatch) {
      return castMatch[1].toUpperCase();
    }

    return 'VARCHAR';
  }

  /**
   * Extract columns from CREATE TABLE statement
   */
  private extractColumnsFromCreateStatement(definition: string, objectType: string): ParsedColumn[] {
    const columns: ParsedColumn[] = [];

    console.log(`[SQL] Extracting columns from CREATE statement`);

    // Enhanced column regex: column_name TYPE [constraints]
    const columnRegex = /^\s*(?:\[(\w+)\]|(\w+))\s+(VARCHAR|INTEGER|INT|BIGINT|SMALLINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BOOLEAN|BOOL|DATE|TIMESTAMP|TIMESTAMPTZ|TIME|TEXT|JSON|JSONB|UUID|BYTEA|ARRAY|SERIAL|BIGSERIAL)(?:\([\d,\s]+\))?/gim;

    const lines = definition.split('\n');
    let position = 0;

    for (const line of lines) {
      // Skip constraint lines
      if (/^\s*(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)/i.test(line)) continue;

      const match = columnRegex.exec(line);
      if (match) {
        const columnName = match[1] || match[2];
        const dataType = match[3];
        const constraints = line.substring(match[0].length).trim();

        columns.push({
          name: columnName,
          data_type: dataType.toUpperCase(),
          is_nullable: !constraints.toUpperCase().includes('NOT NULL'),
          is_primary_key: /PRIMARY\s+KEY/i.test(constraints),
          is_foreign_key: /FOREIGN\s+KEY|REFERENCES/i.test(constraints),
          default_value: this.extractDefaultValue(constraints) || undefined,
          position: position++,
          metadata: {
            object_type: objectType,
            constraints
          }
        });
      }
    }

    console.log(`[SQL] Extracted ${columns.length} columns from CREATE statement`);
    return columns;
  }

  /**
   * Extract DEFAULT value from constraints
   */
  private extractDefaultValue(constraints: string): string | null {
    const defaultMatch = constraints.match(/DEFAULT\s+([^,\s]+)/i);
    return defaultMatch ? defaultMatch[1] : null;
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

  /**
   * Extract dependencies (FROM/JOIN clauses and dbt ref())
   */
  private extractDependencies(content: string): string[] {
    const dependencies: Set<string> = new Set();

    // Pattern 1: DBT ref() dependencies
    const refRegex = /\{\{\s*ref\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}/gi;
    let match;
    while ((match = refRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    // Pattern 2: DBT source() dependencies
    const sourceRegex = /\{\{\s*source\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/gi;
    while ((match = sourceRegex.exec(content)) !== null) {
      dependencies.add(`${match[1]}.${match[2]}`);
    }

    // Pattern 3: FROM/JOIN table references
    const fromRegex = /(?:FROM|JOIN)\s+(?:(\w+)\.)?(\w+)/gi;
    while ((match = fromRegex.exec(content)) !== null) {
      const [, schema, table] = match;
      dependencies.add(schema ? `${schema}.${table}` : table);
    }

    return Array.from(dependencies);
  }

  /**
   * Call Python microservice (SQLglot)
   */
  private async callPythonService(content: string, options: SQLParseOptions): Promise<any> {
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
  }

  // ============================================================================
  // COLUMN LINEAGE EXTRACTION (Production-Grade)
  // ============================================================================

  /**
   * Extract column-level lineage from compiled SQL
   * 
   * Uses manifest dependencies as context for higher accuracy
   * Returns which source columns contribute to which target columns
   * 
   * Approach: Same as dbt Cloud, Atlan, Metaphor
   */
  extractColumnLineage(
    compiledSQL: string,
    targetModel: string,
    manifestContext: {
      dependencies: string[];  // List of source model names from manifest
      tableAliases?: Map<string, string>;  // Optional: pre-resolved aliases
    }
  ): ColumnLineageRelation[] {
    console.log(`[ColumnLineage] Extracting for ${targetModel}`);
    console.log(`[ColumnLineage] Known dependencies: ${manifestContext.dependencies.join(', ')}`);

    const lineages: ColumnLineageRelation[] = [];

    try {
      // Step 1: Parse SELECT to get target columns with their expressions
      const selectStatement = this.findMainSelectStatement(compiledSQL);
      if (!selectStatement) {
        console.log(`[ColumnLineage] No SELECT statement found`);
        return [];
      }

      const targetColumns = this.parseSelectColumns(selectStatement);
      console.log(`[ColumnLineage] Found ${targetColumns.length} target columns`);

      // Step 2: Build CTE map (e.g., 'customers' CTE -> 'stg_customers' table)
      const cteMap = this.buildCTEMap(compiledSQL, manifestContext.dependencies);
      console.log(`[ColumnLineage] Resolved CTEs:`, Object.fromEntries(cteMap));
      
      // Step 3: Build table alias map (e.g., 'c' -> 'stg_customers')
      const aliasMap = this.buildTableAliasMap(compiledSQL, manifestContext.dependencies);
      console.log(`[ColumnLineage] Resolved aliases:`, Object.fromEntries(aliasMap));

      // Step 3: For each target column, trace back to source columns
      for (const targetCol of targetColumns) {
        if (targetCol.name === '*') {
          // Skip wildcard - needs upstream resolution
          continue;
        }

        const sourceCols = this.traceColumnSources(
          targetCol.expression,
          aliasMap,
          cteMap,
          manifestContext.dependencies
        );

        if (sourceCols.length > 0) {
          // Determine transformation type and confidence
          const transformationType = this.classifyTransformationType(targetCol.expression);
          const baseConfidence = this.calculateBaseConfidence(transformationType);

          lineages.push({
            target_column: targetCol.name,
            source_columns: sourceCols.map(src => ({
              table: src.table,
              column: src.column,
              transformation_type: transformationType,
              confidence: this.adjustConfidenceForValidation(
                baseConfidence,
                src.table,
                manifestContext.dependencies
              ),
              expression: targetCol.expression
            }))
          });

          console.log(`[ColumnLineage] ${targetCol.name} ← ${sourceCols.map(s => `${s.table}.${s.column}`).join(', ')}`);
        }
      }

      console.log(`[ColumnLineage] ✅ Extracted ${lineages.length} column lineages`);
      return lineages;

    } catch (error) {
      console.error(`[ColumnLineage] ❌ Failed to extract lineage:`, error);
      return [];
    }
  }

  /**
   * Build map of CTEs to their source tables
   * CTEs (Common Table Expressions) are used heavily in dbt
   * 
   * Example:
   * WITH customers AS (SELECT * FROM {{ ref('stg_customers') }})
   * → cteMap['customers'] = 'stg_customers'
   */
  private buildCTEMap(
    sql: string,
    knownDependencies: string[]
  ): Map<string, string> {
    const cteMap = new Map<string, string>();

    // Pattern: WITH cte_name AS (SELECT ... FROM table ...)
    // We need to extract the CTE name and the table it references
    const ctePattern = /WITH\s+(\w+)\s+AS\s*\(\s*SELECT[^)]*FROM\s+(?:\{\{\s*ref\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}|`?(\w+)`?)/gi;
    let match;

    while ((match = ctePattern.exec(sql)) !== null) {
      const cteName = match[1];
      const tableName = match[2] || match[3];
      
      if (knownDependencies.includes(tableName)) {
        cteMap.set(cteName, tableName);
        console.log(`[CTE] ${cteName} → ${tableName}`);
      }
    }

    // Pattern: Additional CTEs in comma-separated list
    // , cte_name AS (SELECT ... FROM table ...)
    const additionalCTEPattern = /,\s*(\w+)\s+AS\s*\(\s*SELECT[^)]*FROM\s+(?:\{\{\s*ref\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}|`?(\w+)`?)/gi;
    
    while ((match = additionalCTEPattern.exec(sql)) !== null) {
      const cteName = match[1];
      const tableName = match[2] || match[3];
      
      if (knownDependencies.includes(tableName)) {
        cteMap.set(cteName, tableName);
        console.log(`[CTE] ${cteName} → ${tableName} (additional)`);
      }
    }

    return cteMap;
  }

  /**
   * Build map of table aliases to actual table names
   * Uses manifest dependencies to validate
   */
  private buildTableAliasMap(
    sql: string,
    knownDependencies: string[]
  ): Map<string, string> {
    const aliasMap = new Map<string, string>();

    // Pattern 1: FROM table [AS] alias
    // Handles: FROM table AS alias, FROM table alias, FROM {{ ref('table') }} AS alias
    const fromPattern = /FROM\s+(?:\{\{\s*ref\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}|`?(\w+)`?)\s+(?:AS\s+)?`?(\w+)`?\b/gi;
    let match;

    while ((match = fromPattern.exec(sql)) !== null) {
      const tableName = match[1] || match[2]; // dbt ref or regular table
      const alias = match[3];
      
      // Only add if it's a known dependency
      if (knownDependencies.includes(tableName)) {
        aliasMap.set(alias, tableName);
        console.log(`[Alias] ${alias} → ${tableName}`);
      }
    }

    // Pattern 2: JOIN table [AS] alias
    const joinPattern = /(?:LEFT|RIGHT|INNER|OUTER|CROSS)?\s*JOIN\s+(?:\{\{\s*ref\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}|`?(\w+)`?)\s+(?:AS\s+)?`?(\w+)`?\b/gi;
    
    while ((match = joinPattern.exec(sql)) !== null) {
      const tableName = match[1] || match[2];
      const alias = match[3];
      
      if (knownDependencies.includes(tableName)) {
        aliasMap.set(alias, tableName);
        console.log(`[Alias] ${alias} → ${tableName} (from JOIN)`);
      }
    }

    // Pattern 3: FROM/JOIN without AS keyword (e.g., "FROM customers c")
    // This is common in jaffle-shop - no explicit AS
    const simpleFromPattern = /FROM\s+(?:\{\{\s*ref\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\}\}|`?(\w+)`?)\s+`?(\w+)`?(?:\s+(?:WHERE|GROUP|ORDER|LIMIT|LEFT|RIGHT|INNER|JOIN|$))/gi;
    
    while ((match = simpleFromPattern.exec(sql)) !== null) {
      const tableName = match[1] || match[2];
      const alias = match[3];
      
      // Skip if alias is a SQL keyword
      if (/^(WHERE|GROUP|ORDER|LIMIT|LEFT|RIGHT|INNER|OUTER|JOIN)$/i.test(alias)) {
        continue;
      }
      
      if (knownDependencies.includes(tableName) && !aliasMap.has(alias)) {
        aliasMap.set(alias, tableName);
        console.log(`[Alias] ${alias} → ${tableName} (simple from)`);
      }
    }

    // Pattern 4: If no aliases found, try matching table names directly
    // Some SQL doesn't use aliases at all
    if (aliasMap.size === 0) {
      for (const dep of knownDependencies) {
        // Check if dependency name appears in SQL (as a table reference)
        const tablePattern = new RegExp(`\\b${dep}\\b`, 'i');
        if (tablePattern.test(sql)) {
          // Map table name to itself (no alias)
          aliasMap.set(dep, dep);
          console.log(`[Alias] ${dep} → ${dep} (no alias)`);
        }
      }
    }

    return aliasMap;
  }

  /**
   * Trace column expression back to source columns
   * Handles: direct refs, aggregations, expressions, CASE statements, CTEs
   */
  private traceColumnSources(
    expression: string,
    aliasMap: Map<string, string>,
    cteMap: Map<string, string>,
    knownDependencies: string[]
  ): Array<{ table: string; column: string }> {
    const sources: Array<{ table: string; column: string }> = [];
    const seen = new Set<string>(); // Deduplicate

    // Pattern 1: Simple column reference (e.g., "c.customer_id" or "customers.customer_id")
    const simpleRefPattern = /\b(\w+)\.(\w+)\b/g;
    let match;

    while ((match = simpleRefPattern.exec(expression)) !== null) {
      const [, aliasOrCTEOrTable, columnName] = match;
      
      // Resolution priority:
      // 1. Try alias map first (e.g., 'c' -> 'stg_customers')
      // 2. Try CTE map (e.g., 'customers' CTE -> 'stg_customers' table)
      // 3. Use as-is if it's a known dependency
      let tableName = aliasMap.get(aliasOrCTEOrTable);
      
      if (!tableName) {
        tableName = cteMap.get(aliasOrCTEOrTable);
      }
      
      if (!tableName) {
        tableName = aliasOrCTEOrTable;
      }
      
      // Only include if it's a known dependency
      if (knownDependencies.includes(tableName)) {
        const key = `${tableName}.${columnName}`;
        if (!seen.has(key)) {
          sources.push({ table: tableName, column: columnName });
          seen.add(key);
          console.log(`[Trace] ${aliasOrCTEOrTable}.${columnName} → ${tableName}.${columnName}`);
        }
      }
    }

    // Pattern 2: Handle unqualified columns (no table prefix)
    // These could come from any source table - we'll need context
    const unqualifiedPattern = /\b(?:SELECT|,|\s)(\w+)(?:\s+AS|\s*,|\s+FROM)/gi;
    // Note: This is tricky - skipping for now as it requires more context

    return sources;
  }

  /**
   * Classify transformation type based on SQL expression
   */
  private classifyTransformationType(expression: string): string {
    const upper = expression.toUpperCase();

    // Aggregation functions
    if (/\b(COUNT|SUM|AVG|MAX|MIN|ARRAY_AGG|STRING_AGG)\s*\(/i.test(upper)) {
      return 'aggregation';
    }

    // Window functions
    if (/\b(ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|FIRST_VALUE|LAST_VALUE)\s*\(/i.test(upper)) {
      return 'window_function';
    }

    // CASE statements
    if (/\bCASE\s+WHEN\b/i.test(upper)) {
      return 'case_expression';
    }

    // Type casts
    if (/\b(CAST|CONVERT)\s*\(/i.test(upper) || /::/.test(expression)) {
      return 'cast';
    }

    // Mathematical operations
    if (/[+\-*\/]/.test(expression) && !/\bCONCAT\b/i.test(upper)) {
      return 'calculation';
    }

    // String operations
    if (/\b(CONCAT|SUBSTRING|TRIM|UPPER|LOWER|REPLACE)\s*\(/i.test(upper)) {
      return 'string_function';
    }

    // Date operations
    if (/\b(DATE|TIMESTAMP|DATEADD|DATEDIFF|EXTRACT)\s*\(/i.test(upper)) {
      return 'date_function';
    }

    // COALESCE, NULLIF, etc.
    if (/\b(COALESCE|NULLIF|IFNULL|NVL)\s*\(/i.test(upper)) {
      return 'null_handling';
    }

    // Direct column reference (no transformation)
    return 'direct';
  }

  /**
   * Calculate base confidence based on transformation type
   */
  private calculateBaseConfidence(transformationType: string): number {
    switch (transformationType) {
      case 'direct':
        return 0.95;  // High confidence - simple column reference
      case 'cast':
        return 0.93;  // Very high - just type conversion
      case 'aggregation':
        return 0.90;  // High - clear aggregation semantics
      case 'window_function':
        return 0.88;  // Good - window functions are well-defined
      case 'null_handling':
        return 0.85;  // Good - COALESCE, etc.
      case 'string_function':
        return 0.83;  // Medium-high - string operations
      case 'date_function':
        return 0.83;  // Medium-high - date operations
      case 'calculation':
        return 0.80;  // Medium - math operations
      case 'case_expression':
        return 0.75;  // Medium-low - conditional logic is complex
      default:
        return 0.70;  // Lower for unknown patterns
    }
  }

  /**
   * Adjust confidence based on manifest validation
   * Boost if source table is in known dependencies
   */
  private adjustConfidenceForValidation(
    baseConfidence: number,
    sourceTable: string,
    knownDependencies: string[]
  ): number {
    if (knownDependencies.includes(sourceTable)) {
      // ✅ Source table is validated by manifest - boost confidence
      return Math.min(baseConfidence * 1.05, 1.0);
    } else {
      // ⚠️ Source table not in manifest - lower confidence
      console.warn(`[Validation] Source table '${sourceTable}' not in manifest dependencies`);
      return baseConfidence * 0.80;
    }
  }
}

/**
 * Column lineage result types
 */
export interface ColumnLineageRelation {
  target_column: string;
  source_columns: Array<{
    table: string;
    column: string;
    transformation_type: string;
    confidence: number;
    expression?: string;
  }>;
}
