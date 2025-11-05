# Snowflake Authentication Error - Diagnosis & Fix

## Error Observed
```
[Extract] Background extraction failed: Error [OperationFailedError]: Incorrect username or password was specified.
code: '390100'
loginName: 'DUCKCODE'
```

## Root Cause Analysis

The error occurs **AFTER** initial connection succeeds:
1. ✅ Connection created successfully
2. ✅ Authentication successful using SNOWFLAKE
3. ✅ Connected successfully after 5.4 milliseconds
4. ❌ **Then fails with "Incorrect username or password"**

This indicates the connection is established but fails during query execution.

---

## Fixes Applied

### 1. Fresh Connection for Each Extraction
**File:** `backend/src/services/connectors/SnowflakeConnector.ts`

```typescript
async extractMetadata(): Promise<ExtractionResult> {
  try {
    // Ensure fresh connection for extraction
    await this.disconnect();  // ← NEW: Clear any stale connection
    await this.getConnection();
    // ...
```

**Why:** Prevents reusing stale/expired connections that might fail authentication on subsequent queries.

### 2. Enhanced Logging
Added detailed logging to diagnose exactly which query fails:

```typescript
console.log('[SNOWFLAKE] Creating new connection with config:', {
  account: this.config.account,
  username: this.config.username,
  role: this.config.role,
  warehouse: this.config.warehouse,
  database: this.config.database,
  schema: this.config.schema,
  hasPassword: !!this.config.password  // Don't log actual password
});
```

```typescript
console.error(`[SNOWFLAKE] Query failed:`, {
  message: err?.message,
  code: err?.code,
  sqlState: err?.sqlState,
  query: preview
});
```

---

## Common Causes & Solutions

### Cause 1: Password Contains Special Characters
**Symptoms:** Connection succeeds, queries fail
**Solution:** Ensure password is properly URL-encoded when stored

**Check your password for these characters:**
- `@` `#` `$` `%` `^` `&` `*` `(` `)` `{` `}` `[` `]` `|` `\` `:` `;` `'` `"` `<` `>` `,` `.` `?` `/`

**Test:**
```bash
# In your Snowflake connector creation, try escaping special chars
password: encodeURIComponent(yourPassword)
```

### Cause 2: Insufficient Role Permissions
**Symptoms:** Connection succeeds, but specific queries fail
**Solution:** Verify the role has necessary permissions

**Required Permissions:**
- `USAGE` on warehouse
- `USAGE` on database
- `USAGE` on schema
- `SELECT` on `INFORMATION_SCHEMA.COLUMNS`
- `SHOW` privileges for tables/views

**Test:**
```sql
-- Run these in Snowflake UI with your role
USE ROLE ACCOUNTADMIN;
SHOW TABLES IN SCHEMA SNOWFLAKE_SAMPLE_DATA.TPCH_SF1;
SELECT * FROM INFORMATION_SCHEMA.COLUMNS LIMIT 1;
```

### Cause 3: Session Timeout
**Symptoms:** Works initially, fails after some time
**Solution:** Already fixed with fresh connection per extraction

### Cause 4: Warehouse Not Running
**Symptoms:** Connection succeeds, USE WAREHOUSE fails
**Solution:** Ensure warehouse is running or has auto-resume enabled

**Check:**
```sql
SHOW WAREHOUSES LIKE 'COMPUTE_WH';
-- Look for STATE column, should be 'STARTED' or have AUTO_RESUME = TRUE
```

### Cause 5: Database/Schema Access
**Symptoms:** Connection succeeds, but can't access specified database/schema
**Solution:** Verify role has access

**Test:**
```sql
USE ROLE ACCOUNTADMIN;
USE DATABASE SNOWFLAKE_SAMPLE_DATA;
USE SCHEMA TPCH_SF1;
```

---

## Debugging Steps

### Step 1: Test Connection First
Before extracting, always test the connection:
1. Click "Test" button in UI
2. Should see: ✅ "Connection test succeeded"
3. If test fails, fix credentials before extracting

### Step 2: Check Backend Logs
After clicking "Extract", watch backend logs for:

```bash
# Look for this sequence:
[SNOWFLAKE] Creating new connection with config: {...}
[SNOWFLAKE] Connection established successfully
[SNOWFLAKE] Executing: USE WAREHOUSE "COMPUTE_WH"...
[SNOWFLAKE] Done: rows=1
```

**If you see an error, note which query failed:**
```bash
[SNOWFLAKE] Query failed: {
  message: "...",
  code: "...",
  query: "..."  ← This tells you exactly what failed
}
```

### Step 3: Verify Credentials
```bash
# In Snowflake UI, test with exact same credentials:
snowsql -a BJUOPQF-ID86727 -u DUCKCODE -r ACCOUNTADMIN -w COMPUTE_WH -d SNOWFLAKE_SAMPLE_DATA -s TPCH_SF1
```

### Step 4: Check Encryption/Decryption
The password is encrypted in the database. Verify it's being decrypted correctly:

```typescript
// In backend logs, you should see:
[SNOWFLAKE] Creating new connection with config: {
  hasPassword: true  // ← Should be true
}
```

If `hasPassword: false`, the decryption failed.

---

## Quick Fixes to Try

### Fix 1: Re-create Connector with Fresh Password
1. Delete the connector
2. Create new one with same credentials
3. Test connection
4. Extract

### Fix 2: Use ACCOUNTADMIN Role
If you're using a custom role, try ACCOUNTADMIN first to rule out permissions:
1. Edit connector
2. Change role to `ACCOUNTADMIN`
3. Test & Extract

### Fix 3: Simplify Configuration
Start with minimal config:
```json
{
  "account": "BJUOPQF-ID86727",
  "username": "DUCKCODE",
  "password": "your_password",
  "role": "ACCOUNTADMIN",
  "warehouse": "COMPUTE_WH"
  // Leave database and schema empty initially
}
```

### Fix 4: Check Snowflake Account Status
- Verify account is not suspended
- Check if IP whitelisting is enabled
- Verify network policies allow your backend IP

---

## Expected Behavior After Fix

### Successful Extraction Logs:
```
[EXTRACT] Starting extraction for connector xxx
[EXTRACT] Calling extractMetadata()
[SNOWFLAKE] Creating new connection with config: {...}
[SNOWFLAKE] Connection established successfully
[SNOWFLAKE] Executing: USE WAREHOUSE "COMPUTE_WH"...
[SNOWFLAKE] Done: rows=1
[SNOWFLAKE] Executing: USE DATABASE "SNOWFLAKE_SAMPLE_DATA"...
[SNOWFLAKE] Done: rows=1
[SNOWFLAKE] Executing: USE SCHEMA "TPCH_SF1"...
[SNOWFLAKE] Done: rows=1
[SNOWFLAKE] Executing: ALTER SESSION SET QUOTED_IDENTIFIERS_IGNORE_CASE = TRUE...
[SNOWFLAKE] Done: rows=1
[SNOWFLAKE] Fetching tables and views via SHOW
[SNOWFLAKE] Executing: SHOW TABLES IN SCHEMA SNOWFLAKE_SAMPLE_DATA.TPCH_SF1...
[SNOWFLAKE] Done: rows=8
[SNOWFLAKE] Executing: SHOW VIEWS IN SCHEMA SNOWFLAKE_SAMPLE_DATA.TPCH_SF1...
[SNOWFLAKE] Done: rows=0
[SNOWFLAKE] Retrieved: tables=8, views=0
[SNOWFLAKE] Executing: SELECT table_catalog, table_schema, table_name, column_name, data_type, ordinal_position, is_nullable FROM information_schema.columns WHERE table_schema = 'TPCH_SF1'...
[SNOWFLAKE] Done: rows=61
[SNOWFLAKE] Retrieved columns from information_schema: 61
[EXTRACT] extractMetadata() done. objects=8
[EXTRACT] Storing repository snowflake://BJUOPQF-ID86727/SNOWFLAKE_SAMPLE_DATA
[EXTRACT] Storing 8 objects
```

---

## Next Steps

1. **Restart backend** to apply the fixes
2. **Test connection** first
3. **Try extraction** again
4. **Check logs** for detailed error if it still fails
5. **Report back** with the specific query that fails

The enhanced logging will now show you **exactly which SQL query is failing**, making it much easier to diagnose.

---

## Still Failing?

If extraction still fails after applying these fixes, provide:
1. Full backend logs from extraction start to error
2. The specific query that failed (from logs)
3. Snowflake account region/cloud provider
4. Whether you can run that query manually in Snowflake UI

This will help pinpoint the exact issue!
