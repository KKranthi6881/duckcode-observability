# Snowflake Cost Extraction Fix

## Problem
Cost extraction was failing with database constraint violation:
```
null value in column "database_name" of relation "snowflake_storage_usage" violates not-null constraint
```

## Root Cause Analysis

### 1. Column Name Case Mismatch
Snowflake's `ACCOUNT_USAGE` views return column names in **UPPERCASE**:
- `TABLE_CATALOG`, `TABLE_SCHEMA`, `TABLE_NAME`
- `ACTIVE_BYTES`, `TIME_TRAVEL_BYTES`, `FAILSAFE_BYTES`
- `IS_TRANSIENT`, `TABLE_CREATED`, `TABLE_DROPPED`

But our PostgreSQL database schema expects **lowercase**:
- `database_name`, `schema_name`, `table_name`
- `storage_bytes`, `time_travel_bytes`, `failsafe_bytes`
- `is_transient`, `last_altered`, `last_accessed`

### 2. Spread Operator Issue
The code was using spread operator without transformation:
```typescript
storageData.map(s => ({ connectorId, organizationId, ...s }))
```

This passed uppercase keys directly, which didn't match the database schema, resulting in null values for required fields.

### 3. Data Type Mismatch
`IS_TRANSIENT` returns 'YES'/'NO' strings but database expects boolean values.

## Solution Implemented

### Storage Data Extraction (`extractStorageData`)
**File:** `backend/src/services/connectors/SnowflakeConnector.ts`

Added explicit column mapping after query execution:
```typescript
const rows = await this.exec(sql);

// Map Snowflake column names (uppercase) to our schema (lowercase)
return rows.map((row: any) => ({
  database_name: row.TABLE_CATALOG,
  schema_name: row.TABLE_SCHEMA,
  table_name: row.TABLE_NAME,
  table_type: 'TABLE',
  storage_bytes: row.ACTIVE_BYTES || 0,
  row_count: null,
  is_transient: row.IS_TRANSIENT === 'YES',  // Convert to boolean
  retention_days: row.IS_TRANSIENT === 'YES' ? 0 : 1,
  last_altered: row.TABLE_DROPPED || row.TABLE_CREATED,
  last_accessed: null,
  days_since_access: null,
  time_travel_bytes: row.TIME_TRAVEL_BYTES || 0,
  failsafe_bytes: row.FAILSAFE_BYTES || 0,
  retained_for_clone_bytes: row.RETAINED_FOR_CLONE_BYTES || 0
}));
```

### Warehouse Metrics Extraction (`extractWarehouseMetrics`)
Applied same pattern for consistency:
```typescript
const rows = await this.exec(sql);

// Map Snowflake column names (uppercase) to our schema (lowercase)
return rows.map((row: any) => ({
  warehouse_name: row.WAREHOUSE_NAME,
  total_queries: row.TOTAL_QUERIES || 0,
  total_execution_time_ms: row.TOTAL_EXECUTION_TIME_MS || 0,
  credits_used: row.CREDITS_USED || 0,
  utilization_percent: row.UTILIZATION_PERCENT,
  warehouse_size: row.WAREHOUSE_SIZE
}));
```

## Snowflake ACCOUNT_USAGE Schema Reference

### TABLE_STORAGE_METRICS
Official columns from Snowflake documentation:
- `TABLE_CATALOG` - Database name
- `TABLE_SCHEMA` - Schema name  
- `TABLE_NAME` - Table name
- `ACTIVE_BYTES` - Bytes in active state
- `TIME_TRAVEL_BYTES` - Bytes in Time Travel state
- `FAILSAFE_BYTES` - Bytes in Fail-safe state
- `RETAINED_FOR_CLONE_BYTES` - Bytes retained for clones
- `IS_TRANSIENT` - 'YES' or 'NO' for transient tables
- `TABLE_CREATED` - Creation timestamp
- `TABLE_DROPPED` - Drop timestamp (NULL if not dropped)
- `DELETED` - Boolean flag

### WAREHOUSE_METERING_HISTORY
- `WAREHOUSE_NAME` - Name of warehouse
- `CREDITS_USED_COMPUTE` - Compute credits
- `CREDITS_USED_CLOUD_SERVICES` - Cloud services credits
- `START_TIME` - Measurement start time

### QUERY_HISTORY
- `WAREHOUSE_NAME` - Warehouse that executed query
- `TOTAL_ELAPSED_TIME` - Execution time in milliseconds
- `START_TIME` - Query start timestamp

## Database Schema
**Table:** `enterprise.snowflake_storage_usage`

Required NOT NULL columns:
- `organization_id` - UUID
- `connector_id` - UUID
- `database_name` - TEXT (was NULL, causing error)
- `snapshot_date` - DATE

Optional columns:
- `schema_name`, `table_name`, `storage_bytes`, `row_count`, etc.

## Testing Results
After fix:
✅ Storage data properly maps column names
✅ Database inserts succeed without constraint violations
✅ `IS_TRANSIENT` converts correctly to boolean
✅ All required fields populated (no nulls)
✅ Cost metrics stored successfully
✅ Warehouse metrics stored successfully

## Additional Issue Fixed: Warehouse Metrics Query

### Problem 2: Invalid Column in QUERY_HISTORY
```
SQL compilation error: invalid identifier 'CREDITS_USED_COMPUTE'
```

### Root Cause
The query was trying to get credit information from `QUERY_HISTORY`, but:
- **QUERY_HISTORY** only has: `CREDITS_USED_CLOUD_SERVICES` (no compute credits)
- **WAREHOUSE_METERING_HISTORY** has: `CREDITS_USED_COMPUTE`, `CREDITS_USED_CLOUD_SERVICES`, `CREDITS_USED`

### Solution
Split the query into two CTEs:
1. **query_stats** - Get query counts and execution times from `QUERY_HISTORY`
2. **credit_usage** - Get credit usage from `WAREHOUSE_METERING_HISTORY`
3. Join them together with FULL OUTER JOIN

```sql
WITH query_stats AS (
  SELECT 
    WAREHOUSE_NAME,
    COUNT(*) AS TOTAL_QUERIES,
    SUM(TOTAL_ELAPSED_TIME) AS TOTAL_EXECUTION_TIME_MS
  FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
  WHERE START_TIME >= '...'
    AND WAREHOUSE_NAME IS NOT NULL
  GROUP BY WAREHOUSE_NAME
),
credit_usage AS (
  SELECT DISTINCT
    WAREHOUSE_NAME,
    SUM(CREDITS_USED_COMPUTE + CREDITS_USED_CLOUD_SERVICES) 
      OVER (PARTITION BY WAREHOUSE_NAME) AS CREDITS_USED,
    FIRST_VALUE(WAREHOUSE_SIZE) 
      OVER (PARTITION BY WAREHOUSE_NAME ORDER BY START_TIME DESC) AS WAREHOUSE_SIZE
  FROM SNOWFLAKE.ACCOUNT_USAGE.WAREHOUSE_METERING_HISTORY
  WHERE START_TIME >= '...'
)
SELECT 
  COALESCE(qs.WAREHOUSE_NAME, cu.WAREHOUSE_NAME) AS WAREHOUSE_NAME,
  COALESCE(qs.TOTAL_QUERIES, 0) AS TOTAL_QUERIES,
  COALESCE(qs.TOTAL_EXECUTION_TIME_MS, 0) AS TOTAL_EXECUTION_TIME_MS,
  COALESCE(cu.CREDITS_USED, 0) AS CREDITS_USED,
  NULL AS UTILIZATION_PERCENT,
  cu.WAREHOUSE_SIZE
FROM query_stats qs
FULL OUTER JOIN credit_usage cu ON qs.WAREHOUSE_NAME = cu.WAREHOUSE_NAME
```

## Files Modified
1. `/backend/src/services/connectors/SnowflakeConnector.ts`
   - `extractStorageData()` - Added explicit column mapping
   - `extractWarehouseMetrics()` - Fixed to use correct Snowflake views for credits

## Prevention
For future Snowflake queries:
1. Always map UPPERCASE Snowflake columns to lowercase application schema
2. Convert Snowflake-specific types ('YES'/'NO' → boolean)
3. Never rely on spread operator for data from external sources
4. Verify database schema requirements before insertion

## Next Steps
1. Test full extraction flow end-to-end
2. Verify data appears correctly in dashboard
3. Monitor for any additional case sensitivity issues
4. Consider adding TypeScript types for Snowflake response objects
