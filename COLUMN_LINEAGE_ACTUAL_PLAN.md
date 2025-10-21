# Column Lineage - Using Existing EnhancedSQLParser ✅

**Date:** October 20, 2025  
**Approach:** Extend existing `EnhancedSQLParser.ts` with column lineage extraction  
**Status:** Implementation Ready  

---

## ✅ What We Already Have

### 1. EnhancedSQLParser with Comprehensive Parsing
**File:** `backend/src/services/metadata/parsers/EnhancedSQLParser.ts`

**Current Capabilities:**
```typescript
✅ Parse SELECT statements
✅ Extract columns with aliases
✅ Handle DBT models (ref(), source())
✅ Extract dependencies (table-level)
✅ Parse CTEs and subqueries
✅ Infer data types from expressions
✅ Classify transformations (aggregation, expression, etc.)
✅ Python SQLglot integration (optional)
```

**What's Missing:**
❌ Column-to-column lineage mapping  
❌ Which source columns produce which target columns  

---

## 🎯 Implementation Plan

### Step 1: Add Column Lineage Extraction Method

**Add to `EnhancedSQLParser.ts`:**

```typescript
export interface ColumnLineageRelation {
  target_column: string;
  source_columns: Array<{
    table: string;
    column: string;
    transformation_type: 'direct' | 'aggregation' | 'expression' | 'window_function';
    confidence: number;
  }>;
}

/**
 * Extract column-level lineage from compiled SQL
 * Maps which source columns contribute to which target columns
 */
extractColumnLineage(
  compiledSQL: string,
  targetTableName: string
): ColumnLineageRelation[] {
  const lineages: ColumnLineageRelation[] = [];
  
  // Step 1: Parse SELECT to get target columns
  const targetColumns = this.parseSelectColumns(selectStatement);
  
  // Step 2: For each target column, find source columns
  for (const targetCol of targetColumns) {
    const sourceColumns = this.traceColumnSources(
      targetCol.expression,
      compiledSQL
    );
    
    if (sourceColumns.length > 0) {
      lineages.push({
        target_column: targetCol.name,
        source_columns: sourceColumns.map(src => ({
          table: src.table,
          column: src.column,
          transformation_type: this.classifyTransformation(targetCol.expression),
          confidence: this.calculateConfidence(targetCol.expression)
        }))
      });
    }
  }
  
  return lineages;
}

/**
 * Trace column back to its source(s)
 */
private traceColumnSources(
  expression: string,
  fullSQL: string
): Array<{ table: string; column: string }> {
  const sources: Array<{ table: string; column: string }> = [];
  
  // Simple case: column reference (e.g., "c.customer_id")
  const simpleRef = expression.match(/(\w+)\.(\w+)/);
  if (simpleRef) {
    const [, tableAlias, columnName] = simpleRef;
    const actualTable = this.resolveTableAlias(tableAlias, fullSQL);
    
    sources.push({
      table: actualTable || tableAlias,
      column: columnName
    });
  }
  
  // Complex case: aggregation (e.g., "COUNT(o.order_id)")
  const aggMatches = expression.matchAll(/(?:COUNT|SUM|AVG|MAX|MIN)\s*\(\s*(\w+)\.(\w+)\s*\)/gi);
  for (const match of aggMatches) {
    const [, tableAlias, columnName] = match;
    const actualTable = this.resolveTableAlias(tableAlias, fullSQL);
    
    sources.push({
      table: actualTable || tableAlias,
      column: columnName
    });
  }
  
  // Expression case: extract all column references
  const allRefs = expression.matchAll(/(\w+)\.(\w+)/g);
  for (const match of allRefs) {
    const [, tableAlias, columnName] = match;
    const actualTable = this.resolveTableAlias(tableAlias, fullSQL);
    
    sources.push({
      table: actualTable || tableAlias,
      column: columnName
    });
  }
  
  return sources;
}

/**
 * Resolve table alias to actual table name
 * e.g., "c" -> "stg_customers"
 */
private resolveTableAlias(alias: string, fullSQL: string): string | null {
  // Pattern: FROM table_name [AS] alias
  const fromRegex = new RegExp(
    `FROM\\s+(?:\\{\\{\\s*ref\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)\\s*\\}\\}|([\\w.]+))\\s+(?:AS\\s+)?${alias}\\b`,
    'i'
  );
  
  const match = fullSQL.match(fromRegex);
  if (match) {
    return match[1] || match[2]; // DBT ref() or table name
  }
  
  // Pattern: JOIN table_name [AS] alias
  const joinRegex = new RegExp(
    `JOIN\\s+(?:\\{\\{\\s*ref\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)\\s*\\}\\}|([\\w.]+))\\s+(?:AS\\s+)?${alias}\\b`,
    'i'
  );
  
  const joinMatch = fullSQL.match(joinRegex);
  if (joinMatch) {
    return joinMatch[1] || joinMatch[2];
  }
  
  return null;
}

/**
 * Classify transformation type (already exists, just reuse)
 */
private classifyTransformation(expression: string): string {
  const upper = expression.toUpperCase();
  
  if (upper.includes('COUNT(') || upper.includes('SUM(') || 
      upper.includes('AVG(') || upper.includes('MAX(') || 
      upper.includes('MIN(')) {
    return 'aggregation';
  }
  
  if (upper.includes('ROW_NUMBER(') || upper.includes('RANK(') ||
      upper.includes('LAG(') || upper.includes('LEAD(')) {
    return 'window_function';
  }
  
  if (upper.includes('CASE ') || upper.includes('CAST(') ||
      upper.includes('COALESCE(') || expression.includes('+') ||
      expression.includes('-') || expression.includes('*')) {
    return 'expression';
  }
  
  return 'direct';
}

/**
 * Calculate confidence (already exists, just reuse)
 */
private calculateConfidence(expression: string): number {
  const transformationType = this.classifyTransformation(expression);
  
  switch (transformationType) {
    case 'direct':
      return 0.95;
    case 'aggregation':
      return 0.90;
    case 'window_function':
      return 0.85;
    case 'expression':
      return 0.80;
    default:
      return 0.75;
  }
}
```

---

### Step 2: Use in ExtractionOrchestrator

```typescript
import { EnhancedSQLParser } from '../parsers/EnhancedSQLParser';

class ExtractionOrchestrator {
  private sqlParser = new EnhancedSQLParser();

  private async storeManifestData(...) {
    // ... store models, columns, dependencies ...
    
    // Parse SQL for column lineage
    await this.extractAndStoreColumnLineage(
      connectionId,
      organizationId,
      parsed.models,
      objectMap
    );
  }

  private async extractAndStoreColumnLineage(
    connectionId: string,
    organizationId: string,
    models: ParsedModel[],
    objectMap: Map<string, string>
  ): Promise<void> {
    console.log(`🔍 Extracting column lineage from SQL...`);
    
    let totalExtracted = 0;
    let totalStored = 0;

    for (const model of models) {
      if (!model.compiled_sql) continue;

      console.log(`   📊 Processing ${model.name}...`);

      try {
        // Extract column lineage using EnhancedSQLParser
        const lineages = this.sqlParser.extractColumnLineage(
          model.compiled_sql,
          model.name
        );

        totalExtracted += lineages.length;

        // Store each lineage relationship
        for (const lineage of lineages) {
          const targetObjectId = objectMap.get(model.name);
          if (!targetObjectId) continue;

          for (const source of lineage.source_columns) {
            const sourceObjectId = objectMap.get(source.table);
            if (!sourceObjectId) continue;

            const { error } = await supabase
              .schema('metadata')
              .from('columns_lineage')
              .upsert({
                organization_id: organizationId,
                source_object_id: sourceObjectId,
                source_column: source.column,
                target_object_id: targetObjectId,
                target_column: lineage.target_column,
                transformation_type: source.transformation_type,
                confidence: source.confidence,
                extracted_from: 'sql_parsing',
                metadata: {
                  parser: 'enhanced-sql-parser'
                }
              }, {
                onConflict: 'source_object_id,source_column,target_object_id,target_column'
              });

            if (!error) {
              totalStored++;
              console.log(`      ✅ ${source.table}.${source.column} → ${lineage.target_column}`);
            }
          }
        }
      } catch (error) {
        console.error(`   ❌ Failed to extract lineage for ${model.name}:`, error);
      }
    }

    console.log(`✅ Column lineage extraction complete: ${totalExtracted} found, ${totalStored} stored`);
  }
}
```

---

## 🧪 Example: customers Model

### Input (Compiled SQL):
```sql
SELECT 
  c.customer_id as customer_id,
  c.first_name,
  c.last_name,
  COUNT(o.order_id) as total_orders,
  SUM(o.amount) as total_spent
FROM {{ ref('stg_customers') }} c
LEFT JOIN {{ ref('stg_orders') }} o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name
```

### Extraction Process:
```typescript
1. Parse SELECT columns:
   - customer_id (direct: c.customer_id)
   - first_name (direct: c.first_name)
   - last_name (direct: c.last_name)
   - total_orders (aggregation: COUNT(o.order_id))
   - total_spent (aggregation: SUM(o.amount))

2. Resolve table aliases:
   - c → stg_customers
   - o → stg_orders

3. Extract lineage:
   - customer_id ← stg_customers.customer_id (direct, 0.95)
   - first_name ← stg_customers.first_name (direct, 0.95)
   - last_name ← stg_customers.last_name (direct, 0.95)
   - total_orders ← stg_orders.order_id (aggregation, 0.90)
   - total_spent ← stg_orders.amount (aggregation, 0.90)
```

### Stored in Database:
```sql
INSERT INTO metadata.columns_lineage VALUES
  ('stg_customers', 'customer_id', 'customers', 'customer_id', 'direct', 0.95),
  ('stg_customers', 'first_name', 'customers', 'first_name', 'direct', 0.95),
  ('stg_customers', 'last_name', 'customers', 'last_name', 'direct', 0.95),
  ('stg_orders', 'order_id', 'customers', 'total_orders', 'aggregation', 0.90),
  ('stg_orders', 'amount', 'customers', 'total_spent', 'aggregation', 0.90);
```

---

## ✅ Implementation Steps

### Phase 1: Extend Parser (30 mins)
- [ ] Add `extractColumnLineage()` method
- [ ] Add `traceColumnSources()` helper
- [ ] Add `resolveTableAlias()` helper
- [ ] Reuse existing `classifyTransformation()` and `calculateConfidence()`

### Phase 2: Integrate (15 mins)
- [ ] Import `EnhancedSQLParser` in `ExtractionOrchestrator`
- [ ] Add `extractAndStoreColumnLineage()` method
- [ ] Call from `storeManifestData()`

### Phase 3: Test (30 mins)
- [ ] Run extraction on jaffle-shop
- [ ] Verify column lineage in backend logs
- [ ] Query database to check stored lineage
- [ ] Validate accuracy of mappings

**Total Time: ~1.5 hours**

---

## 🚀 Next Steps

**Right now:**
1. Extend `EnhancedSQLParser` with column lineage methods
2. Integrate into `ExtractionOrchestrator`
3. Test with jaffle-shop

**Should I implement this now?** 🎯
