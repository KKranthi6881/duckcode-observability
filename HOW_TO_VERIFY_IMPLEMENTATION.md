# 🔍 How to Verify Python SQLGlot is Working

## Backend Log Messages to Look For

### **Python SQLGlot Service (95% Accuracy)**

When extraction runs, you should see these messages in backend logs:

```bash
# 1. Health check before extraction
🔍 Parsing compiled SQL for additional column lineage...
   Using Python SQLGlot AST parser (95% accuracy)

# 2. Service health check
[PythonSQLGlot] ✅ Service healthy
[PythonSQLGlot] SQLGlot version: 20.9.0

# 3. For each model processed
   📊 Processing: customers
      Dependencies: stg_customers, orders
      🐍 Python SQLGlot: 15 lineages (95% accuracy)
      ✅ stg_customers.id → customer_id (direct, 95%)
      ✅ orders.total → revenue (aggregation, 90%)
```

### **Fallback to Regex Parser (70-80% Accuracy)**

If Python service is unavailable, you'll see:

```bash
⚠️  Python SQLGlot service not available - falling back to regex parser (70-80% accuracy)
   To enable high-accuracy lineage, start the service: docker-compose up python-sqlglot-service

# Then for each model:
   📊 Processing: customers
      Dependencies: stg_customers, orders
      📝 Regex parser: 12 lineages (70-80% accuracy)
```

---

## Quick Verification Commands

### **1. Check Python Service is Running**

```bash
# Should return healthy status
curl http://localhost:8000/health

# Expected output:
{"status":"healthy","service":"python-sqlglot-column-lineage","sqlglot_version":"20.9.0"}
```

### **2. Check Backend Logs During Extraction**

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend

# Watch logs in real-time
npm start 2>&1 | grep -E "Python SQLGlot|🐍|SQLGlot|regex parser"
```

### **3. Check Database After Extraction**

```sql
-- Connect to your database
psql -U postgres -d your_database

-- Check which parser was used
SELECT 
  metadata->>'parser' as parser,
  metadata->>'accuracy_tier' as tier,
  COUNT(*) as lineage_count,
  ROUND(AVG(confidence)::numeric, 2) as avg_confidence
FROM metadata.columns_lineage
WHERE organization_id = 'your-org-id'
  AND created_at > NOW() - INTERVAL '1 hour'  -- Recent extractions
GROUP BY parser, tier;
```

**Expected output if using Python SQLGlot:**
```
        parser          | tier | lineage_count | avg_confidence
------------------------|------|---------------|---------------
python-sqlglot-ast      | GOLD | 150           | 0.93
```

**If using regex parser:**
```
        parser          | tier | lineage_count | avg_confidence
------------------------|------|---------------|---------------
enhanced-sql-parser     | SILVER| 85           | 0.75
```

---

## Test Extraction Flow

### **Option 1: Trigger Test Extraction**

```bash
# Via API (replace with your connection ID and token)
curl -X POST http://localhost:3001/api/metadata/extract/YOUR_CONNECTION_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Watch backend logs for messages above
```

### **Option 2: Via Admin UI**

1. Go to http://localhost:5175/admin
2. Click "Extract Metadata" on a connection
3. Watch terminal logs for Python SQLGlot messages

---

## Detailed Verification Checklist

### ✅ **Python Service Health**
- [ ] Container running: `docker ps | grep python-sqlglot`
- [ ] Health check passes: `curl http://localhost:8000/health`
- [ ] Backend can reach it: Check logs for "Service healthy"

### ✅ **Backend Integration**
- [ ] Health check runs: Log shows "Using Python SQLGlot AST parser"
- [ ] Service called: Log shows "🐍 Python SQLGlot: X lineages"
- [ ] Database stores parser: `metadata->>'parser' = 'python-sqlglot-ast'`

### ✅ **Accuracy Indicators**
- [ ] Accuracy: Shows "95% accuracy" in logs
- [ ] Tier: Database shows `accuracy_tier = 'GOLD'`
- [ ] Confidence: Average confidence ~0.90-0.95

---

## Sample Complete Log Output

When everything is working correctly, extraction logs should look like:

```bash
🚀 Starting extraction for connection: abc-123-def
============================================================

📦 Cloning GitHub repository: https://github.com/user/dbt-project
   Branch: main
   Target: /tmp/dbt-extractions/dbt-project-1234567890

✅ Repository cloned successfully

🔍 Searching for dbt_project.yml in repository...
✅ Found dbt_project.yml at: /tmp/dbt-extractions/dbt-project-1234567890

🏃 Running dbt parse in Docker...
   Docker command: docker run --rm -v /tmp/dbt-extractions/...

✅ dbt parse completed successfully
   Duration: 45.3 seconds

📖 Parsing manifest.json...
✅ Manifest parsed successfully
   - dbt version: 1.7.0
   - Models: 25
   - Sources: 8
   - Tests: 45

💾 Storing models and sources in database...
✅ Stored 25 models
✅ Stored 8 sources
✅ Stored 150 dependencies

🔍 Parsing compiled SQL for additional column lineage...
   Using Python SQLGlot AST parser (95% accuracy)

[PythonSQLGlot] ✅ Service healthy
[PythonSQLGlot] SQLGlot version: 20.9.0

   📊 Processing: customers
      Dependencies: stg_customers, orders
      🐍 Python SQLGlot: 15 lineages (95% accuracy)
      ✅ stg_customers.id → customer_id (direct, 95%)
      ✅ stg_customers.name → customer_name (direct, 95%)
      ✅ orders.total → total_spent (aggregation, 90%)

   📊 Processing: orders_summary
      Dependencies: orders, customers
      🐍 Python SQLGlot: 8 lineages (95% accuracy)
      ✅ orders.order_date → order_date (direct, 95%)
      ✅ customers.name → customer_name (direct, 95%)

📊 COLUMN LINEAGE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Extracted: 142
Stored:    138   (97% success rate)
Skipped:   4     (missing references)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Parser: python-sqlglot-ast (AST)
Tier: GOLD
Accuracy: ~95%+

✅ EXTRACTION COMPLETED
   Duration: 2m 15s
   Status: Success
```

---

## Troubleshooting

### **If you see regex parser instead of Python SQLGlot:**

1. **Check Python service:**
```bash
docker ps | grep python-sqlglot
curl http://localhost:8000/health
```

2. **Restart Python service:**
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability/backend
docker-compose -f docker-compose.python-sqlglot.yml restart
```

3. **Check backend .env:**
```bash
grep PYTHON_SQLGLOT /Users/Kranthi_1/duck-main/duckcode-observability/backend/.env
# Should show: PYTHON_SQLGLOT_SERVICE_URL=http://localhost:8000
```

4. **Test connectivity:**
```bash
# From backend server
curl http://localhost:8000/health
```

---

## Summary: What to Look For

**✅ Using Python SQLGlot (95% accuracy):**
- Log: "🐍 Python SQLGlot: X lineages (95% accuracy)"
- Database: `parser = 'python-sqlglot-ast'`
- Database: `accuracy_tier = 'GOLD'`
- Confidence: ~0.90-0.95

**❌ Using Regex Parser (70-80% accuracy):**
- Log: "📝 Regex parser: X lineages (70-80% accuracy)"
- Database: `parser = 'enhanced-sql-parser'`
- Database: `accuracy_tier = 'SILVER'`
- Confidence: ~0.70-0.80

---

**Quick Test:** Run extraction and grep for "🐍" in logs. If you see it, Python SQLGlot is working!
