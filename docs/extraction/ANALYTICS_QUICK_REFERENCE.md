# Enterprise Analytics - Quick Reference Guide

## 🎯 THE GAP: What's Missing

| Current State | Enterprise Need |
|--------------|-----------------|
| ❌ Individual user tracking only | ✅ Organization-level aggregation |
| ❌ No API key attribution | ✅ Track which key was used |
| ❌ Can't answer: "What did Org X spend?" | ✅ Multi-org cost analysis |
| ❌ Admin sees member count only | ✅ Admin sees cost, usage, trends |
| ❌ No drill-down: Org → User → Conv | ✅ Complete hierarchy navigation |

---

## 🔑 CRITICAL SCHEMA CHANGES

```sql
-- ADD TO: duckcode.conversation_analytics
organization_id  UUID  -- Links to enterprise.organizations
api_key_id       UUID  -- Which key was used
team_id          UUID  -- Team attribution (optional)
department       TEXT  -- Cost center (optional)

-- NEW TABLE: Organization aggregations
organization_daily_stats (
  organization_id, usage_date,
  total_cost, profit, users, api_key_usage
)

-- NEW TABLE: API key tracking
api_key_daily_stats (
  api_key_id, usage_date,
  total_cost, tokens, conversations, unique_users
)
```

---

## 📊 DASHBOARD HIERARCHY

```
LEVEL 1: PLATFORM (Super Admin)
  └─ View: All organizations combined
     Drill-down: Click org → Level 2

LEVEL 2: ORGANIZATION (Org Admin)
  └─ View: All users in org, all API keys
     Drill-down: Click user → Level 4
     Drill-down: Click API key → Key analytics

LEVEL 3: TEAM/DEPARTMENT (Team Lead)
  └─ View: Team members only
     Drill-down: Click user → Level 4

LEVEL 4: USER (Individual/Manager)
  └─ View: Personal usage + org comparison
     Drill-down: Click conversation → Level 5

LEVEL 5: CONVERSATION (Detailed)
  └─ View: Message-level breakdown
```

---

## 🚀 IMPLEMENTATION PRIORITY

### Week 1: Foundation
- [ ] Add `organization_id`, `api_key_id` to analytics tables
- [ ] Create `organization_daily_stats` table
- [ ] Create `api_key_daily_stats` table
- [ ] Update triggers for auto-aggregation
- [ ] Add indexes for performance

### Week 2: IDE Integration
- [ ] Pass `organization_id` from auth session
- [ ] Track which API key is used per call
- [ ] Update analytics payload schema
- [ ] Test IDE → Backend flow

### Week 3: Backend APIs
- [ ] Organization analytics endpoints (6 endpoints)
- [ ] User analytics with org comparison
- [ ] Drill-down query builder
- [ ] Export to CSV/JSON

### Week 4: Admin Panel
- [ ] Organization dashboard (summary + charts)
- [ ] API key analytics tab
- [ ] User leaderboard with sorting
- [ ] Cost trend visualization

### Week 5: Individual Dashboard
- [ ] Personal analytics with org comparison
- [ ] Budget tracking (if set by admin)
- [ ] Conversation history with costs
- [ ] Efficiency recommendations

---

## 📈 KEY METRICS TO DISPLAY

### Organization Admin Sees:
1. **Total Cost** (this month)
2. **Profit Margin** (actual vs charged)
3. **Active Users** count
4. **Top Spenders** (user leaderboard)
5. **API Key Breakdown** (cost per key)
6. **Model Distribution** (which models used most)
7. **Daily Trend** (30-day cost chart)
8. **Department Costs** (if using teams)

### Individual User Sees:
1. **My Cost** vs org average
2. **My Usage** (conversations, tokens)
3. **My Trends** (am I using more or less?)
4. **Model Preferences** (what I use most)
5. **Recent Conversations** with costs
6. **Budget Status** (if admin set limits)

---

## 🔧 TECHNICAL DECISIONS

### Data Storage Strategy
- **Real-time**: Store in `conversation_analytics` immediately
- **Aggregation**: Triggers update daily/weekly/monthly tables
- **Performance**: Use materialized views for dashboard queries
- **Retention**: Keep conversation details for 90 days, aggregates forever

### API Key Tracking
```typescript
// IDE must send with every analytics event:
{
  user_id: "uuid",
  organization_id: "uuid",        // NEW
  api_key_id: "uuid",             // NEW
  api_key_provider: "openai",     // NEW
  conversation_id: "conv-123",
  model_name: "gpt-4",
  total_cost: 0.05,
  actual_api_cost: 0.025          // Profit = 0.025
}
```

### Query Performance
- Index on: `organization_id`, `api_key_id`, `started_at`
- Materialized view: `organization_dashboard_summary` (refresh every 5 min)
- Pagination: Max 100 results per page
- Caching: Redis for frequently accessed org stats

---

## 🎨 UI/UX MOCKUP REFERENCES

### Admin Panel - Organization Dashboard
```
┌─────────────────────────────────────┐
│ 📊 Acme Corp - This Month           │
├─────────────────────────────────────┤
│ $2,500    15 Users   125K Tokens   │
│ Total     Active     Processed      │
│                                      │
│ 📈 Cost Trend ──────────────        │
│ [Line chart showing daily costs]    │
│                                      │
│ 🔑 Top API Keys                     │
│ • OpenAI Prod    $1,500 (60%)      │
│ • OpenAI Dev       $800 (32%)      │
│ • Claude Prod      $200 (8%)       │
│                                      │
│ 👥 Top Users                        │
│ 1. alice@   $450  [Details ▶]      │
│ 2. bob@     $380  [Details ▶]      │
│ 3. charlie@ $320  [Details ▶]      │
└─────────────────────────────────────┘
```

### Individual Dashboard
```
┌─────────────────────────────────────┐
│ 👤 My Usage - alice@acme.com        │
├─────────────────────────────────────┤
│ My Cost: $450    Org Avg: $167     │
│ [You're 169% above average]         │
│                                      │
│ 📊 My Model Usage                   │
│ • claude-3.5-sonnet   65%          │
│ • gpt-4               25%          │
│ • gpt-3.5-turbo       10%          │
│                                      │
│ 💬 Recent Conversations             │
│ • Debug API Issue    $12  2h ago   │
│ • Code Review        $8   5h ago   │
│ • Architecture Q&A   $15  1d ago   │
└─────────────────────────────────────┘
```

---

## ⚠️ CRITICAL MIGRATION STEPS

1. **Backfill Organization IDs**
   ```sql
   -- After adding organization_id column
   UPDATE duckcode.conversation_analytics ca
   SET organization_id = (
     SELECT uor.organization_id 
     FROM enterprise.user_organization_roles uor
     WHERE uor.user_id::text = ca.user_id
     LIMIT 1
   )
   WHERE organization_id IS NULL;
   ```

2. **Handle Missing API Key IDs**
   - New conversations: IDE provides api_key_id
   - Old conversations: NULL is OK (historical data)
   - Analytics: Filter out NULL or show as "Unknown Key"

3. **Zero Downtime Migration**
   - Add columns with NULL allowed
   - Deploy IDE changes
   - Backfill data
   - Make columns NOT NULL after 2 weeks

---

## 📊 SAMPLE QUERIES

### Organization Total Cost (This Month)
```sql
SELECT 
  o.display_name,
  SUM(ca.total_cost) as total_cost,
  SUM(ca.profit_amount) as profit,
  COUNT(DISTINCT ca.user_id) as active_users,
  COUNT(*) as conversations
FROM duckcode.conversation_analytics ca
JOIN enterprise.organizations o ON o.id = ca.organization_id
WHERE ca.started_at >= DATE_TRUNC('month', NOW())
GROUP BY o.id, o.display_name
ORDER BY total_cost DESC;
```

### User Usage vs Org Average
```sql
WITH org_avg AS (
  SELECT 
    organization_id,
    AVG(total_cost) as avg_cost_per_user
  FROM duckcode.conversation_analytics
  WHERE started_at >= NOW() - INTERVAL '30 days'
  GROUP BY organization_id
)
SELECT 
  ca.user_id,
  SUM(ca.total_cost) as my_cost,
  oa.avg_cost_per_user as org_avg,
  (SUM(ca.total_cost) / oa.avg_cost_per_user * 100) as percentage_of_avg
FROM duckcode.conversation_analytics ca
JOIN org_avg oa ON oa.organization_id = ca.organization_id
WHERE ca.user_id = :user_id
  AND ca.started_at >= NOW() - INTERVAL '30 days'
GROUP BY ca.user_id, oa.avg_cost_per_user;
```

### API Key Efficiency
```sql
SELECT 
  oak.key_name,
  oak.provider,
  COUNT(*) as conversations,
  SUM(ca.total_tokens_in + ca.total_tokens_out) as total_tokens,
  SUM(ca.total_cost) as total_cost,
  COUNT(DISTINCT ca.user_id) as unique_users,
  SUM(ca.total_cost) / NULLIF(COUNT(*), 0) as avg_cost_per_conversation
FROM duckcode.conversation_analytics ca
JOIN enterprise.organization_api_keys oak ON oak.id = ca.api_key_id
WHERE ca.organization_id = :org_id
  AND ca.started_at >= NOW() - INTERVAL '30 days'
GROUP BY oak.id, oak.key_name, oak.provider
ORDER BY total_cost DESC;
```

---

## ✅ VALIDATION CHECKLIST

Before deploying to production:

- [ ] All new columns added with proper indexes
- [ ] Triggers working correctly (test with sample data)
- [ ] IDE sending organization_id and api_key_id
- [ ] Backend APIs return correct aggregations
- [ ] Admin can view organization-wide analytics
- [ ] Users can view personal analytics
- [ ] Drill-down navigation works (org → user → conversation)
- [ ] Export to CSV functional
- [ ] Performance: Dashboard loads < 2 seconds
- [ ] RLS policies updated for organization access
- [ ] Documentation updated

---

**Next Step**: Review this plan, confirm approach, then proceed with Phase 1 implementation!
