# 🧪 Test Python SQLGlot with Jaffle Shop

## Quick Test to Verify Implementation

The nba-monte-carlo project has 0 column definitions, making it impossible to test column lineage.

Let's test with **jaffle-shop** which has proper column definitions:

### **1. Connect jaffle-shop via GitHub**

Repository: `https://github.com/dbt-labs/jaffle-shop`
Branch: `main`

### **2. Trigger Extraction**

Expected result:
```bash
🐍 Python SQLGlot: 15 lineages (95% accuracy)
✅ customers.customer_id → stg_customers.customer_id (direct, 95%)
✅ customers.first_name → stg_customers.first_name (direct, 95%)
✅ customers.last_name → stg_customers.last_name (direct, 95%)
...
```

### **3. Check Database**

```sql
SELECT 
  source_object_name,
  source_column_name,
  target_object_name,
  target_column_name,
  metadata->>'parser' as parser,
  confidence
FROM metadata.columns_lineage
WHERE metadata->>'parser' = 'python-sqlglot-ast'
ORDER BY target_object_name, target_column_name;
```

Expected: 30+ lineages with `parser = 'python-sqlglot-ast'`

---

## Why jaffle-shop Will Show Lineage

jaffle-shop models have column definitions in `models/schema.yml`:

```yaml
models:
  - name: customers
    columns:
      - name: customer_id
      - name: first_name
      - name: last_name
      - name: first_order
      - name: most_recent_order
      - name: number_of_orders
```

With columns defined → Python SQLGlot can extract accurate lineage!

---

## Comparison

| Project | Columns Defined | Python SQLGlot Used | Lineages Extracted |
|---------|-----------------|---------------------|-------------------|
| nba-monte-carlo | ❌ 0/66 | ✅ Yes | 0 (no columns) |
| jaffle-shop | ✅ Yes | ✅ Yes | 30+ expected |
