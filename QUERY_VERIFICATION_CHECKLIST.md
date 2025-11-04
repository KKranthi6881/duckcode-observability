# Snowflake Query Verification Checklist

## Instructions
Run each query from `BACKEND_SQL_QUERIES_TO_VERIFY.sql` and mark results below.

---

## Quick Tests (Run These First!)

### ✅ TEST 1: QUERY_HISTORY columns
- [ ] Query runs successfully
- [ ] Returns: WAREHOUSE_NAME, WAREHOUSE_SIZE, TOTAL_ELAPSED_TIME, START_TIME
- **Error (if any):**
- **Missing columns:**

### ✅ TEST 2: WAREHOUSE_METERING_HISTORY columns  
- [ ] Query runs successfully
- [ ] Returns: WAREHOUSE_NAME, START_TIME, CREDITS_USED_COMPUTE, CREDITS_USED_CLOUD_SERVICES
- **Error (if any):**
- **Missing columns:**

### ✅ TEST 3: TABLE_STORAGE_METRICS columns
- [ ] Query runs successfully
- [ ] Returns: TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, ACTIVE_BYTES, etc.
- **Error (if any):**
- **Missing columns:**

### ✅ TEST 4: GROUP BY with Window Function
- [ ] Query runs successfully
- **Error (if any):**
- **Note:** This tests if we can use GROUP BY with FIRST_VALUE window function

---

## Main Queries

### Query 1: extractCostMetrics() - Compute Credits
**File:** SnowflakeConnector.ts line ~496
- [ ] ✅ Works perfectly
- [ ] ⚠️ Works with modifications (provide corrected query below)
- [ ] ❌ Fails (provide error below)

**Error/Corrections:**
```sql
-- If modified, paste working query here
```

---

### Query 2: extractCostMetrics() - Storage Costs
**File:** SnowflakeConnector.ts line ~504
- [ ] ✅ Works perfectly
- [ ] ⚠️ Works with modifications
- [ ] ❌ Fails

**Error/Corrections:**
```sql

```

---

### Query 3: extractStorageData()
**File:** SnowflakeConnector.ts line ~525
- [ ] ✅ Works perfectly
- [ ] ⚠️ Works with modifications
- [ ] ❌ Fails

**Error/Corrections:**
```sql

```

---

### Query 4: extractWarehouseMetrics() ⚠️ CURRENTLY FAILING
**File:** SnowflakeConnector.ts line ~577
- [ ] ✅ Works perfectly
- [ ] ⚠️ Works with modifications
- [ ] ❌ Fails

**Current Error:** `invalid identifier 'WAREHOUSE_SIZE'`

**Error/Corrections:**
```sql
-- Provide working version here
-- Pay special attention to:
-- 1. Can we use FIRST_VALUE with PARTITION BY in GROUP BY?
-- 2. Is WAREHOUSE_SIZE in QUERY_HISTORY or somewhere else?
-- 3. Should we use a different approach to get latest warehouse size?
```

---

### Query 5: detectWasteOpportunities()
**File:** SnowflakeConnector.ts line ~627
- [ ] ✅ Works perfectly
- [ ] ⚠️ Works with modifications
- [ ] ❌ Fails

**Error/Corrections:**
```sql

```

---

### Query 6: getStorageUsage()
**File:** SnowflakeCostService.ts line ~263
- [ ] ✅ Works perfectly
- [ ] ⚠️ Works with modifications
- [ ] ❌ Fails

**Error/Corrections:**
```sql

```

---

### Query 7: getStorageCosts()
**File:** SnowflakeCostService.ts line ~292
- [ ] ✅ Works perfectly
- [ ] ⚠️ Works with modifications
- [ ] ❌ Fails

**Error/Corrections:**
```sql

```

---

### Query 8: detectUnusedTables()
**File:** SnowflakeCostService.ts line ~317
- [ ] ✅ Works perfectly
- [ ] ⚠️ Works with modifications
- [ ] ❌ Fails

**Error/Corrections:**
```sql

```

---

## Common Issues to Check

### Window Functions with GROUP BY
Some Snowflake configurations don't allow window functions in queries with GROUP BY.

**Alternative approaches:**
1. Use subquery to get window function results, then aggregate
2. Use separate queries and join
3. Remove window function and use MAX/MIN instead

### Column Name Issues
- [ ] All column names are UPPERCASE in Snowflake results
- [ ] IS_TRANSIENT returns 'YES'/'NO' (TEXT), not boolean
- [ ] DELETED is BOOLEAN (TRUE/FALSE), not NULL/NOT NULL

---

## Summary

**Total Queries:** 8 + 4 tests = 12
**Passing:** ___
**Failing:** ___
**Modified:** ___

**Next Steps:**
Once you've verified all queries, paste the working versions back and I'll update the code.
