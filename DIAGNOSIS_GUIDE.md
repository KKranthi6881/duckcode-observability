# 🔍 Diagnosis Guide: Why Column Lineage is Empty

## 🚨 Root Cause: manifest.json Doesn't Contain Column Information!

### **The Core Issue:**

**manifest.json** only contains columns that are explicitly defined in schema.yml files.  
If your dbt project doesn't have schema.yml files with column definitions, manifest.json will have **ZERO columns** for those models.

---

## 🧪 How to Diagnose

### **Step 1: Check Your Backend Logs**

After uploading or extracting, look for this warning:

```
======================================================================
⚠️  CRITICAL: 15/20 models have NO columns defined!
======================================================================

   WHY: Columns are not defined in schema.yml files.
   IMPACT: Column lineage will be INCOMPLETE or EMPTY.

   📋 HOW TO FIX:
   1. Run 'dbt docs generate' locally (creates catalog.json)
   2. Upload BOTH manifest.json AND catalog.json
   OR define columns in your dbt project schema.yml files

   Models without columns:
      - customers
      - orders
      - products
      ... and 12 more
======================================================================
```

**If you see this:** Your models have no column information!

---

### **Step 2: Check Database**

Query your metadata:

```sql
-- Check if models have columns
SELECT 
  o.name AS model_name,
  COUNT(c.id) AS column_count
FROM metadata.objects o
LEFT JOIN metadata.columns c ON c.object_id = o.id
WHERE o.object_type = 'model'
GROUP BY o.id, o.name
ORDER BY column_count ASC;
```

**Expected Result if Bug:**
```
model_name    | column_count
--------------+-------------
customers     | 0
orders        | 0
products      | 0
```

**Healthy Result:**
```
model_name    | column_count
--------------+-------------
customers     | 5
orders        | 8
products      | 12
```

---

### **Step 3: Check Lineage Query**

```sql
-- Check column lineage
SELECT 
  COUNT(*) AS total_column_lineages
FROM metadata.columns_lineage;
```

**If this is 0:** No column lineage was extracted because there are no columns!

---

## ✅ How to Fix

### **Option 1: Upload catalog.json (RECOMMENDED)**

**Step 1:** Generate catalog.json locally

```bash
cd /path/to/your/dbt/project
dbt docs generate
```

This creates:
- `target/manifest.json` (model definitions)
- `target/catalog.json` (actual columns from database)

**Step 2:** Upload BOTH files

Upload both manifest.json and catalog.json through the UI.

*Note: This feature is coming in next release. For now, use Option 2 or 3.*

---

### **Option 2: Define Columns in schema.yml**

Create or update `models/schema.yml`:

```yaml
version: 2

models:
  - name: customers
    description: Customer dimension table
    columns:
      - name: customer_id
        description: Primary key
        data_type: integer
      - name: email
        description: Customer email
        data_type: varchar
      - name: created_at
        description: Account creation timestamp
        data_type: timestamp
```

Then:
1. Run `dbt parse` locally
2. Upload the new manifest.json

---

### **Option 3: Re-extract with dbt docs generate in Docker**

**Update DbtRunner to run docs generate:**

This requires database credentials, so it's only feasible if:
- You provide database credentials
- OR the dbt project has a dummy target that works

---

## 🧪 Verify Fix

### **After Fix, You Should See:**

**In Logs:**
```
✅ Extracted from manifest:
   📊 20 models
   📁 5 sources
   🔗 45 dependencies (100% accurate)
   📈 127 column lineages

✅ All 20 models have column information
```

**In Database:**
```sql
SELECT 
  COUNT(DISTINCT o.id) AS models_with_columns,
  COUNT(c.id) AS total_columns
FROM metadata.objects o
INNER JOIN metadata.columns c ON c.object_id = o.id
WHERE o.object_type = 'model';

-- Expected: models_with_columns = 20, total_columns > 100
```

**In UI:**
- Column lineage diagrams show columns
- Model cards show column lists
- Lineage graph has column-level connections

---

## 🚀 Immediate Actions

### **For Testing Right Now:**

1. **Check logs** for the warning message
2. **Verify** models have 0 columns in database
3. **Confirm** this explains why lineage is empty
4. **Test** with a dbt project that HAS schema.yml definitions

### **For Production Fix:**

1. **Deploy** the updated ManifestParser (with warnings)
2. **Monitor** logs to see how many users are affected
3. **Implement** catalog.json upload support
4. **Document** the requirement for column definitions

---

## 📊 Expected Timeline

**Immediate (Deployed Now):**
- ✅ Warning messages in logs
- ✅ Warnings stored in database
- ✅ Developers can diagnose the issue

**This Week:**
- 🔄 Add warning UI in frontend
- 🔄 Update documentation
- 🔄 Test with real projects

**Next Week:**
- 🔄 Implement catalog.json upload support
- 🔄 UI for uploading both files
- 🔄 Automatic column merging

---

## 💡 Why This Happened

dbt's manifest.json is designed for:
- ✅ Model-level metadata (names, schemas, dependencies)
- ✅ Documentation (from schema.yml)
- ❌ **NOT for database introspection**

catalog.json is designed for:
- ✅ Actual database columns
- ✅ Data types from database
- ✅ Table statistics
- ✅ Column-level metadata

**We were only using manifest.json, which isn't sufficient for column-level lineage!**

---

## 🎯 Key Takeaway

**manifest.json alone is NOT enough for column lineage.**

You need EITHER:
1. catalog.json (from `dbt docs generate`)
2. OR comprehensive schema.yml files
3. OR SQL column inference (future enhancement)

**We'll fix this by supporting catalog.json uploads!** 🚀
