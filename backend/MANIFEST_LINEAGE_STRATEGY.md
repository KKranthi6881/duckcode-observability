# DBT Manifest-Based Column Lineage Strategy

## Problem Statement
Current SQL parsing can't accurately determine:
- Which source column → target column mapping
- Transformations applied (CAST, COALESCE, etc.)
- Column renaming with complex expressions

## Solution: Use DBT Manifest

### manifest.json Structure

```json
{
  "nodes": {
    "model.jaffle_shop.customers": {
      "columns": {
        "customer_id": {
          "name": "customer_id",
          "data_type": "integer"
        },
        "first_name": {
          "name": "first_name",
          "data_type": "varchar"
        }
      },
      "depends_on": {
        "nodes": ["model.jaffle_shop.stg_customers"]
      },
      "compiled_code": "SELECT customer_id, first_name FROM stg_customers"
    }
  },
  "parent_map": {
    "model.jaffle_shop.customers": ["model.jaffle_shop.stg_customers"]
  },
  "child_map": {
    "model.jaffle_shop.stg_customers": ["model.jaffle_shop.customers"]
  }
}
```

### Column Lineage Extraction Strategy

#### Approach 1: Use SQLGlot on Compiled SQL
```typescript
// For each model in manifest
const model = manifest.nodes['model.jaffle_shop.customers'];
const compiledSQL = model.compiled_code;

// Parse compiled SQL (no Jinja, no CTEs - just pure SQL)
const lineage = await this.extractColumnLineage(compiledSQL);

// Result:
// customers.customer_id ← stg_customers.customer_id
// customers.first_name ← stg_customers.first_name
```

**Advantages:**
- Compiled SQL is clean (no Jinja macros)
- All refs() resolved to actual table names
- CTEs are expanded inline
- 95%+ accuracy with SQLGlot

#### Approach 2: Use DBT Column-Level Lineage (dbt-core v1.6+)
```json
{
  "nodes": {
    "model.jaffle_shop.customers": {
      "column_lineage": {
        "customer_id": {
          "columns": [
            {
              "name": "customer_id",
              "node_id": "model.jaffle_shop.stg_customers"
            }
          ]
        }
      }
    }
  }
}
```

**NOTE:** This requires dbt >= 1.6 and `+column_lineage: true` in dbt_project.yml

#### Approach 3: Hybrid - Manifest Dependencies + SQLGlot
```typescript
class ColumnLineageExtractor {
  async extractFromManifest(manifest: DBTManifest): Promise<ColumnLineage[]> {
    const lineages: ColumnLineage[] = [];
    
    for (const [modelId, node] of Object.entries(manifest.nodes)) {
      // 1. Get model-level dependencies from manifest (100% accurate)
      const upstreamModels = node.depends_on.nodes;
      
      // 2. Parse compiled SQL for column mapping
      const columnMappings = await this.parseCompiledSQL(
        node.compiled_code,
        upstreamModels
      );
      
      // 3. Store column lineage
      for (const mapping of columnMappings) {
        lineages.push({
          target_column: `${node.name}.${mapping.targetColumn}`,
          source_columns: mapping.sourceColumns.map(sc => 
            `${sc.model}.${sc.column}`
          ),
          transformation: mapping.expression,
          confidence: mapping.confidence
        });
      }
    }
    
    return lineages;
  }
  
  private async parseCompiledSQL(
    compiledSQL: string,
    upstreamModels: string[]
  ): Promise<ColumnMapping[]> {
    // Use SQLGlot to parse SELECT statement
    const ast = sqlglot.parse(compiledSQL, { dialect: 'duckdb' });
    
    // Extract column expressions
    const selectColumns = ast.find_all('Column');
    
    return selectColumns.map(col => ({
      targetColumn: col.alias || col.name,
      sourceColumns: this.resolveSource(col, upstreamModels),
      expression: col.sql(),
      confidence: this.calculateConfidence(col)
    }));
  }
}
```

## Implementation Plan

### Phase 1: Basic Manifest Support (Week 1)
- [x] Detect dbt_project.yml
- [ ] Parse manifest.json if present
- [ ] Extract models, columns from manifest
- [ ] Store model-level dependencies (100% accurate)

### Phase 2: Column Lineage (Week 2)
- [ ] Parse compiled_code with SQLGlot
- [ ] Map SELECT columns to source columns
- [ ] Handle CASE WHEN, COALESCE, CAST
- [ ] Store column-level lineage

### Phase 3: Without Manifest Fallback (Week 3)
- [ ] Keep current SQL parser for non-dbt projects
- [ ] Improve CTE handling in raw SQL
- [ ] Add heuristics for column lineage guessing

### Phase 4: Advanced Features (Week 4)
- [ ] Support dbt column_lineage field (v1.6+)
- [ ] Handle macros and custom logic
- [ ] Add confidence scores per column mapping

## Database Schema Changes

```sql
-- Add column_lineage table
CREATE TABLE metadata.column_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_column_id UUID REFERENCES metadata.columns(id),
  source_column_id UUID REFERENCES metadata.columns(id),
  transformation TEXT,  -- SQL expression
  confidence FLOAT,     -- 0.0 - 1.0
  extracted_from TEXT,  -- 'manifest' | 'sql_parsing'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lineage queries
CREATE INDEX idx_column_lineage_target ON metadata.column_lineage(target_column_id);
CREATE INDEX idx_column_lineage_source ON metadata.column_lineage(source_column_id);
```

## Testing Strategy

### Test Cases
1. **Manifest with column lineage** → 100% accuracy expected
2. **Manifest without column lineage** → Parse compiled_code → 95%+ accuracy
3. **No manifest, dbt project** → Parse raw SQL → 70-80% accuracy
4. **Non-dbt SQL** → Current parser → 50-60% accuracy

### Success Metrics
- Model-level dependencies: 100% accuracy (from manifest)
- Column-level lineage: 95%+ accuracy (from compiled SQL)
- Parsing time: < 5 seconds for 100 models

## Next Steps
1. Create ManifestParser service
2. Add manifest.json upload endpoint
3. Integrate with existing MetadataExtractionOrchestrator
4. Add UI toggle: "Use manifest.json" vs "Parse SQL"
