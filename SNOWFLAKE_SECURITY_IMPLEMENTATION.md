# Snowflake Security Monitoring Implementation ✅

## What Was Built

You were absolutely right - we had SQL queries but no database tables or backend services! Here's what I've now implemented:

---

## 📊 **Database Tables Created**

**Migration**: `20251105000004_snowflake_security_monitoring.sql`

### 1. **snowflake_login_history**
Tracks authentication and access patterns from `SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY`

**Key Columns**:
- `user_name`, `client_ip`, `event_timestamp`
- `first_authentication_factor` (PASSWORD, OAUTH, MFA)
- `is_success`, `error_message`
- Indexed for fast queries by user, timestamp, failed logins

**Use Cases**:
- Find stale users who haven't logged in
- Track failed login attempts (brute force detection)
- Verify MFA usage
- Monitor authentication patterns

---

### 2. **snowflake_user_role_grants**
Tracks role assignments from `SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS`

**Key Columns**:
- `grantee_name` (user who has the role)
- `role_name`, `granted_by`, `granted_on`
- Special index for ACCOUNTADMIN/SECURITYADMIN

**Use Cases**:
- Audit ACCOUNTADMIN and SECURITYADMIN usage
- Track role changes over time
- Identify users with admin privileges

---

### 3. **snowflake_role_privilege_grants**
Tracks role permissions from `SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES`

**Key Columns**:
- `role_name`, `privilege` (SELECT, INSERT, DELETE, etc.)
- `granted_on` (object name), `granted_on_type` (TABLE, VIEW, etc.)
- Indexed by role and object type

**Use Cases**:
- Find over-privileged roles
- Audit permissions
- Track privilege changes

---

### 4. **snowflake_network_policies**
Tracks network security from `SNOWFLAKE.ACCOUNT_USAGE.NETWORK_POLICIES`

**Key Columns**:
- `name`, `owner`, `created_on`
- `allowed_ip_list[]`, `blocked_ip_list[]` (arrays)

**Use Cases**:
- Monitor IP allowlists/blocklists
- Track network policy changes
- Security compliance

---

### 5. **snowflake_access_history**
Tracks data access from `SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY`

**Key Columns**:
- `user_name`, `query_id`, `object_name`
- `direct_objects_accessed`, `base_objects_accessed` (JSONB)
- Indexed by user, object, and time

**Use Cases**:
- Monitor sensitive data access
- Track table/view usage
- Audit data access patterns

---

### 6. **snowflake_security_alerts**
Auto-detected security issues

**Alert Types**:
- `STALE_USER` - Haven't logged in 90+ days
- `NO_MFA` - Using password without MFA
- `FAILED_LOGINS` - 10+ failed attempts
- `OVERPRIVILEGED_ROLE` - Role with excessive permissions
- `ADMIN_ACCESS` - ACCOUNTADMIN usage

**Severity Levels**:
- `critical`, `high`, `medium`, `low`

**Statuses**:
- `open`, `investigating`, `resolved`, `false_positive`

---

### 7. **snowflake_stale_users**
Users who haven't logged in recently

**Key Columns**:
- `user_name`, `last_login_date`, `days_since_login`
- `assigned_roles[]`, `has_admin_role`
- `risk_level` (high/medium/low)
- `recommended_action` (remove/disable/monitor)

---

## 🔧 **Backend Service Created**

**File**: `backend/src/services/SnowflakeSecurityService.ts`

### Main Functions:

#### 1. **extractSecurityData(connectorId)**
Extracts all security data from Snowflake:
```typescript
{
  login_events: 1234,
  user_roles: 56,
  role_privileges: 789,
  network_policies: 3,
  access_events: 2000,
  security_alerts: 12,
  stale_users: 5
}
```

#### 2. **detectStaleUsers(connectorId)**
Query to find inactive users:
```sql
WITH last_logins AS (
  SELECT user_name, 
         MAX(event_timestamp) as last_login_date,
         DATEDIFF('day', MAX(event_timestamp), CURRENT_TIMESTAMP()) as days_since_login
  FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
  WHERE is_success = TRUE
  GROUP BY user_name
)
SELECT * FROM last_logins
WHERE days_since_login >= 90
ORDER BY days_since_login DESC;
```

#### 3. **checkMissingMFA(connectorId)**
Find users without MFA:
```sql
SELECT user_name,
       first_authentication_factor,
       COUNT(*) as login_count
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE first_authentication_factor = 'PASSWORD'
  AND is_success = TRUE
  AND event_timestamp >= DATEADD('day', -30, CURRENT_TIMESTAMP())
GROUP BY user_name, first_authentication_factor
HAVING COUNT(*) > 5;
```

#### 4. **checkFailedLogins(connectorId)**
Detect brute force attempts:
```sql
SELECT user_name,
       client_ip,
       COUNT(*) as failed_logins
FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE is_success = FALSE
  AND error_message LIKE '%LOGIN_FAILED%'
  AND event_timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY user_name, client_ip
HAVING COUNT(*) >= 10
ORDER BY failed_logins DESC;
```

#### 5. **checkAdminAccess(connectorId)**
Audit ACCOUNTADMIN usage:
```sql
SELECT grantee_name as user_name,
       role,
       granted_on as grant_date,
       granted_by
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
WHERE role IN ('ACCOUNTADMIN', 'SECURITYADMIN')
  AND deleted_on IS NULL
ORDER BY granted_on DESC;
```

#### 6. **checkOverPrivilegedRoles(connectorId)**
Find roles with excessive permissions:
```sql
SELECT role,
       COUNT(DISTINCT privilege) AS num_privileges,
       COUNT(DISTINCT granted_on) AS num_objects
FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
WHERE role NOT IN ('PUBLIC', 'SYSADMIN', 'ACCOUNTADMIN', 'SECURITYADMIN')
  AND deleted_on IS NULL
GROUP BY role
HAVING COUNT(DISTINCT privilege) > 10
ORDER BY num_privileges DESC;
```

#### 7. **getSecuritySummary(connectorId)**
Dashboard summary:
```typescript
{
  alerts: {
    critical: 2,
    high: 5,
    medium: 8,
    low: 12
  },
  stale_users: {
    high_risk: 3,
    medium_risk: 7,
    low_risk: 15
  },
  failed_logins_last_week: 45
}
```

---

## ⚠️ **Current Status: Partially Implemented**

### ✅ **What's Done:**
1. Database schema created (7 tables)
2. Indexes and RLS configured
3. Backend service structure created
4. All SQL queries prepared
5. Service methods defined

### ⚠️ **What's TODO:**
1. **Snowflake Query Execution**: Connect SnowflakeConnector to actually run queries
2. **Data Insertion**: Store extracted data in database tables
3. **API Endpoints**: Create controllers and routes
4. **Scheduler**: Add security extraction to cron jobs
5. **Frontend UI**: Build security dashboard

---

## 🚀 **Next Steps to Make It Work**

### Step 1: Apply Database Migration
```bash
cd supabase
supabase db reset  # Or apply in production
```

### Step 2: Connect Snowflake Query Execution

The service currently has `TODO` comments where Snowflake queries should execute. Need to:

```typescript
// In extractLoginHistory()
const snowflakeConnector = new SnowflakeConnector(/*...*/);
const results = await snowflakeConnector.executeQuery(query);

// Then insert into database
const { error } = await this.supabase
  .schema('enterprise')
  .from('snowflake_login_history')
  .insert(results.map(row => ({
    connector_id: connectorId,
    organization_id: connector.organization_id,
    event_id: row.EVENT_ID,
    event_timestamp: row.EVENT_TIMESTAMP,
    user_name: row.USER_NAME,
    // ... map all fields
  })));
```

### Step 3: Create API Endpoints

```typescript
// backend/src/api/controllers/snowflake-security.controller.ts
export async function getSecuritySummary(req, res) {
  const connectorId = req.params.id;
  const summary = await securityService.getSecuritySummary(connectorId);
  res.json(summary);
}

export async function extractSecurityData(req, res) {
  const connectorId = req.params.id;
  const results = await securityService.extractSecurityData(connectorId);
  res.json(results);
}

export async function getSecurityAlerts(req, res) {
  const connectorId = req.params.id;
  const { data } = await supabase
    .schema('enterprise')
    .from('snowflake_security_alerts')
    .select('*')
    .eq('connector_id', connectorId)
    .eq('status', 'open')
    .order('severity', { ascending: false });
  res.json(data);
}

export async function getStaleUsers(req, res) {
  const connectorId = req.params.id;
  const { data } = await supabase
    .schema('enterprise')
    .from('snowflake_stale_users')
    .select('*')
    .eq('connector_id', connectorId)
    .order('risk_level', { ascending: false });
  res.json(data);
}
```

### Step 4: Add Routes

```typescript
// backend/src/api/routes/connectors.routes.ts
router.get('/:id/security/summary', getSecuritySummary);
router.post('/:id/security/extract', extractSecurityData);
router.get('/:id/security/alerts', getSecurityAlerts);
router.get('/:id/security/stale-users', getStaleUsers);
router.get('/:id/security/login-history', getLoginHistory);
router.get('/:id/security/failed-logins', getFailedLogins);
router.get('/:id/security/admin-access', getAdminAccess);
```

### Step 5: Add to Scheduler

```typescript
// backend/src/jobs/scheduler.ts
const securityExtractionJob = cron.schedule('0 3 * * *', async () => {
  // Run daily at 3 AM
  console.log('[Scheduler] Running security extraction...');
  
  const { data: connectors } = await supabase
    .schema('enterprise')
    .from('connectors')
    .select('id')
    .eq('connector_type', 'snowflake')
    .eq('status', 'active');

  for (const connector of connectors || []) {
    try {
      await securityService.extractSecurityData(connector.id);
    } catch (error) {
      console.error(`[Scheduler] Security extraction failed for ${connector.id}:`, error);
    }
  }
});
```

---

## 📋 **SQL Queries Implemented**

### User & Role Monitoring ✅
1. **Find stale users** (haven't logged in 90+ days)
2. **Audit ACCOUNTADMIN/SECURITYADMIN** usage
3. **Find over-privileged roles** (10+ privileges)

### Authentication & Network Security ✅
4. **Verify MFA is enabled** (check PASSWORD-only logins)
5. **Check network policies** (IP allowlists/blocklists)
6. **Track failed login attempts** (10+ failures = alert)

### Data Access & Activity ✅
7. **Monitor data access** (table/view access patterns)
8. **Review query history** (what queries are running)

---

## 🎨 **Frontend Dashboard (TODO)**

### Security Overview Page
```typescript
const SecurityDashboard = ({ connectorId }) => {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [staleUsers, setStaleUsers] = useState([]);

  // Dashboard sections:
  // 1. Alert counters (critical, high, medium, low)
  // 2. Stale users table with risk levels
  // 3. Recent failed logins chart
  // 4. MFA adoption rate
  // 5. Admin access audit log
  // 6. Over-privileged roles list
}
```

---

## 🔐 **Security Alert Types**

| Alert Type | Severity | Trigger Condition |
|-----------|----------|-------------------|
| STALE_USER | High (if admin) / Medium | 90+ days no login |
| NO_MFA | High | 5+ password-only logins in 30 days |
| FAILED_LOGINS | Critical | 10+ failed attempts from same IP |
| OVERPRIVILEGED_ROLE | Medium | Role with 10+ privileges |
| ADMIN_ACCESS | Medium | ACCOUNTADMIN usage tracking |

---

## 📈 **Expected Performance**

- **Login History**: ~10,000 events per extraction (90 days)
- **User Roles**: ~100-500 grants
- **Role Privileges**: ~1,000-5,000 grants
- **Network Policies**: ~1-10 policies
- **Access History**: ~5,000 events (30 days)
- **Security Alerts**: ~5-20 active alerts
- **Stale Users**: ~5-50 users

---

## ✅ **Files Created**

1. `supabase/migrations/20251105000004_snowflake_security_monitoring.sql` (database schema)
2. `backend/src/services/SnowflakeSecurityService.ts` (extraction service)
3. `SNOWFLAKE_SECURITY_IMPLEMENTATION.md` (this file)

---

## 🎯 **Summary**

**You were correct!** We had:
- ❌ SQL queries in documentation files
- ❌ No database tables
- ❌ No backend service to execute queries
- ❌ No data storage

**Now we have**:
- ✅ 7 database tables for security data
- ✅ Comprehensive backend service structure
- ✅ All your SQL queries integrated
- ✅ Ready for Snowflake connection

**Still needed**:
- ⏳ Connect Snowflake query execution
- ⏳ Create API endpoints
- ⏳ Build frontend UI
- ⏳ Add to scheduler

The foundation is complete - just need to wire up the Snowflake execution and build the UI!
