# Snowflake Intelligence Dashboard - Data Audit

## 📊 Currently Displayed (✅ Done)

### KPI Cards
- ✅ Total Cost
- ✅ Compute Cost
- ✅ Storage Cost  
- ✅ Potential Savings (from waste detection)
- ✅ Total Queries
- ✅ Failure Rate

### Charts & Visualizations
- ✅ Daily Cost Trend (real data from `dailyCredits`)
- ✅ Top Warehouses by Cost (bar chart)
- ✅ Cost by Tags (pie chart)

### Tables
- ✅ Top Slowest Queries (10 rows)
- ✅ Top Storage Tables (10 rows)
- ✅ Smart Recommendations (top 5)

---

## 🚀 Available But NOT Displayed Yet

### 1. **Waste Detection Categories** (Rich Opportunity!)
**Table:** `enterprise.snowflake_waste_opportunities`

**Available Categories:**
- ❌ **Unused Tables** - Tables not accessed in 90+ days
  - Shows: table name, last access date, storage cost, potential savings
  - Can display: List of zombie tables eating storage costs
  
- ❌ **Idle Warehouses** - Warehouses with zero activity
  - Shows: warehouse name, idle days, cost per day
  - Can display: Card showing total idle warehouse waste
  
- ❌ **Oversized Warehouses** - Warehouses too big for workload
  - Shows: warehouse name, current size, recommended size, savings
  - Can display: Right-sizing opportunities
  
- ❌ **Underutilized Warehouses** - <30% utilization
  - Shows: warehouse name, avg utilization %, waste amount
  - Can display: Efficiency opportunities
  
- ❌ **Excessive Time Travel** - Tables with unnecessary retention
  - Shows: table name, retention days, storage cost
  - Can display: Time travel cost optimization
  
- ❌ **Zombie Warehouses** - Auto-suspended warehouses
  - Shows: warehouse name, last activity, monthly cost
  
- ❌ **Failed Query Waste** - Credits wasted on failed queries
  - Shows: query patterns, failure rate, wasted credits
  
- ❌ **Clustering Waste** - Excessive auto-clustering costs
  - Shows: table name, clustering credits, ROI
  
- ❌ **Forgotten Clones** - Untracked table clones
  - Shows: clone name, parent table, age, storage cost

**API:** Already available via `getWasteDetectionFromDB`  
**Display:** Can show detailed breakdown by category

---

### 2. **Storage Analytics** (Deeper Insights)
**Table:** `enterprise.snowflake_storage_usage`

**Available But Not Shown:**
- ❌ **Storage Growth Trend** - Chart showing storage growth over time
- ❌ **Top Databases by Storage** - Which databases consume most storage
- ❌ **Top Schemas by Storage** - Schema-level breakdown
- ❌ **Storage Cost Breakdown** - Active vs Time Travel vs Fail-safe
- ❌ **Table Size Distribution** - Histogram of table sizes

**API:** `getStorageUsageFromDB`, `getStorageCosts`  
**Display:** Add storage trend chart + breakdown cards

---

### 3. **Warehouse Performance Metrics**
**Table:** `enterprise.snowflake_warehouse_metrics`, `snowflake_warehouse_utilization`

**Available But Not Shown:**
- ❌ **Warehouse Utilization Over Time** - Trend chart per warehouse
- ❌ **Queue Times** - Average queued load/provisioning time
- ❌ **Blocked Queries** - How often queries are blocked
- ❌ **Warehouse Efficiency Score** - Custom metric showing cost per query
- ❌ **Peak Usage Hours** - Heatmap of warehouse usage by hour
- ❌ **Auto-Suspend Recommendations** - Warehouses that should suspend faster

**API:** Need to add endpoint to query `snowflake_warehouse_utilization` table  
**Display:** Warehouse performance dashboard section

---

### 4. **Query Analytics** (Rich Performance Data)
**Table:** `enterprise.snowflake_query_metrics`, `snowflake_query_patterns`

**Available But Not Shown:**
- ❌ **Query Pattern Analysis** - Repeated queries that could be cached
  - Shows: query hash, execution count, total time, savings if cached
  
- ❌ **Most Expensive Query Users** - Which users run costly queries
  - Shows: user name, total credits, query count
  
- ❌ **Failed Query Analysis** - Common failure patterns
  - Shows: error types, frequency, affected queries
  
- ❌ **Query Performance Degradation** - Queries getting slower over time
  - Shows: query hash, time trend, possible causes
  
- ❌ **Data Scanned Analysis** - Queries scanning excessive data
  - Shows: query, bytes scanned, partition pruning opportunities

**API:** `getTopQueries` (partially used), need query patterns endpoint  
**Display:** Query intelligence section with caching opportunities

---

### 5. **Budget & Alert System**
**Table:** `enterprise.snowflake_budgets`, `snowflake_budget_alerts`

**Available But Not Shown:**
- ❌ **Active Budgets** - List of configured budgets and spend vs limit
- ❌ **Budget Alerts** - Recent threshold breaches
- ❌ **Spend Forecast** - Projected monthly spend based on trends
- ❌ **Budget Health Score** - How many budgets are at risk

**API:** `listBudgets`, `listBudgetAlerts`, `checkBudget`  
**Display:** Budget monitoring card with alerts

---

### 6. **Data Transfer Costs**
**Available But Not Shown:**
- ❌ **Data Egress Costs** - Cost of data leaving Snowflake
- ❌ **Transfer by Region** - Which regions incur transfer costs
- ❌ **Replication Costs** - Database replication expenses

**API:** `getDataTransferCosts`  
**Display:** Data transfer cost card

---

### 7. **Advanced Analytics Tables**
**Table:** `snowflake_clustering_history`, `snowflake_mv_refresh_history`, `snowflake_task_history`

**Available But Not Shown:**
- ❌ **Clustering Cost Trends** - How much auto-clustering costs over time
- ❌ **Materialized View Refresh Costs** - MV maintenance expenses
- ❌ **Task Execution Costs** - Scheduled task credits consumed
- ❌ **Automatic Maintenance Summary** - Total cost of auto features

**API:** Need to add endpoints for these tables  
**Display:** Advanced features cost breakdown

---

### 8. **ROI Tracking**
**Table:** `enterprise.snowflake_roi_tracking`, `snowflake_recommendation_actions`

**Available But Not Shown:**
- ❌ **Savings Realized** - Actual savings from applied recommendations
- ❌ **Recommendation Success Rate** - % of recommendations that worked
- ❌ **Cumulative Savings** - Total saved since using the platform
- ❌ **ROI by Recommendation Type** - Which types yield best results
- ❌ **Action History** - Timeline of applied/dismissed recommendations

**API:** `getROI`  
**Display:** ROI dashboard showing platform value

---

## 🎯 Recommended Next Steps - Priority Order

### **High Priority** (Immediate Value)
1. ✅ **Waste Detection Breakdown** - Show unused tables, idle warehouses separately
   - Display 3 cards: Unused Tables, Idle Warehouses, Underutilized Warehouses
   - Add expandable tables for each category
   
2. ✅ **Storage Growth Chart** - Trend showing storage increasing over time
   - Use historical data from `snowflake_storage_usage`
   
3. ✅ **Budget Monitoring** - Show if budgets are set and their status
   - Card showing budget health: "3 of 5 budgets on track"
   
4. ✅ **Query Pattern Analysis** - Cacheable queries (huge potential savings!)
   - Table showing repeated queries and estimated savings from caching

### **Medium Priority** (Enhanced Insights)
5. **Warehouse Efficiency Metrics** - Deeper warehouse analytics
   - Utilization charts per warehouse
   - Queue time analysis
   
6. **User Cost Attribution** - Who's spending what
   - Top users by query cost
   - Department/team cost allocation
   
7. **Data Transfer Costs** - Complete cost picture
   - Egress cost card
   - Transfer by region breakdown

### **Lower Priority** (Advanced Features)
8. **Clustering/MV Cost Analytics** - For advanced users
9. **ROI Dashboard** - Platform value demonstration
10. **Forecasting** - Predictive cost modeling

---

## 📋 Summary

### Current Status:
- **Displaying:** 6 KPIs, 3 charts, 3 tables = ~15% of available data
- **Available but hidden:** 9 major data categories with 40+ metrics

### Potential Additions:
- **Add 4-6 more sections** for comprehensive view
- **15+ new visualizations** from existing backend data
- **Zero backend changes needed** - all data already collected!

### Richest Quick Wins:
1. **Waste Detection Breakdown** - Users want to see specific unused tables
2. **Query Caching Analysis** - Huge savings opportunity 
3. **Storage Growth Trend** - Visual timeline of storage costs
4. **Budget Health** - Critical for cost control

**Decision:** Which category should we add first?
