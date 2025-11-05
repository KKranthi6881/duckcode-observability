# Budget Guardrails & Security Monitoring - Implementation Guide

## 🎯 **Overview**

We've implemented two critical enterprise features:

1. **Budget Guardrails** - Prevent cost overruns with real-time monitoring
2. **Security & Access Monitoring** - Track who's accessing what and spending how much

---

## ✅ **COMPLETED: Database Schemas**

### **Part 1: Budget Guardrails Schema** ✅

**File:** `supabase/migrations/20251105000000_budget_guardrails.sql`

#### **Tables Created:**

**1. `snowflake_budgets`** - Budget definitions
```sql
Columns:
- budget_type: 'organization' | 'connector' | 'warehouse'
- budget_name: Display name
- budget_amount: Dollar amount limit
- budget_period: 'monthly' | 'quarterly' | 'annually'
- alert_threshold_1: Default 75% (first warning)
- alert_threshold_2: Default 90% (second warning)
- alert_threshold_3: Default 100% (final warning)
- email_alerts: Boolean
- slack_webhook_url: For Slack notifications
- auto_suspend_at_limit: Auto-action when exceeded
- status: 'active' | 'paused' | 'archived'
- current_period_start/end: Tracking period

Capabilities:
✅ Set budgets at 3 levels (org/connector/warehouse)
✅ Multiple alert thresholds
✅ Email + Slack notifications
✅ Auto-suspend warehouses at limit
```

**2. `snowflake_budget_alerts`** - Alert history
```sql
Tracks:
- Which threshold triggered (75%, 90%, 100%)
- Current spend vs budget
- Percentage used
- Notification status (email sent, Slack sent)
- Acknowledgment tracking
```

**3. `snowflake_budget_snapshots`** - Daily spend tracking
```sql
Captures:
- Daily spend snapshots
- Budget utilization percentage
- Remaining budget
- Projected end-of-period spend
- Estimated date when budget will exceed
```

#### **Functions Created:**

1. **`get_budget_current_spend(budget_id)`**
   - Calculates real-time spending for a budget
   - Aggregates from `snowflake_daily_costs` or `snowflake_warehouse_metrics`
   - Handles org/connector/warehouse level budgets

2. **`check_budget_alerts(budget_id)`**
   - Checks if spending crossed thresholds
   - Creates alerts automatically
   - Prevents duplicate alerts in same period
   - Returns alert type and percentage used

---

### **Part 2: Security & Access Monitoring Schema** ✅

**File:** `supabase/migrations/20251105000001_security_access_monitoring.sql`

#### **Tables Created:**

**1. `snowflake_user_costs`** - User cost attribution
```sql
Tracks per user:
- Total queries executed
- Total cost (USD)
- Compute cost breakdown
- Storage accessed (bytes)
- Average execution time
- Failed queries count
- Top warehouse used

Use cases:
✅ Who's spending the most money
✅ Cost chargeback by user/team
✅ Identify expensive users
✅ Failure rate tracking
```

**2. `snowflake_access_patterns`** - Access logs & anomaly detection
```sql
Records:
- Login events
- Query executions
- Unusual access patterns
- Bulk downloads
- Permission changes

Anomaly detection:
- is_anomaly flag
- risk_score (0-100)
- anomaly_reason description
- Source IP tracking
- Client type (UI/API/JDBC/ODBC)

Security features:
✅ Detect unusual table access
✅ Track new IP logins
✅ Identify bulk data exports
✅ Permission audit trail
```

**3. `snowflake_role_permissions`** - Role/permission audit
```sql
Tracks:
- Which role has which permission
- On which object (table/view/schema/database)
- Who granted it and when
- Active vs revoked status

Audit flags:
- is_excessive: Over-permissioned roles
- is_unused: Permissions never used in 90+ days

Use cases:
✅ Compliance audits
✅ Least privilege enforcement
✅ Unused permission cleanup
✅ Role-based access review
```

#### **Views Created:**

1. **`v_top_expensive_users`**
   - Ranks users by cost
   - Calculates cost per query
   - Shows failure rates
   - Pre-computed for fast dashboards

2. **`v_security_issues`**
   - Aggregates all security problems
   - Over-permissioned roles
   - Unused permissions
   - Anomalous access patterns
   - Severity ratings

#### **Functions Created:**

1. **`detect_access_anomalies(connector_id, lookback_days)`**
   - Excessive table access (50+ tables in one session)
   - New IP address logins
   - Query volume spikes (3x normal)
   - Returns risk score and description

---

## 📊 **What These Enable**

### **Budget Guardrails Dashboard Will Show:**

```
┌─────────────────────────────────────────────────┐
│ 💰 Monthly Budget: $50,000                     │
│ 📊 Current Spend: $33,500 (67%)                │
│ 📈 Projected: $48,200 (On track)               │
│ ⏰ Days Remaining: 12 days                     │
│                                                 │
│ Progress Bar:                                   │
│ ████████████░░░░░░░░  67%                      │
│                                                 │
│ Alerts:                                         │
│ ⚠️  75% threshold reached on Nov 20             │
│ 🟢  Under budget                                │
│                                                 │
│ [Edit Budget] [View History] [Set Alerts]      │
└─────────────────────────────────────────────────┘
```

### **Security Dashboard Will Show:**

```
┌─────────────────────────────────────────────────┐
│ 👥 Top 10 Most Expensive Users                 │
│                                                 │
│ 1. john.doe@company.com      $4,320 (312 queries)│
│ 2. jane.smith@company.com    $3,180 (245 queries)│
│ 3. data_pipeline_user        $2,940 (1,240 queries)│
│                                                 │
│ 🚨 Security Alerts (3)                         │
│                                                 │
│ 🔴 High Risk:                                   │
│ - User "contractor_1" accessed 127 tables      │
│   Risk Score: 85                                │
│                                                 │
│ 🟡 Medium Risk:                                 │
│ - New IP login: 203.45.67.89 (john.doe)        │
│   Risk Score: 70                                │
│                                                 │
│ 📋 Permission Audit (12 issues)                │
│ - 5 roles with excessive permissions           │
│ - 7 unused permissions (90+ days)              │
│                                                 │
│ [View Details] [Export Report]                 │
└─────────────────────────────────────────────────┘
```

---

## 🚧 **NEXT: Backend APIs** (To Build)

### **Budget APIs Needed:**

```typescript
// Budget CRUD
POST   /api/connectors/:id/budgets              // Create budget
GET    /api/connectors/:id/budgets              // List budgets
GET    /api/connectors/:id/budgets/:budgetId    // Get budget
PUT    /api/connectors/:id/budgets/:budgetId    // Update budget
DELETE /api/connectors/:id/budgets/:budgetId    // Delete budget

// Budget tracking
GET    /api/connectors/:id/budgets/:budgetId/current-spend  // Real-time spend
GET    /api/connectors/:id/budgets/:budgetId/forecast       // Projected spend
GET    /api/connectors/:id/budgets/:budgetId/alerts         // Alert history
POST   /api/connectors/:id/budgets/:budgetId/check-alerts   // Manual alert check

// Organization-level
GET    /api/organizations/:orgId/budgets/summary   // All budgets summary
```

### **Security APIs Needed:**

```typescript
// User costs
GET    /api/connectors/:id/security/user-costs           // Top expensive users
GET    /api/connectors/:id/security/user-costs/:user     // Specific user details

// Access patterns
GET    /api/connectors/:id/security/access-patterns      // Recent access logs
GET    /api/connectors/:id/security/anomalies            // Detected anomalies
GET    /api/connectors/:id/security/access-patterns/:user // User's access history

// Permissions audit
GET    /api/connectors/:id/security/permissions          // All permissions
GET    /api/connectors/:id/security/permissions/issues   // Security issues
GET    /api/connectors/:id/security/permissions/role/:role // Role permissions

// Summary
GET    /api/connectors/:id/security/summary              // Security dashboard data
```

---

## 🎨 **NEXT: Frontend Components** (To Build)

### **1. BudgetGuardrailsView Component**

**Features:**
- Budget setup form (name, amount, period, thresholds)
- Current budget list with status indicators
- Real-time spend tracking widget
- Budget progress bars with color coding:
  - Green: 0-74%
  - Yellow: 75-89%
  - Orange: 90-99%
  - Red: 100%+
- Alert configuration (email, Slack, auto-suspend)
- Spending forecast chart
- Alert history timeline

**UI Mockup:**
```tsx
<BudgetGuardrailsView>
  <BudgetSetupForm />
  <BudgetsList>
    {budgets.map(budget => (
      <BudgetCard
        budget={budget}
        currentSpend={getCurrentSpend(budget)}
        projected={getProjected(budget)}
      />
    ))}
  </BudgetsList>
  <AlertsTimeline />
</BudgetGuardrailsView>
```

### **2. SecurityMonitoringView Component**

**Features:**
- Top expensive users table
- User cost breakdown chart
- Security alerts panel
- Access pattern timeline
- Permission audit grid
- Anomaly detection cards
- Risk score indicators
- Export reports button

**UI Mockup:**
```tsx
<SecurityMonitoringView>
  <SecuritySummary>
    <TopExpensiveUsers />
    <SecurityAlerts />
    <PermissionIssues />
  </SecuritySummary>
  
  <Tabs>
    <Tab label="User Costs">
      <UserCostsTable />
      <UserCostChart />
    </Tab>
    
    <Tab label="Access Patterns">
      <AccessTimeline />
      <AnomalyCards />
    </Tab>
    
    <Tab label="Permissions">
      <PermissionsAudit />
      <SecurityIssues />
    </Tab>
  </Tabs>
</SecurityMonitoringView>
```

---

## 🎯 **Selling Points**

### **Budget Guardrails:**

> **"Never go over budget again. Get alerted at 75%, 90%, 100% - or auto-suspend warehouses at limit."**

**Enterprise value:**
- CFO requirement: Budget compliance
- Finance team: Prevent overruns
- FinOps teams: Cost governance
- Forecast accuracy: Know when you'll hit limit

**Demo script:**
```
"Set $50K monthly budget → Currently at $33K (67%)
Projected to finish at $48K (on track)
Alert at 90% ($45K) → Email sent to team
Auto-suspend warehouses at 100% → Cost guaranteed"
```

### **Security & Access Monitoring:**

> **"Know exactly who's accessing what, spending how much, and detect suspicious activity automatically."**

**Enterprise value:**
- Security teams: Audit trail + anomaly detection
- Finance teams: User-level cost attribution
- Compliance: SOC 2, GDPR requirements
- Management: Identify expensive users/teams

**Demo script:**
```
"Top user spending $4,320/month → 312 queries
Anomaly detected: User accessed 127 tables in 1 hour → Risk: 85
5 roles with excessive permissions → Unused in 90+ days
Cost by team: Engineering ($12K), Analytics ($8K), Sales ($3K)"
```

---

## 📈 **Implementation Priority**

### **Week 1: Budget Guardrails** (Higher Priority)

**Why first:**
- Simpler to implement
- Clear ROI ("prevent overruns")
- Essential for enterprise sales
- Standalone value

**Tasks:**
1. ✅ Database schema (Done)
2. ⏳ Backend APIs (4-5 hours)
3. ⏳ Frontend UI (4-5 hours)
4. ⏳ Testing (2 hours)

**Total:** ~10-12 hours

### **Week 2: Security Monitoring**

**Why second:**
- More complex (anomaly detection)
- Requires data population
- Builds on budget features
- Compliance selling point

**Tasks:**
1. ✅ Database schema (Done)
2. ⏳ Backend APIs (5-6 hours)
3. ⏳ Frontend UI (6-7 hours)
4. ⏳ Data extraction (from Snowflake) (3-4 hours)
5. ⏳ Testing (2 hours)

**Total:** ~16-19 hours

---

## 🚀 **Integration Points**

### **Budget Guardrails Integration:**

```
Waste Detection Tab
    ↓
"You're wasting $47K/month"
    ↓
Budget Guardrails Tab
    ↓
"Set $100K budget to prevent overruns"
    ↓
Alerts sent at 75% ($75K)
    ↓
Auto-suspend at 100%
```

### **Security Monitoring Integration:**

```
Query Performance Tab
    ↓
"This query runs 400x/day"
    ↓
Security Tab
    ↓
"User john.doe runs this query 380x/day → Costing $12K/month"
    ↓
Recommendation: Switch to scheduled batch job → Save $10K/month
```

---

## 📦 **Files Created**

### **Database:**
- ✅ `supabase/migrations/20251105000000_budget_guardrails.sql` (240 lines)
- ✅ `supabase/migrations/20251105000001_security_access_monitoring.sql` (330 lines)

### **To Create (Backend):**
- ⏳ `backend/src/api/controllers/budgets.controller.ts`
- ⏳ `backend/src/api/routes/budgets.routes.ts`
- ⏳ `backend/src/services/BudgetTrackingService.ts`
- ⏳ `backend/src/api/controllers/security-monitoring.controller.ts`
- ⏳ `backend/src/api/routes/security-monitoring.routes.ts`
- ⏳ `backend/src/services/SecurityMonitoringService.ts`

### **To Create (Frontend):**
- ⏳ `frontend/src/components/snowflake/BudgetGuardrailsView.tsx`
- ⏳ `frontend/src/components/snowflake/SecurityMonitoringView.tsx`
- ⏳ `frontend/src/services/budgetService.ts`
- ⏳ `frontend/src/services/securityService.ts`

---

## ✅ **Success Criteria**

### **Budget Guardrails:**
- [ ] Can create budgets at org/connector/warehouse level
- [ ] Real-time spend tracking updates every minute
- [ ] Alerts sent at configured thresholds
- [ ] Email notifications working
- [ ] Slack webhooks working (optional)
- [ ] Auto-suspend executes at 100%
- [ ] Forecast shows projected end-of-period spend
- [ ] Budget history visible

### **Security Monitoring:**
- [ ] Top 10 expensive users displayed
- [ ] User cost breakdown shows queries + cost
- [ ] Access patterns logged from Snowflake
- [ ] Anomalies detected automatically
- [ ] Risk scores calculated correctly
- [ ] Permission audit shows excessive/unused
- [ ] Security issues summary visible
- [ ] Export reports functionality

---

## 🎯 **Next Steps**

**Choose one:**

**A) Build Budget Guardrails Backend APIs** (4-5 hours)
- CRUD operations
- Real-time spend calculation
- Alert checking logic
- Integration with existing cost data

**B) Build Security Monitoring Backend APIs** (5-6 hours)
- User cost aggregation
- Access pattern extraction
- Anomaly detection logic
- Permission audit queries

**C) Build Both Frontends First** (Visual progress)
- Use mock data
- Show what it will look like
- Get feedback on UI/UX
- Then wire up backend

**My recommendation: Start with Budget Guardrails Backend (A)**
- Faster ROI
- Clear requirements
- Enterprise blocker
- Can demo immediately after

---

**Ready to build the Budget Guardrails backend APIs?** Let me know and I'll start coding! 🚀
