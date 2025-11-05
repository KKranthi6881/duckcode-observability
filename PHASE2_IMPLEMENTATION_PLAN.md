# Phase 2 Implementation Plan: Smart Recommendations

## 📊 Current State Review (Phase 1 - COMPLETED ✅)

### ✅ What's Working
1. **Backend Data Collection:**
   - ✅ WAREHOUSE_METERING_HISTORY (compute costs)
   - ✅ STORAGE_USAGE (storage costs)
   - ✅ QUERY_HISTORY (queries + performance)
   - ✅ TABLE_STORAGE_METRICS (table sizes)
   - ✅ ACCESS_HISTORY (table usage patterns)

2. **Database Storage:**
   - ✅ `snowflake_cost_metrics` table (daily costs)
   - ✅ `snowflake_storage_usage` table (table-level storage)
   - ✅ `snowflake_warehouse_metrics` table (warehouse stats)
   - ✅ `snowflake_waste_opportunities` table (basic waste)

3. **APIs Working:**
   - ✅ GET `/api/connectors/:id/cost/overview`
   - ✅ GET `/api/connectors/:id/cost/warehouses`
   - ✅ GET `/api/connectors/:id/cost/top-queries`
   - ✅ GET `/api/connectors/:id/cost/storage-usage`

4. **UI Components:**
   - ✅ Basic cost dashboard
   - ✅ Warehouse list with credits
   - ✅ Top queries table
   - ✅ Basic waste opportunities

### ⚠️ What's Missing from Phase 1
- More detailed warehouse economics (utilization %)
- Storage breakdown hierarchy tree
- Better waste detection UI

---

## 🚀 Phase 2: Smart Recommendations

### New Data Collection Requirements

#### 1. Warehouse Utilization Data
**Table:** `snowflake_warehouse_utilization`
```sql
CREATE TABLE duckcode.snowflake_warehouse_utilization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES duckcode.connectors(id) ON DELETE CASCADE,
  warehouse_name TEXT NOT NULL,
  warehouse_size TEXT,
  measurement_time TIMESTAMPTZ NOT NULL,
  avg_running DECIMAL(10,4),
  avg_queued_load DECIMAL(10,4),
  avg_queued_provisioning DECIMAL(10,4),
  avg_blocked DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouse_utilization_connector ON duckcode.snowflake_warehouse_utilization(connector_id);
CREATE INDEX idx_warehouse_utilization_time ON duckcode.snowflake_warehouse_utilization(measurement_time);
```

#### 2. Query Repetition Patterns
**Table:** `snowflake_query_patterns`
```sql
CREATE TABLE duckcode.snowflake_query_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES duckcode.connectors(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL, -- MD5 of normalized query
  query_text TEXT,
  database_name TEXT,
  schema_name TEXT,
  warehouse_name TEXT,
  execution_count INTEGER,
  total_execution_time_ms BIGINT,
  avg_execution_time_ms DECIMAL(12,2),
  total_bytes_scanned BIGINT,
  first_execution TIMESTAMPTZ,
  last_execution TIMESTAMPTZ,
  analysis_period_start TIMESTAMPTZ NOT NULL,
  analysis_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_query_patterns_connector ON duckcode.snowflake_query_patterns(connector_id);
CREATE INDEX idx_query_patterns_exec_count ON duckcode.snowflake_query_patterns(execution_count);
```

#### 3. Clustering Costs
**Table:** `snowflake_clustering_history`
```sql
CREATE TABLE duckcode.snowflake_clustering_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES duckcode.connectors(id) ON DELETE CASCADE,
  database_name TEXT,
  schema_name TEXT,
  table_name TEXT NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  credits_used DECIMAL(12,6),
  bytes_reclustered BIGINT,
  rows_reclustered BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clustering_history_connector ON duckcode.snowflake_clustering_history(connector_id);
CREATE INDEX idx_clustering_history_table ON duckcode.snowflake_clustering_history(table_name);
```

#### 4. Materialized View Refresh
**Table:** `snowflake_mv_refresh_history`
```sql
CREATE TABLE duckcode.snowflake_mv_refresh_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES duckcode.connectors(id) ON DELETE CASCADE,
  database_name TEXT,
  schema_name TEXT,
  view_name TEXT NOT NULL,
  refresh_start_time TIMESTAMPTZ,
  refresh_end_time TIMESTAMPTZ,
  credits_used DECIMAL(12,6),
  bytes_written BIGINT,
  rows_written BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mv_refresh_connector ON duckcode.snowflake_mv_refresh_history(connector_id);
```

#### 5. Task Execution History
**Table:** `snowflake_task_history`
```sql
CREATE TABLE duckcode.snowflake_task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES duckcode.connectors(id) ON DELETE CASCADE,
  database_name TEXT,
  schema_name TEXT,
  task_name TEXT NOT NULL,
  state TEXT,
  scheduled_time TIMESTAMPTZ,
  completed_time TIMESTAMPTZ,
  query_id TEXT,
  warehouse_name TEXT,
  execution_time_ms BIGINT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_history_connector ON duckcode.snowflake_task_history(connector_id);
CREATE INDEX idx_task_history_task ON duckcode.snowflake_task_history(task_name);
```

---

### Recommendation Engine Schema

#### 6. Recommendations Table
**Table:** `snowflake_recommendations`
```sql
CREATE TABLE duckcode.snowflake_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES duckcode.connectors(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES duckcode.organizations(id) ON DELETE CASCADE,
  
  -- Recommendation details
  type TEXT NOT NULL, -- 'warehouse_resize', 'auto_suspend', 'enable_cache', 'archive_table', 'disable_clustering'
  priority TEXT NOT NULL, -- 'high', 'medium', 'low'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'applied', 'dismissed', 'failed'
  
  -- Target object
  warehouse_name TEXT,
  database_name TEXT,
  schema_name TEXT,
  table_name TEXT,
  query_hash TEXT,
  
  -- Recommendation specifics
  title TEXT NOT NULL,
  description TEXT,
  current_value TEXT,
  recommended_value TEXT,
  
  -- Impact
  estimated_monthly_savings_usd DECIMAL(12,2),
  confidence_score DECIMAL(5,2), -- 0-100
  effort_level TEXT, -- 'easy', 'medium', 'hard'
  
  -- Implementation
  sql_commands TEXT[], -- Array of SQL commands to apply
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES duckcode.users(id),
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Recommendations expire after 30 days
  
  CONSTRAINT valid_priority CHECK (priority IN ('high', 'medium', 'low')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'applied', 'dismissed', 'failed')),
  CONSTRAINT valid_effort CHECK (effort_level IN ('easy', 'medium', 'hard'))
);

CREATE INDEX idx_recommendations_connector ON duckcode.snowflake_recommendations(connector_id);
CREATE INDEX idx_recommendations_org ON duckcode.snowflake_recommendations(organization_id);
CREATE INDEX idx_recommendations_status ON duckcode.snowflake_recommendations(status);
CREATE INDEX idx_recommendations_priority ON duckcode.snowflake_recommendations(priority);
```

#### 7. ROI Tracking Table
**Table:** `snowflake_roi_tracking`
```sql
CREATE TABLE duckcode.snowflake_roi_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES duckcode.connectors(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES duckcode.snowflake_recommendations(id) ON DELETE SET NULL,
  
  -- Baseline (before)
  baseline_period_start TIMESTAMPTZ NOT NULL,
  baseline_period_end TIMESTAMPTZ NOT NULL,
  baseline_monthly_cost_usd DECIMAL(12,2),
  
  -- After implementation
  measurement_period_start TIMESTAMPTZ,
  measurement_period_end TIMESTAMPTZ,
  actual_monthly_cost_usd DECIMAL(12,2),
  
  -- Calculated savings
  projected_savings_usd DECIMAL(12,2),
  actual_savings_usd DECIMAL(12,2),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roi_tracking_connector ON duckcode.snowflake_roi_tracking(connector_id);
CREATE INDEX idx_roi_tracking_recommendation ON duckcode.snowflake_roi_tracking(recommendation_id);
```

---

## 🔧 Backend Implementation Plan

### Step 1: Enhanced Data Extractors (1-2 days)

**File:** `backend/src/services/connectors/SnowflakePhase2Extractor.ts`

```typescript
class SnowflakePhase2Extractor {
  async extractWarehouseUtilization(connectorId: string): Promise<void>
  async extractQueryPatterns(connectorId: string): Promise<void>
  async extractClusteringHistory(connectorId: string): Promise<void>
  async extractMaterializedViewRefresh(connectorId: string): Promise<void>
  async extractTaskHistory(connectorId: string): Promise<void>
}
```

### Step 2: Recommendation Engine (2-3 days)

**File:** `backend/src/services/recommendations/SnowflakeRecommendationEngine.ts`

```typescript
class SnowflakeRecommendationEngine {
  // Rule-based recommendation generators
  async analyzeWarehouseRightSizing(connectorId: string): Promise<Recommendation[]>
  async analyzeAutoSuspend(connectorId: string): Promise<Recommendation[]>
  async analyzeQueryCaching(connectorId: string): Promise<Recommendation[]>
  async analyzeTableArchival(connectorId: string): Promise<Recommendation[]>
  async analyzeClusteringWaste(connectorId: string): Promise<Recommendation[]>
  
  // Generate all recommendations
  async generateRecommendations(connectorId: string): Promise<void>
  
  // Apply recommendations
  async applyRecommendation(recommendationId: string, userId: string): Promise<void>
}
```

**Rules:**
1. **Warehouse Right-Sizing:** If AVG_UTILIZATION < 40% for 7+ days → Downsize
2. **Auto-Suspend:** If AVG_IDLE_TIME > 5 minutes → Enable auto-suspend
3. **Result Caching:** If query executed 10+ times in 30 days → Enable caching
4. **Table Archival:** If not accessed 90+ days AND size > 100GB → Archive
5. **Clustering Waste:** If clustering credits > $50/month AND query count < 100 → Disable

### Step 3: ROI Tracking Service (1 day)

**File:** `backend/src/services/recommendations/ROITrackingService.ts`

```typescript
class ROITrackingService {
  async establishBaseline(connectorId: string): Promise<void>
  async calculateActualSavings(recommendationId: string): Promise<ROISavings>
  async getROISummary(connectorId: string): Promise<ROISummary>
}
```

### Step 4: New API Endpoints (1 day)

**File:** `backend/src/api/controllers/snowflake-recommendations.controller.ts`

```typescript
// GET /api/connectors/:id/recommendations
// - List all recommendations with filters (status, priority, type)

// GET /api/connectors/:id/recommendations/summary
// - Total savings potential
// - Count by status
// - Count by priority

// POST /api/connectors/:id/recommendations/:recommendationId/apply
// - Apply a recommendation
// - Execute SQL commands
// - Track ROI

// PUT /api/connectors/:id/recommendations/:recommendationId/dismiss
// - Dismiss a recommendation

// GET /api/connectors/:id/roi
// - ROI summary
// - Actual vs projected savings
// - Payback period
```

---

## 🎨 Frontend Implementation Plan

### Step 1: Recommendations Dashboard (2 days)

**File:** `frontend/src/pages/dashboard/SnowflakeRecommendations.tsx`

**Components:**
1. **Recommendations Summary Cards**
   - Total potential savings
   - Pending recommendations count
   - Applied recommendations count
   - Actual savings to date

2. **Recommendations Table**
   Columns:
   - Priority badge (🔴 High, 🟡 Medium, 🟢 Low)
   - Type icon
   - Title & Description
   - Target (warehouse/table/query)
   - Impact ($/month)
   - Confidence %
   - Effort level
   - Actions (Apply, Dismiss, View Details)

3. **Filters:**
   - Status: Pending / Applied / Dismissed
   - Priority: High / Medium / Low
   - Type: All types dropdown

### Step 2: Recommendation Detail Modal (1 day)

**Component:** `RecommendationDetailModal.tsx`

**Sections:**
- Current State
- Recommended Change
- Impact Analysis (chart showing before/after)
- SQL Commands (preview)
- Confidence & Risk Assessment
- Apply button with confirmation

### Step 3: ROI Dashboard (1-2 days)

**File:** `frontend/src/pages/dashboard/SnowflakeROI.tsx`

**Widgets:**
1. **ROI Summary**
   - Total projected savings
   - Total actual savings
   - Payback period
   - ROI percentage

2. **Savings Trend Chart**
   - Line chart: Projected vs Actual over time

3. **Recommendations Impact Table**
   - Recommendation
   - Projected
   - Actual
   - Variance %
   - Status

4. **Top Wins**
   - List of highest-impact applied recommendations

---

## 📅 Implementation Timeline (7-10 days)

### Week 1: Backend Foundation
- **Day 1-2:** Database schema + migrations
- **Day 3-4:** Phase 2 data extractors
- **Day 5:** Recommendation engine (rules 1-3)

### Week 2: Recommendations & UI
- **Day 6:** Recommendation engine (rules 4-5) + ROI tracking
- **Day 7:** API endpoints
- **Day 8-9:** Frontend recommendations dashboard
- **Day 10:** ROI dashboard + testing

---

## ✅ Testing Strategy

### Unit Tests
- Recommendation rule logic
- ROI calculation accuracy
- SQL query correctness

### Integration Tests
- Full extraction pipeline
- Recommendation generation
- Apply recommendation flow

### User Acceptance Tests
1. Generate recommendations for test account
2. Verify impact calculations
3. Apply one recommendation manually
4. Verify ROI tracking updates

---

## 🎯 Success Metrics (Phase 2)

1. **Technical:**
   - Generate 5+ recommendations per customer
   - 95%+ confidence scores on high-priority recommendations
   - < 5 second recommendation generation time

2. **Business:**
   - 50% of customers apply at least 1 recommendation
   - Average projected savings: $5K+/month
   - 90% accuracy on savings projections (within 20%)

3. **User Experience:**
   - One-click recommendation application
   - Real-time ROI updates
   - Clear impact visualization

---

## 🚦 Next Steps

1. **Test all SQL queries** in `PHASE2_SQL_QUERIES_FOR_TESTING.sql`
2. **Report any errors** or schema mismatches
3. **Create database migration** for new tables
4. **Implement extractors** one by one
5. **Build recommendation engine** with rules
6. **Create API endpoints**
7. **Build frontend dashboards**
8. **Test end-to-end flow**
9. **Deploy to production**

---

## 💰 Pricing Strategy Phase 2

**Tier:** Pro Plan
**Price:** $999/month (up from $499 Phase 1)

**Includes:**
- Everything in Phase 1
- AI-powered recommendations
- One-click optimization
- ROI tracking
- Unlimited recommendations
- Slack/Email alerts
- Priority support

**Upgrade Path:**
- Existing customers: Email campaign highlighting new features
- New customers: Start at $999 with 14-day free trial
- Show projected savings in demo

**Money-Back Guarantee:**
"If we don't find at least $3,000/month in savings, we'll refund your first month"
