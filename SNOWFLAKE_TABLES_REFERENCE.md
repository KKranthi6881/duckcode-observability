# Snowflake Tables & Columns Reference

Quick reference for all Snowflake ACCOUNT_USAGE views we're querying.

---

## 🎯 **Budget Guardrails Data Sources**

### 1. **SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY**
**Purpose:** Primary source for cost tracking and budget spend calculation

**Key Columns Used:**
```sql
- query_id              → Unique query identifier
- start_time            → When query started (for date grouping)
- end_time              → When query ended
- user_name             → Who ran the query
- role_name             → Role used
- warehouse_name        → Which warehouse (KEY for warehouse budgets)
- database_name         → Database accessed
- schema_name           → Schema accessed
- query_type            → SELECT, INSERT, etc.
- execution_status      → SUCCESS, FAILED, etc.
- total_elapsed_time    → Execution time in milliseconds
- credits_used_cloud_services → **MOST IMPORTANT** - Cost calculation base (Note: 'credits_used' column doesn't exist)
- bytes_scanned         → Data accessed
- bytes_written         → Data written
```

**Sample Query:**
```sql
SELECT 
    DATE(start_time) as usage_date,
    warehouse_name,
    SUM(credits_used_cloud_services) * 3.0 as total_cost_usd  -- Adjust multiplier!
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
GROUP BY DATE(start_time), warehouse_name;
```

---

### 2. **SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY**
**Purpose:** Alternative/backup for warehouse cost tracking

**Key Columns Used:**
```sql
- start_time                    → Metering period start
- end_time                      → Metering period end
- warehouse_name                → Warehouse identifier
- credits_used                  → Total credits for period
- credits_used_compute          → Compute credits only
- credits_used_cloud_services   → Cloud services credits
```

**Sample Query:**
```sql
SELECT 
    DATE(start_time) as usage_date,
    warehouse_name,
    SUM(credits_used) as total_credits
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
GROUP BY DATE(start_time), warehouse_name;
```

---

### 3. **SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY**
**Purpose:** Storage costs for budget tracking

**Key Columns Used:**
```sql
- usage_date                 → Date of storage measurement
- database_name              → Database name
- average_database_bytes     → Database data size
- average_failsafe_bytes     → Failsafe storage
- average_hybrid_table_storage_bytes → **KEY** - Total storage bytes (Note: 'average_bytes' doesn't exist)
- average_stage_bytes        → Stage storage
```

**Sample Query:**
```sql
SELECT 
    DATE(usage_date) as usage_date,
    database_name,
    SUM(average_hybrid_table_storage_bytes) / POWER(1024, 4) as storage_tb,
    SUM(average_hybrid_table_storage_bytes) / POWER(1024, 4) * 23 as monthly_cost_usd  -- $23/TB
FROM SNOWFLAKE.ACCOUNT_USAGE.DATABASE_STORAGE_USAGE_HISTORY
WHERE usage_date >= DATEADD(day, -30, CURRENT_DATE())
GROUP BY DATE(usage_date), database_name;
```

---

## 🔐 **Security Monitoring Data Sources**

### 4. **SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY** (Same table, different use)
**Purpose:** User cost attribution - who's spending what

**Key Columns for Security:**
```sql
- user_name             → **KEY** - User identification
- role_name             → Role used by user  
- warehouse_name        → Top warehouse per user
- credits_used_cloud_services → Cost per user (Note: 'credits_used' doesn't exist)
- execution_status      → Success/failure rate
- total_elapsed_time    → Performance metrics
- bytes_scanned         → Data access volume
```

**Sample Query:**
```sql
SELECT 
    user_name,
    COUNT(*) as total_queries,
    SUM(credits_used_cloud_services) * 3.0 as total_cost_usd,
    AVG(total_elapsed_time) as avg_exec_time_ms,
    (SUM(CASE WHEN execution_status != 'SUCCESS' THEN 1 END) / COUNT(*)) * 100 as failure_rate
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -30, CURRENT_DATE())
  AND user_name IS NOT NULL
GROUP BY user_name
ORDER BY total_cost_usd DESC;
```

---

### 5. **SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY**
**Purpose:** Track user logins, authentication, and access patterns

**Key Columns Used:**
```sql
- event_id                          → Unique event ID
- event_timestamp                   → When login occurred
- event_type                        → LOGIN, LOGOUT
- user_name                         → **KEY** - Who logged in
- client_ip                         → **KEY** - Source IP (for anomaly detection)
- reported_client_type              → Client type (JDBC, ODBC, UI, etc.)
- reported_client_version           → Client version
- first_authentication_factor       → PASSWORD, SSO, etc.
- second_authentication_factor      → MFA method if enabled
- is_success                        → Login succeeded or failed
- error_code                        → Error if failed
- error_message                     → Error details
- connection                        → Connection name if used
```

**Sample Query:**
```sql
SELECT 
    user_name,
    event_type,
    client_ip,
    reported_client_type,
    is_success,
    event_timestamp
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE event_timestamp >= DATEADD(day, -7, CURRENT_DATE())
ORDER BY event_timestamp DESC;
```

---

### 6. **SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY**
**Purpose:** Detailed object access tracking (Enterprise feature)

**Key Columns Used:**
```sql
- query_id                      → Links to QUERY_HISTORY
- query_start_time              → When access occurred
- user_name                     → **KEY** - Who accessed
- direct_objects_accessed       → JSON array of accessed objects
- base_objects_accessed         → JSON array of base tables
- objects_modified              → JSON array of modified objects
- object_modified_by_ddl        → JSON array of DDL changes
- policies_referenced           → Security policies applied
- query_text                    → Full query text
```

**Sample Query:**
```sql
SELECT 
    user_name,
    query_start_time,
    direct_objects_accessed,
    base_objects_accessed,
    objects_modified
FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY
WHERE query_start_time >= DATEADD(day, -7, CURRENT_DATE())
  AND user_name IS NOT NULL
ORDER BY query_start_time DESC;
```

**⚠️ Important:** Requires `ENABLE_OBJECT_ACCESS_TRACKING = TRUE` at account level

---

### 7. **SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS**
**Purpose:** Track which users have which roles

**Key Columns Used:**
```sql
- created_on        → When grant was created
- modified_on       → Last modification
- role_name         → **KEY** - Role granted
- grantee_name      → **KEY** - User who has the role
- granted_to        → Usually 'USER'
- granted_by        → Who granted the role
- deleted_on        → NULL if active, timestamp if revoked
```

**Sample Query:**
```sql
SELECT 
    grantee_name as user_name,
    role,
    created_on,
    deleted_on
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
WHERE deleted_on IS NULL  -- Only active grants
ORDER BY grantee_name, role;
```

---

### 8. **SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES** 
**Purpose:** Track permissions on database objects  
**⚠️ Note:** OBJECT_PRIVILEGES table does not exist in standard Snowflake. Use GRANTS_TO_ROLES instead.

**Key Columns Used:**
```sql
- created_on                    → When privilege granted
- modified_on                   → Last modification  
- privilege                     → **KEY** - SELECT, INSERT, UPDATE, DELETE, etc.
- granted_on                    → Object type (TABLE, VIEW, DATABASE, etc.)
- name                          → **KEY** - Object name
- table_catalog                 → Database name
- table_schema                  → Schema name
- grantee_name                  → **KEY** - Role with privilege
- granted_by                    → Who granted it
- deleted_on                    → NULL if active, timestamp if revoked
```

**Sample Query:**
```sql
SELECT 
    grantee_name as role_name,
    privilege,
    granted_on as object_type,
    name as object_name,
    table_catalog as database_name,
    table_schema as schema_name
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
WHERE deleted_on IS NULL
  AND granted_on IN ('TABLE', 'VIEW', 'DATABASE', 'SCHEMA')
ORDER BY grantee_name, granted_on, object_name;
```

---

## 📊 **Data Mapping Summary**

### Budget Guardrails → Snowflake Tables
| Feature | Snowflake Table | Key Column |
|---------|----------------|------------|
| Daily costs | QUERY_HISTORY | credits_used_cloud_services |
| Warehouse costs | QUERY_HISTORY | warehouse_name + credits_used_cloud_services |
| Storage costs | DATABASE_STORAGE_USAGE_HISTORY | average_hybrid_table_storage_bytes |
| Query counts | QUERY_HISTORY | query_id |
| Time tracking | QUERY_HISTORY | start_time, end_time |

### Security Monitoring → Snowflake Tables
| Feature | Snowflake Table | Key Columns |
|---------|----------------|-------------|
| User costs | QUERY_HISTORY | user_name + credits_used_cloud_services |
| Login activity | LOGIN_HISTORY | user_name + client_ip |
| Object access | ACCESS_HISTORY | user_name + objects_accessed |
| Role assignments | GRANTS_TO_USERS | grantee_name + role |
| Permissions | GRANTS_TO_ROLES | grantee_name + privilege |
| Failure rates | QUERY_HISTORY | execution_status |
| Performance | QUERY_HISTORY | total_elapsed_time |

---

## ⚠️ **Important Notes**

### 1. **ACCOUNT_USAGE Latency**
- Data is delayed by 45 minutes to 3 hours
- Not suitable for real-time monitoring
- Use INFORMATION_SCHEMA for real-time data (different schema)

### 2. **Credit Pricing**
```sql
-- ALWAYS multiply credits by YOUR actual price:
SUM(credits_used_cloud_services) * 3.0  -- Replace 3.0 with YOUR price

-- Check your edition:
SHOW PARAMETERS LIKE 'ACCOUNT_EDITION' IN ACCOUNT;

-- Typical prices:
-- Standard: $2.00/credit
-- Enterprise: $3.00/credit
-- Business Critical: $4.00/credit
```

### 3. **Required Permissions**
```sql
-- Option 1: Use ACCOUNTADMIN role
USE ROLE ACCOUNTADMIN;

-- Option 2: Grant specific access
GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE TO ROLE <your_role>;
```

### 4. **Enable Object Access Tracking**
```sql
-- Required for ACCESS_HISTORY table (Enterprise feature)
ALTER ACCOUNT SET ENABLE_OBJECT_ACCESS_TRACKING = TRUE;

-- Check if enabled:
SHOW PARAMETERS LIKE 'ENABLE_OBJECT_ACCESS_TRACKING' IN ACCOUNT;
```

---

## ✅ **Validation Checklist**

Run these queries in Snowflake to validate:

```sql
-- 1. Check QUERY_HISTORY has data
SELECT COUNT(*) FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE());

-- 2. Verify credits_used has values
SELECT SUM(credits_used) FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE());

-- 3. Check LOGIN_HISTORY has data
SELECT COUNT(*) FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE event_timestamp >= DATEADD(day, -7, CURRENT_DATE());

-- 4. Verify user_name exists
SELECT COUNT(DISTINCT user_name) FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE());

-- 5. Check warehouse_name exists
SELECT COUNT(DISTINCT warehouse_name) FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD(day, -7, CURRENT_DATE());
```

All queries should return > 0 results.

---

## 🔗 **Official Documentation**

- [Snowflake ACCOUNT_USAGE Views](https://docs.snowflake.com/en/sql-reference/account-usage.html)
- [QUERY_HISTORY View](https://docs.snowflake.com/en/sql-reference/account-usage/query_history.html)
- [LOGIN_HISTORY View](https://docs.snowflake.com/en/sql-reference/account-usage/login_history.html)
- [ACCESS_HISTORY View](https://docs.snowflake.com/en/sql-reference/account-usage/access_history.html)
