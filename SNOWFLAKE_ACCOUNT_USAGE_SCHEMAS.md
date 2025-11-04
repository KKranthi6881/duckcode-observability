# Snowflake ACCOUNT_USAGE Schema Reference

This document lists the actual column names and data types from Snowflake's ACCOUNT_USAGE views.
Use this to verify queries and fix extraction issues.

---

## 1. TABLE_STORAGE_METRICS
**Purpose:** Storage metrics for all tables in the account

### Key Columns (All UPPERCASE):
```sql
TABLE_CATALOG          VARCHAR    -- Database name
TABLE_SCHEMA           VARCHAR    -- Schema name
TABLE_NAME             VARCHAR    -- Table name
ACTIVE_BYTES           NUMBER     -- Bytes in active state (billed)
TIME_TRAVEL_BYTES      NUMBER     -- Bytes in Time Travel state
FAILSAFE_BYTES         NUMBER     -- Bytes in Fail-safe state
RETAINED_FOR_CLONE_BYTES NUMBER   -- Bytes retained for clones
IS_TRANSIENT           VARCHAR    -- 'YES' or 'NO' (not boolean!)
DELETED                BOOLEAN    -- TRUE if table dropped/recreated
TABLE_CREATED          TIMESTAMP_LTZ  -- Creation timestamp
TABLE_DROPPED          TIMESTAMP_LTZ  -- Drop timestamp (NULL if active)
TABLE_ENTERED_FAILSAFE TIMESTAMP_LTZ  -- When entered fail-safe
COMMENT                VARCHAR    -- Table comment
```

### Full Column List:
- ID
- TABLE_NAME
- TABLE_SCHEMA_ID
- TABLE_SCHEMA
- TABLE_CATALOG_ID
- TABLE_CATALOG
- CLONE_GROUP_ID
- IS_TRANSIENT
- ACTIVE_BYTES
- TIME_TRAVEL_BYTES
- FAILSAFE_BYTES
- RETAINED_FOR_CLONE_BYTES
- DELETED
- TABLE_CREATED
- TABLE_DROPPED
- TABLE_ENTERED_FAILSAFE
- SCHEMA_CREATED
- SCHEMA_DROPPED
- CATALOG_CREATED
- CATALOG_DROPPED
- COMMENT
- INSTANCE_ID

### Example Query:
```sql
SELECT 
  TABLE_CATALOG,
  TABLE_SCHEMA,
  TABLE_NAME,
  ACTIVE_BYTES,
  TIME_TRAVEL_BYTES,
  FAILSAFE_BYTES,
  IS_TRANSIENT,
  TABLE_CREATED
FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS
WHERE DELETED = FALSE
  AND ACTIVE_BYTES > 0
  AND TABLE_CATALOG IS NOT NULL
ORDER BY ACTIVE_BYTES DESC
LIMIT 100;
```

---

## 2. WAREHOUSE_METERING_HISTORY
**Purpose:** Credit usage by warehouse (hourly granularity)

### Key Columns (All UPPERCASE):
```sql
WAREHOUSE_ID           NUMBER         -- Internal warehouse ID
WAREHOUSE_NAME         VARCHAR        -- Warehouse name
START_TIME             TIMESTAMP_LTZ  -- Start of hour
END_TIME               TIMESTAMP_LTZ  -- End of hour
CREDITS_USED           NUMBER         -- Total credits (compute + cloud services)
CREDITS_USED_COMPUTE   NUMBER         -- Compute credits only
CREDITS_USED_CLOUD_SERVICES NUMBER    -- Cloud services credits only
WAREHOUSE_SIZE         VARCHAR        -- Size (XSMALL, SMALL, MEDIUM, etc.)
```

### Full Column List:
- READER_ACCOUNT_NAME (only in READER_ACCOUNT_USAGE)
- START_TIME
- END_TIME
- WAREHOUSE_ID
- WAREHOUSE_NAME
- CREDITS_USED
- CREDITS_USED_COMPUTE
- CREDITS_USED_CLOUD_SERVICES
- CREDITS_ATTRIBUTED_COMPUTE_QUERIES

### Example Query:
```sql
SELECT 
  WAREHOUSE_NAME,
  START_TIME,
  END_TIME,
  CREDITS_USED_COMPUTE,
  CREDITS_USED_CLOUD_SERVICES,
  CREDITS_USED,
  WAREHOUSE_SIZE
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
ORDER BY START_TIME DESC
LIMIT 100;
```

### Aggregate Example:
```sql
SELECT 
  WAREHOUSE_NAME,
  SUM(CREDITS_USED_COMPUTE) AS TOTAL_COMPUTE_CREDITS,
  SUM(CREDITS_USED_CLOUD_SERVICES) AS TOTAL_CLOUD_CREDITS,
  SUM(CREDITS_USED) AS TOTAL_CREDITS
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE START_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
GROUP BY WAREHOUSE_NAME
ORDER BY TOTAL_CREDITS DESC;
```

---

## 3. QUERY_HISTORY
**Purpose:** History of all queries executed (365 days retention)

### Key Columns (All UPPERCASE):
```sql
QUERY_ID               VARCHAR        -- Unique query identifier
QUERY_TEXT             VARCHAR        -- SQL text (100K char limit)
QUERY_TYPE             VARCHAR        -- DML, SELECT, etc.
DATABASE_NAME          VARCHAR        -- Database in context
SCHEMA_NAME            VARCHAR        -- Schema in context
USER_NAME              VARCHAR        -- User who ran query
ROLE_NAME              VARCHAR        -- Active role
WAREHOUSE_ID           NUMBER         -- Warehouse ID
WAREHOUSE_NAME         VARCHAR        -- Warehouse name
WAREHOUSE_SIZE         VARCHAR        -- Warehouse size at execution
START_TIME             TIMESTAMP_LTZ  -- Query start time
END_TIME               TIMESTAMP_LTZ  -- Query end time
TOTAL_ELAPSED_TIME     NUMBER         -- Milliseconds
EXECUTION_STATUS       VARCHAR        -- success, fail, incident
ERROR_CODE             NUMBER         -- Error code if failed
BYTES_SCANNED          NUMBER         -- Bytes scanned
ROWS_PRODUCED          NUMBER         -- Rows returned
CREDITS_USED_CLOUD_SERVICES NUMBER    -- Cloud services credits ONLY
```

### Important Notes:
❌ **NO CREDITS_USED_COMPUTE** - This column does NOT exist in QUERY_HISTORY
✅ Only has CREDITS_USED_CLOUD_SERVICES
✅ For compute credits, use WAREHOUSE_METERING_HISTORY

### Full Column List (Selected):
- QUERY_ID
- QUERY_TEXT
- DATABASE_ID
- DATABASE_NAME
- SCHEMA_ID
- SCHEMA_NAME
- QUERY_TYPE
- SESSION_ID
- USER_NAME
- ROLE_NAME
- WAREHOUSE_ID
- WAREHOUSE_NAME
- WAREHOUSE_SIZE
- WAREHOUSE_TYPE
- EXECUTION_STATUS
- ERROR_CODE
- ERROR_MESSAGE
- START_TIME
- END_TIME
- TOTAL_ELAPSED_TIME
- BYTES_SCANNED
- ROWS_PRODUCED
- BYTES_WRITTEN
- COMPILATION_TIME
- EXECUTION_TIME
- QUEUED_PROVISIONING_TIME
- QUEUED_REPAIR_TIME
- QUEUED_OVERLOAD_TIME
- CREDITS_USED_CLOUD_SERVICES (⚠️ Cloud services only!)

### Example Query:
```sql
SELECT 
  QUERY_ID,
  WAREHOUSE_NAME,
  USER_NAME,
  START_TIME,
  TOTAL_ELAPSED_TIME,
  EXECUTION_STATUS,
  BYTES_SCANNED,
  ROWS_PRODUCED
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
  AND WAREHOUSE_NAME IS NOT NULL
ORDER BY START_TIME DESC
LIMIT 100;
```

### Aggregate Stats Example:
```sql
SELECT 
  WAREHOUSE_NAME,
  COUNT(*) AS TOTAL_QUERIES,
  SUM(TOTAL_ELAPSED_TIME) AS TOTAL_EXECUTION_TIME_MS,
  AVG(TOTAL_ELAPSED_TIME) AS AVG_EXECUTION_TIME_MS,
  SUM(BYTES_SCANNED) AS TOTAL_BYTES_SCANNED
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
  AND WAREHOUSE_NAME IS NOT NULL
  AND EXECUTION_STATUS = 'SUCCESS'
GROUP BY WAREHOUSE_NAME;
```

---

## 4. STORAGE_USAGE
**Purpose:** Account-level storage usage over time

### Key Columns (All UPPERCASE):
```sql
USAGE_DATE             DATE      -- Date of measurement
STORAGE_BYTES          NUMBER    -- Table storage bytes
STAGE_BYTES            NUMBER    -- Stage storage bytes
FAILSAFE_BYTES         NUMBER    -- Fail-safe bytes
```

### Example Query:
```sql
SELECT 
  USAGE_DATE,
  STORAGE_BYTES,
  STAGE_BYTES,
  FAILSAFE_BYTES,
  (STORAGE_BYTES + STAGE_BYTES + FAILSAFE_BYTES) AS TOTAL_BYTES
FROM SNOWFLAKE.ACCOUNT_USAGE.STORAGE_USAGE
WHERE USAGE_DATE >= DATEADD(day, -30, CURRENT_DATE())
ORDER BY USAGE_DATE DESC;
```

---

## 5. ACCESS_HISTORY
**Purpose:** Track which tables/views were accessed by queries

### Key Columns (All UPPERCASE):
```sql
QUERY_ID               VARCHAR    -- Links to QUERY_HISTORY
QUERY_START_TIME       TIMESTAMP_LTZ
USER_NAME              VARCHAR
DIRECT_OBJECTS_ACCESSED ARRAY     -- Objects directly accessed
BASE_OBJECTS_ACCESSED  ARRAY      -- Base tables accessed
OBJECTS_MODIFIED       ARRAY      -- Objects modified (DML)
```

### Example Query (Find Unused Tables):
```sql
WITH table_access AS (
  SELECT 
    DIRECT_OBJECTS_ACCESSED,
    MAX(QUERY_START_TIME) AS LAST_ACCESS
  FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY
  WHERE QUERY_START_TIME >= DATEADD(day, -90, CURRENT_TIMESTAMP())
  GROUP BY DIRECT_OBJECTS_ACCESSED
)
SELECT 
  ts.TABLE_CATALOG,
  ts.TABLE_SCHEMA,
  ts.TABLE_NAME,
  ts.ACTIVE_BYTES,
  ta.LAST_ACCESS,
  DATEDIFF(day, ta.LAST_ACCESS, CURRENT_TIMESTAMP()) AS DAYS_SINCE_ACCESS
FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS ts
LEFT JOIN table_access ta 
  ON ta.DIRECT_OBJECTS_ACCESSED LIKE '%' || ts.TABLE_NAME || '%'
WHERE ts.DELETED = FALSE
  AND ts.ACTIVE_BYTES > 1073741824  -- At least 1 GB
  AND (ta.LAST_ACCESS IS NULL 
       OR ta.LAST_ACCESS < DATEADD(day, -90, CURRENT_TIMESTAMP()))
ORDER BY ts.ACTIVE_BYTES DESC
LIMIT 50;
```

---

## 6. METERING_DAILY_HISTORY
**Purpose:** Daily credit usage summary for the account

### Key Columns (All UPPERCASE):
```sql
USAGE_DATE             DATE      -- Date of usage
SERVICE_TYPE           VARCHAR   -- WAREHOUSE_METERING, CLOUD_SERVICES, etc.
CREDITS_USED           NUMBER    -- Total credits for the day
CREDITS_ADJUSTMENT_CLOUD_SERVICES NUMBER  -- Cloud services credit adjustment
CREDITS_USED_COMPUTE   NUMBER    -- Compute credits
CREDITS_USED_CLOUD_SERVICES NUMBER  -- Cloud services credits
```

### Example Query:
```sql
SELECT 
  USAGE_DATE,
  SERVICE_TYPE,
  CREDITS_USED_COMPUTE,
  CREDITS_USED_CLOUD_SERVICES,
  CREDITS_ADJUSTMENT_CLOUD_SERVICES,
  CREDITS_USED
FROM SNOWFLAKE.ACCOUNT_USAGE.METERING_DAILY_HISTORY
WHERE USAGE_DATE >= DATEADD(day, -30, CURRENT_DATE())
ORDER BY USAGE_DATE DESC;
```

---

## Test Script

Run this to verify what's available in your Snowflake account:

```sql
-- 1. Check TABLE_STORAGE_METRICS
SELECT * 
FROM SNOWFLAKE.ACCOUNT_USAGE.TABLE_STORAGE_METRICS 
WHERE DELETED = FALSE 
LIMIT 1;

-- 2. Check WAREHOUSE_METERING_HISTORY
SELECT * 
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY 
WHERE START_TIME >= DATEADD(day, -7, CURRENT_TIMESTAMP())
LIMIT 1;

-- 3. Check QUERY_HISTORY
SELECT * 
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY 
WHERE START_TIME >= DATEADD(day, -1, CURRENT_TIMESTAMP())
LIMIT 1;

-- 4. Check STORAGE_USAGE
SELECT * 
FROM SNOWFLAKE.ACCOUNT_USAGE.STORAGE_USAGE 
WHERE USAGE_DATE >= DATEADD(day, -7, CURRENT_DATE())
LIMIT 1;

-- 5. List all columns in each view
SELECT 
  TABLE_NAME,
  COLUMN_NAME,
  DATA_TYPE,
  ORDINAL_POSITION
FROM SNOWFLAKE.INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'ACCOUNT_USAGE'
  AND TABLE_NAME IN (
    'TABLE_STORAGE_METRICS',
    'WAREHOUSE_METERING_HISTORY', 
    'QUERY_HISTORY',
    'STORAGE_USAGE'
  )
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

---

## Common Pitfalls

### ❌ WRONG:
```sql
-- This will FAIL - CREDITS_USED_COMPUTE not in QUERY_HISTORY
SELECT 
  WAREHOUSE_NAME,
  SUM(CREDITS_USED_COMPUTE)
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
GROUP BY WAREHOUSE_NAME;
```

### ✅ CORRECT:
```sql
-- Use WAREHOUSE_METERING_HISTORY for credits
SELECT 
  WAREHOUSE_NAME,
  SUM(CREDITS_USED_COMPUTE) AS COMPUTE_CREDITS,
  SUM(CREDITS_USED_CLOUD_SERVICES) AS CLOUD_CREDITS
FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
WHERE START_TIME >= DATEADD(day, -30, CURRENT_TIMESTAMP())
GROUP BY WAREHOUSE_NAME;
```

---

## Important Notes

1. **All column names are UPPERCASE** in Snowflake ACCOUNT_USAGE views
2. **IS_TRANSIENT** returns 'YES'/'NO' strings, NOT booleans
3. **Latency:** ACCOUNT_USAGE views have 45min - 3 hour latency
4. **Retention:** 365 days for most views, 1 year of history
5. **Credits vs Queries:** 
   - Query stats → `QUERY_HISTORY`
   - Credit usage → `WAREHOUSE_METERING_HISTORY`
6. **Case Sensitivity:** Snowflake returns uppercase, PostgreSQL expects lowercase

---

## Mapping Guide

| Snowflake Column | Our DB Column | Conversion Needed |
|------------------|---------------|-------------------|
| `TABLE_CATALOG` | `database_name` | Lowercase |
| `TABLE_SCHEMA` | `schema_name` | Lowercase |
| `TABLE_NAME` | `table_name` | Lowercase |
| `IS_TRANSIENT` | `is_transient` | 'YES'/'NO' → boolean |
| `ACTIVE_BYTES` | `storage_bytes` | Direct |
| `WAREHOUSE_NAME` | `warehouse_name` | Lowercase |
| `CREDITS_USED` | `credits_used` | Direct |
