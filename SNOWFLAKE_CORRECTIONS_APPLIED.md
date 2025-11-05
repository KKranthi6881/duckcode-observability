# Snowflake Metadata Queries - Corrections Applied

## ✅ Summary

Based on your validation of actual Snowflake ACCOUNT_USAGE tables, we've corrected all SQL queries and documentation.

---

## 🔧 **Key Corrections Made**

### 1. **credits_used → credits_used_cloud_services**
**Issue:** `credits_used` column doesn't exist in QUERY_HISTORY  
**Fix:** Changed ALL references to `credits_used_cloud_services`

**Affected Queries:**
- Daily cost tracking
- Warehouse-level budget tracking  
- User cost attribution
- Security summary queries
- Budget vs actual spending

**Example:**
```sql
-- ❌ BEFORE (Incorrect):
SUM(credits_used) * 3.0 as total_cost_usd

-- ✅ AFTER (Correct):
SUM(credits_used_cloud_services) * 3.0 as total_cost_usd
```

---

### 2. **average_bytes → average_hybrid_table_storage_bytes**
**Issue:** `average_bytes` column doesn't exist in DATABASE_STORAGE_USAGE_HISTORY  
**Fix:** Changed to `average_hybrid_table_storage_bytes`

**Example:**
```sql
-- ❌ BEFORE (Incorrect):
SUM(average_bytes) / POWER(1024, 4) as storage_tb

-- ✅ AFTER (Correct):
SUM(average_hybrid_table_storage_bytes) / POWER(1024, 4) as storage_tb
```

---

### 3. **role_name → role**
**Issue:** Column in GRANTS_TO_USERS is named `role` not `role_name`  
**Fix:** Changed all references in role assignment queries

**Example:**
```sql
-- ❌ BEFORE (Incorrect):
SELECT grantee_name, role_name FROM GRANTS_TO_USERS

-- ✅ AFTER (Correct):  
SELECT grantee_name, role FROM GRANTS_TO_USERS
```

---

### 4. **OBJECT_PRIVILEGES table doesn't exist**
**Issue:** `SNOWFLAKE.ACCOUNT_USAGE.OBJECT_PRIVILEGES` table does not exist  
**Fix:** Use `GRANTS_TO_ROLES` instead

**Example:**
```sql
-- ❌ BEFORE (Incorrect):
FROM SNOWFLAKE.ACCOUNT_USAGE.OBJECT_PRIVILEGES

-- ✅ AFTER (Correct):
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
WHERE granted_on IN ('TABLE', 'VIEW', 'DATABASE', 'SCHEMA')
```

---

### 5. **query_text removed from ACCESS_HISTORY**
**Issue:** `query_text` column not available in ACCESS_HISTORY sample query  
**Fix:** Removed from SELECT list (line 202 in validation file)

---

## 📝 **Files Updated**

### 1. **SNOWFLAKE_METADATA_VALIDATION.sql**
- ✅ You manually corrected this file
- All queries now use correct column names
- Ready to run in Snowflake SQL Worksheet

### 2. **SNOWFLAKE_BUDGET_SECURITY_EXTRACTION.sql**
- ✅ Updated all `credits_used` → `credits_used_cloud_services`
- ✅ Updated all `average_bytes` → `average_hybrid_table_storage_bytes`
- ✅ Updated all `role_name` → `role`
- ✅ Changed `OBJECT_PRIVILEGES` → `GRANTS_TO_ROLES`
- ✅ Added comments noting corrections

### 3. **SNOWFLAKE_TABLES_REFERENCE.md**
- ✅ Updated column documentation
- ✅ Updated sample queries
- ✅ Updated data mapping summary
- ✅ Added warnings about non-existent columns
- ✅ Fixed OBJECT_PRIVILEGES section

---

## ✅ **Validation Checklist**

Run these in Snowflake to confirm corrections work:

```sql
-- 1. Test credits_used_cloud_services exists
SELECT credits_used_cloud_services 
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY 
LIMIT 1;
-- ✅ Should return a value

-- 2. Test average_hybrid_table_storage_bytes exists
SELECT average_hybrid_table_storage_bytes 
FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY 
LIMIT 1;
-- ✅ Should return a value

-- 3. Test role column exists
SELECT role 
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS 
LIMIT 1;
-- ✅ Should return a value

-- 4. Test GRANTS_TO_ROLES exists
SELECT COUNT(*) 
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
WHERE granted_on IN ('TABLE', 'VIEW');
-- ✅ Should return count > 0
```

---

## 🎯 **What This Fixes**

### Before Corrections:
- ❌ Backend queries would fail with "column not found" errors
- ❌ SecurityMonitoringService would return no data
- ❌ BudgetTrackingService would fail to calculate costs
- ❌ Permission audit queries would error

### After Corrections:
- ✅ All queries use correct column names
- ✅ SecurityMonitoringService will retrieve user costs
- ✅ BudgetTrackingService will calculate accurate spending
- ✅ Permission audits will work correctly
- ✅ Ready to implement backend data extraction

---

## 🚀 **Next Steps**

### 1. **Test in Snowflake** (DO THIS FIRST!)
```bash
# Run the validation script in Snowflake:
# File: SNOWFLAKE_METADATA_VALIDATION.sql
# Should see all ✅ PASS results
```

### 2. **Extract Sample Data**
```bash
# Run the extraction queries:
# File: SNOWFLAKE_BUDGET_SECURITY_EXTRACTION.sql
# Section 2.1: User Cost Attribution (most important)
# Section 4.1: Budget Tracking
```

### 3. **Load into Supabase**
```bash
# Insert extracted data into your Supabase tables:
# - enterprise.snowflake_user_costs
# - enterprise.snowflake_access_patterns
# - enterprise.snowflake_role_permissions
```

### 4. **Test Backend APIs**
```bash
# Start backend and test endpoints:
GET /api/connectors/:id/security/user-costs
GET /api/connectors/:id/security/summary
GET /api/connectors/:id/budgets/:budgetId/spend
```

### 5. **Verify Frontend**
```bash
# Navigate to Security tab in dashboard
# Should now load without errors!
```

---

## 📊 **Corrected Column Reference**

Quick reference for backend implementation:

| Feature | Table | OLD Column (Wrong) | NEW Column (Correct) |
|---------|-------|-------------------|---------------------|
| Cost calculation | QUERY_HISTORY | `credits_used` | `credits_used_cloud_services` |
| Storage size | DATABASE_STORAGE_USAGE_HISTORY | `average_bytes` | `average_hybrid_table_storage_bytes` |
| User roles | GRANTS_TO_USERS | `role_name` | `role` |
| Object permissions | OBJECT_PRIVILEGES | N/A (doesn't exist) | Use GRANTS_TO_ROLES |

---

## ⚠️ **Important Notes**

### Credit Pricing
```sql
-- Standard Snowflake pricing per credit:
-- Standard Edition: ~$2.00/credit
-- Enterprise Edition: ~$3.00/credit
-- Business Critical: ~$4.00/credit

-- Update multiplier in ALL queries:
SUM(credits_used_cloud_services) * 3.0  -- Change 3.0 to YOUR price
```

### Data Latency
- ACCOUNT_USAGE views have 45 min - 3 hour lag
- Not suitable for real-time dashboards
- Use INFORMATION_SCHEMA for real-time (different schema)

### Required Permissions
```sql
-- Option 1: Use ACCOUNTADMIN
USE ROLE ACCOUNTADMIN;

-- Option 2: Grant specific access
GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE your_role;
```

---

## ✅ **Status: READY FOR TESTING**

All SQL queries have been corrected and are ready to:
1. ✅ Run in Snowflake SQL Worksheet
2. ✅ Extract real data
3. ✅ Load into Supabase
4. ✅ Power backend APIs
5. ✅ Display in frontend dashboard

**Your validation was correct!** The queries now match your actual Snowflake schema. 🎉
