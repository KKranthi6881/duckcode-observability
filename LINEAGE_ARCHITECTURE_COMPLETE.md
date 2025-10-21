# Complete Lineage Architecture - Model + Column Level 🎯

**Date:** October 20, 2025  
**Goal:** Comprehensive lineage system with high accuracy  
**Approach:** Manifest-guided SQL parsing  

---

## 🎯 Architecture Overview

### Two-Tier Lineage System

```
┌─────────────────────────────────────────────────────────────┐
│                    TIER 1: MODEL LINEAGE                     │
│                   (From dbt manifest.json)                   │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │ stg_customers│─────▶│  customers   │─────▶│   mart    │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                      │                     │      │
│  ┌──────────────┐              │              ┌───────────┐ │
│  │  stg_orders  │──────────────┘              │  orders   │ │
│  └──────────────┘                             └───────────┘ │
│                                                              │
│  ✅ 100% Accurate (from dbt compiler)                       │
│  ✅ Shows: which models depend on which models              │
│  ✅ Stored in: metadata.dependencies                        │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   TIER 2: COLUMN LINEAGE                     │
│                  (From SQL parsing + manifest)               │
│                                                              │
│  customers model:                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ customer_id    ◀── stg_customers.id         (direct) │   │
│  │ first_name     ◀── stg_customers.first_name (direct) │   │
│  │ total_orders   ◀── stg_orders.order_id      (agg)    │   │
│  │ total_spent    ◀── stg_orders.amount        (agg)    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ✅ 80-95% Accurate (from SQL parsing)                      │
│  ✅ Shows: which columns derive from which columns          │
│  ✅ Stored in: metadata.columns_lineage                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔥 Key Innovation: Manifest-Guided Parsing

### Problem with Naive SQL Parsing:
```sql
SELECT 
  c.id as customer_id,
  o.amount
FROM some_table c
LEFT JOIN another_table o ON c.id = o.customer_id
```

**Question:** What are `some_table` and `another_table`?
- ❌ Without manifest: Don't know! Could be anything!
- ✅ With manifest: We KNOW it's stg_customers and stg_orders!

### Our Approach: Use Manifest as Context

```typescript
// Step 1: Get model dependencies from manifest (100% accurate)
const modelDeps = manifest.dependencies;
// customers depends on: [stg_customers, stg_orders]

// Step 2: Parse SQL with this context
const columnLineage = sqlParser.extractColumnLineage(
  model.compiled_sql,
  {
    targetModel: 'customers',
    sourceTables: ['stg_customers', 'stg_orders'],  // ✅ From manifest!
    tableAliases: manifest.extractTableAliases()    // ✅ From compiled SQL
  }
);

// Step 3: Only accept lineages within known dependencies
for (const lineage of columnLineage) {
  if (sourceTables.includes(lineage.source_table)) {
    // ✅ Valid! This is a known dependency
    store(lineage);
  } else {
    // ⚠️ Warning: Found reference to unknown table
    console.warn(`Unexpected dependency: ${lineage.source_table}`);
  }
}
```

**Benefits:**
1. ✅ **Higher Accuracy** - We know the valid source tables
2. ✅ **Validation** - Catch parsing errors (unknown tables)
3. ✅ **Context** - Resolve aliases correctly
4. ✅ **Confidence** - Model deps are 100%, column lineage is 80-95%

---

## 📊 Accuracy Tiers

### GOLD Tier (100% Accurate)
**Source:** dbt manifest.json  
**What:** Model-level dependencies  
**Example:**
```
customers depends on stg_customers ✅
customers depends on stg_orders    ✅
```

**Storage:**
```sql
metadata.dependencies
- confidence: 1.00
- extracted_from: 'manifest'
```

---

### SILVER Tier (90-95% Accurate)
**Source:** SQL parsing with manifest guidance  
**What:** Direct column mappings  
**Example:**
```sql
-- Direct column reference
SELECT c.customer_id as customer_id
FROM stg_customers c

Result: 
stg_customers.customer_id → customers.customer_id
Confidence: 0.95 ✅
```

**Why High Accuracy:**
- Simple column references
- No transformations
- Clear lineage path
- Manifest validates source table

---

### BRONZE Tier (80-90% Accurate)
**Source:** SQL parsing (complex expressions)  
**What:** Aggregations, calculations  
**Example:**
```sql
-- Aggregation
SELECT COUNT(o.order_id) as total_orders
FROM stg_orders o

Result:
stg_orders.order_id → customers.total_orders
Confidence: 0.85 ✅
```

**Why Lower Accuracy:**
- Aggregation functions
- Multiple columns may contribute
- GROUP BY affects logic
- But still high confidence!

---

### BRONZE- Tier (70-80% Accurate)
**Source:** SQL parsing (very complex)  
**What:** CASE statements, window functions, complex expressions  
**Example:**
```sql
-- Complex CASE
SELECT 
  CASE 
    WHEN c.lifetime_value > 1000 THEN 'premium'
    WHEN c.order_count > 10 THEN 'regular'
    ELSE 'new'
  END as customer_segment
FROM stg_customers c
```

**Why Lower Accuracy:**
- Multiple columns involved
- Conditional logic
- Hard to trace exact lineage
- May need manual review

---

## 🎨 Visualization Strategy

### Level 1: Model-Level Lineage (DAG View)

**UI Component:** `ModelLineageGraph.tsx`

```
┌─────────────────────────────────────────────────────────┐
│                   Data Lineage Graph                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│    ┌───────────────┐                                    │
│    │ raw_customers │                                    │
│    └───────┬───────┘                                    │
│            ├──────────────┐                             │
│            │              │                             │
│            ▼              ▼                             │
│    ┌───────────────┐  ┌─────────────┐                 │
│    │ stg_customers │  │ stg_orders  │                 │
│    └───────┬───────┘  └──────┬──────┘                 │
│            │                  │                         │
│            └─────────┬────────┘                         │
│                      ▼                                  │
│              ┌───────────────┐                         │
│              │   customers   │ ◀── You are here       │
│              └───────┬───────┘                         │
│                      │                                  │
│                      ▼                                  │
│              ┌───────────────┐                         │
│              │  fact_orders  │                         │
│              └───────────────┘                         │
│                                                          │
│  [Show Column Lineage] [Export] [Full Screen]          │
└─────────────────────────────────────────────────────────┘

Features:
✅ Interactive: Click model to see details
✅ Confidence badges: 🟢 100% (manifest)
✅ Filter: Show only upstream/downstream
✅ Search: Find specific models
✅ Zoom: Pan and zoom graph
```

### Level 2: Column-Level Lineage (Table View)

**UI Component:** `ColumnLineageViewer.tsx`

```
┌─────────────────────────────────────────────────────────┐
│         Column Lineage: customers model                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Target Column    │ Source Columns           │ Type     │
│ ─────────────────┼─────────────────────────┼─────────  │
│  customer_id  🟢  │ stg_customers.id         │ direct   │
│                   │ (confidence: 95%)        │          │
│ ─────────────────┼─────────────────────────┼─────────  │
│  first_name   🟢  │ stg_customers.first_name │ direct   │
│                   │ (confidence: 95%)        │          │
│ ─────────────────┼─────────────────────────┼─────────  │
│  last_name    🟢  │ stg_customers.last_name  │ direct   │
│                   │ (confidence: 95%)        │          │
│ ─────────────────┼─────────────────────────┼─────────  │
│  total_orders 🟡  │ stg_orders.order_id      │ agg      │
│                   │ (confidence: 85%)        │ (COUNT)  │
│ ─────────────────┼─────────────────────────┼─────────  │
│  total_spent  🟡  │ stg_orders.amount        │ agg      │
│                   │ (confidence: 85%)        │ (SUM)    │
│ ─────────────────┴─────────────────────────┴─────────  │
│                                                          │
│  Legend: 🟢 High (90-100%)  🟡 Medium (80-90%)          │
│          🟠 Low (70-80%)    🔴 Needs Review (<70%)      │
│                                                          │
│  [View SQL] [Show Diagram] [Export]                     │
└─────────────────────────────────────────────────────────┘
```

### Level 3: Column Lineage Diagram (Flow View)

**UI Component:** `ColumnLineageDiagram.tsx`

```
┌─────────────────────────────────────────────────────────┐
│    Column Lineage: customers.customer_id                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌─────────────────────────────────────────────┐      │
│   │         raw_customers                       │      │
│   │  ┌──────────────┐                          │      │
│   │  │ id (INTEGER) │──────────┐               │      │
│   │  └──────────────┘          │               │      │
│   └───────────────────────────│───────────────┘      │
│                                │                       │
│                                │ (direct)              │
│                                ▼                       │
│   ┌─────────────────────────────────────────────┐     │
│   │         stg_customers                       │     │
│   │  ┌───────────────────┐                     │     │
│   │  │ customer_id (INT) │──────────┐          │     │
│   │  └───────────────────┘          │          │     │
│   └───────────────────────────────│─┘          │     │
│                                    │            │     │
│                                    │ (direct)   │     │
│                                    │ 95% conf   │     │
│                                    ▼            │     │
│   ┌─────────────────────────────────────────────┐    │
│   │         customers                           │    │
│   │  ┌───────────────────┐                     │    │
│   │  │ customer_id (INT) │ ◀── You are here   │    │
│   │  └───────────────────┘                     │    │
│   └─────────────────────────────────────────────┘    │
│                                                       │
│   [< Back] [Next Column >] [Export]                  │
└───────────────────────────────────────────────────────┘
```

---

## 🔍 Accuracy Validation

### Automated Validation
```typescript
// Check 1: All source tables in lineage match manifest dependencies
for (const lineage of columnLineages) {
  if (!manifestDeps.includes(lineage.source_table)) {
    throw new Error(`Invalid lineage: ${lineage.source_table} not in manifest`);
  }
}

// Check 2: All source columns exist in source table
for (const lineage of columnLineages) {
  const sourceColumns = await getColumns(lineage.source_table);
  if (!sourceColumns.includes(lineage.source_column)) {
    console.warn(`Column ${lineage.source_column} not found in ${lineage.source_table}`);
    lineage.confidence = Math.min(lineage.confidence, 0.70);
  }
}

// Check 3: Data type compatibility
if (targetColumn.type !== sourceColumn.type) {
  // Lower confidence if types don't match
  lineage.confidence *= 0.90;
}
```

### Manual Review Flags
```sql
-- Flag lineages that need human review
SELECT 
  target_column,
  source_column,
  confidence
FROM metadata.columns_lineage
WHERE confidence < 0.80
   OR transformation_type = 'expression'
ORDER BY confidence ASC;

-- Add review status
ALTER TABLE metadata.columns_lineage 
ADD COLUMN reviewed_by VARCHAR,
ADD COLUMN review_status VARCHAR DEFAULT 'pending';
```

---

## 📊 Expected Accuracy Breakdown

### For jaffle-shop-classic:

**Model-Level Lineage:**
```
Total: 8 models
Accuracy: 100% (from manifest)
Confidence: 1.00

customers → stg_customers, stg_orders ✅
orders → stg_orders, stg_payments ✅
```

**Column-Level Lineage:**
```
Total: ~15-25 column relationships
Breakdown:
- Direct mappings (60%): 90-95% confidence 🟢
- Aggregations (30%): 85-90% confidence 🟡
- Expressions (10%): 75-85% confidence 🟠

Overall: 85-90% average accuracy ✅
```

---

## 🎯 Implementation Phases

### Phase 1: Foundation (Current)
✅ Model-level lineage from manifest (100%)  
✅ All data stored in metadata.* tables  
✅ EnhancedSQLParser ready  

### Phase 2: Column Lineage (This Week)
- [ ] Extend EnhancedSQLParser with column lineage
- [ ] Add manifest-guided parsing
- [ ] Store column lineage with confidence scores
- [ ] Add validation checks

### Phase 3: Visualization (Next Week)
- [ ] Model lineage graph (D3.js or Mermaid)
- [ ] Column lineage table view
- [ ] Column flow diagram
- [ ] Search and filter

### Phase 4: Quality (Week 3)
- [ ] Manual review workflow
- [ ] Confidence threshold alerts
- [ ] Data quality metrics
- [ ] Export/reporting

---

## 📈 Success Metrics

### Quantitative:
- **Model Lineage:** 100% coverage, 100% accuracy
- **Column Lineage:** 80%+ coverage, 85%+ accuracy
- **API Response:** <500ms for lineage queries
- **UI Load Time:** <2s for visualization

### Qualitative:
- Users can trace data from source to target
- Clear confidence indicators
- Easy to understand visualizations
- Identifies data quality issues

---

## 🔥 Competitive Advantage

### vs dbt Cloud:
- ✅ Same manifest-based model lineage
- ✅ Same SQL parsing for column lineage
- ✅ We add: confidence scores
- ✅ We add: validation checks

### vs Atlan/Metaphor:
- ✅ Similar architecture
- ✅ We focus on dbt (specialized)
- ✅ Faster for dbt projects
- ✅ Better accuracy for dbt models

---

## ✅ Summary

**Model Lineage:**
- Source: dbt manifest.json
- Accuracy: 100% (GOLD)
- Visualization: DAG graph

**Column Lineage:**
- Source: SQL parsing + manifest context
- Accuracy: 85-90% average
- Visualization: Table + flow diagram

**Key Innovation:**
- Use manifest to guide SQL parsing
- Validate lineages against known dependencies
- Assign confidence scores

**Ready to implement?** 🚀
