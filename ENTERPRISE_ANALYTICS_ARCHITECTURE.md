# Enterprise Analytics Architecture & Implementation Plan

## 🔍 CURRENT STATE ANALYSIS

### Existing Infrastructure ✅
```
IDE → DuckCodeCloudService → Backend API → Database
                                            ↓
                            duckcode.conversation_analytics
                            duckcode.daily_conversation_stats
                            duckcode.weekly_conversation_stats
                            duckcode.monthly_conversation_stats
```

### Current Analytics Schema:
- **User-level tracking**: `user_id` (TEXT) - individual users
- **Conversation details**: model, provider, tokens, cost
- **Profit tracking**: `actual_api_cost`, `charged_cost`, `profit_amount`
- **Time aggregations**: daily, weekly, monthly
- **Model breakdown**: JSONB with per-model usage

### What's MISSING for Enterprise 🚨

1. **No Organization Attribution**
   - Analytics NOT linked to `enterprise.organizations`
   - Can't aggregate: "Show all usage for Org X"
   - Can't answer: "Which org spent the most?"

2. **No API Key Tracking**
   - Don't know WHICH API key was used
   - Can't track: "Cost per API key"
   - Can't analyze: "Production vs Dev key usage"

3. **No Multi-Level Drill-Down**
   - Can't go: Organization → Team → User → Conversation
   - No department/team-level visibility
   - Missing cost center attribution

4. **Admin Panel Gaps**
   - Shows members/teams/API keys count
   - ZERO usage/cost analytics for organization
   - No cross-user aggregation

5. **Individual Dashboard Limitations**
   - Shows only personal usage
   - No comparison with org average
   - No team benchmarking

---

## 🏗️ ENTERPRISE ARCHITECTURE DESIGN

### Data Model Enhancement

```sql
-- Core principle: Link every conversation to organization + API key

conversation_analytics:
  user_id          TEXT          ← Individual user
  organization_id  UUID          ← NEW: Links to enterprise.organizations
  api_key_id       UUID          ← NEW: Which key was used
  team_id          UUID          ← NEW: Optional team attribution
  department       TEXT          ← NEW: Cost center
  conversation_id  VARCHAR(255)
  model_name       VARCHAR(100)
  total_cost       DECIMAL
  actual_api_cost  DECIMAL
  profit_amount    DECIMAL
  ...
```

### Multi-Level Aggregation Hierarchy

```
Level 1: PLATFORM (Super Admin)
   ↓ All organizations combined
   
Level 2: ORGANIZATION (Org Admin)
   ↓ org_id aggregation
   
Level 3: TEAM/DEPARTMENT (Team Lead)
   ↓ team_id / department aggregation
   
Level 4: USER (Individual)
   ↓ user_id aggregation
   
Level 5: CONVERSATION (Detailed)
   ↓ conversation_id details
```

### API Key Attribution Flow

```
IDE Session Start:
1. User authenticates → Gets organization_id
2. IDE syncs org API keys → Caches locally
3. User makes API call → IDE uses specific key
4. IDE sends analytics → Includes api_key_id
5. Backend records → Links usage to key

Result: 
- "OpenAI Prod Key: $500 this month"
- "Dev Key: $50 this month"
- "User X used Prod Key 80% of time"
```

---

## 📊 DASHBOARD ARCHITECTURE

### Admin Panel (Organization View)

```
┌─────────────────────────────────────────────────────────┐
│ Organization: Acme Corp - Usage Dashboard               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 Summary Cards                                        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ $2,500 │ │ 15     │ │ 125K   │ │ $1,250 │          │
│  │ Total  │ │ Users  │ │ Tokens │ │ Profit │          │
│  └────────┘ └────────┘ └────────┘ └────────┘          │
│                                                          │
│  📈 Cost Trend (30 days)                                │
│  [Line chart: Daily cost over time]                     │
│                                                          │
│  🔑 Usage by API Key                                    │
│  ┌──────────────────────────────────────────┐          │
│  │ OpenAI Prod    $1,500  60%  [====    ]  │          │
│  │ OpenAI Dev       $800  32%  [===     ]  │          │
│  │ Claude Prod      $200   8%  [=       ]  │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
│  👥 Top Users (This Month)                              │
│  ┌──────────────────────────────────────────┐          │
│  │ 1. alice@acme    $450  [View Details ▶]  │          │
│  │ 2. bob@acme      $380  [View Details ▶]  │          │
│  │ 3. charlie@acme  $320  [View Details ▶]  │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
│  🤖 Usage by Model                                      │
│  [Pie chart: claude-3.5-sonnet, gpt-4, etc.]           │
│                                                          │
│  💰 Cost Analysis Table                                 │
│  [Sortable table: User, Conversations, Tokens, Cost]    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Individual Dashboard (User View)

```
┌─────────────────────────────────────────────────────────┐
│ My Usage - alice@acme.com                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 My Stats vs Org Average                             │
│  ┌────────────────────────────────┐                     │
│  │ My Cost: $450 │ Org Avg: $167  │                     │
│  │ My Tokens: 45K │ Org Avg: 23K   │                     │
│  │ Conversations: 28 │ Org Avg: 12 │                     │
│  └────────────────────────────────┘                     │
│                                                          │
│  📈 My Daily Usage                                       │
│  [Line chart: My usage over time]                       │
│                                                          │
│  🤖 My Model Breakdown                                  │
│  [Pie chart: Which models I use most]                   │
│                                                          │
│  💬 Recent Conversations                                │
│  [List: Topic, Model, Cost, Date, Duration]            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 IMPLEMENTATION PHASES

### Phase 1: Database Schema Enhancement (Week 1)

**1.1 Add Organization Tracking**
```sql
ALTER TABLE duckcode.conversation_analytics
ADD COLUMN organization_id UUID REFERENCES enterprise.organizations(id),
ADD COLUMN api_key_id UUID REFERENCES enterprise.organization_api_keys(id),
ADD COLUMN team_id UUID,
ADD COLUMN department TEXT;

CREATE INDEX idx_conv_org_id ON conversation_analytics(organization_id);
CREATE INDEX idx_conv_api_key ON conversation_analytics(api_key_id);
CREATE INDEX idx_conv_team ON conversation_analytics(team_id);
```

**1.2 Create Organization Aggregation Tables**
```sql
CREATE TABLE duckcode.organization_daily_stats (
  organization_id UUID,
  usage_date DATE,
  total_cost DECIMAL,
  actual_api_cost DECIMAL,
  profit_amount DECIMAL,
  total_conversations INTEGER,
  total_users INTEGER,
  model_usage JSONB,
  api_key_usage JSONB, -- NEW: Per-key breakdown
  UNIQUE(organization_id, usage_date)
);

CREATE TABLE duckcode.api_key_daily_stats (
  api_key_id UUID,
  organization_id UUID,
  usage_date DATE,
  total_cost DECIMAL,
  total_tokens BIGINT,
  conversation_count INTEGER,
  unique_users INTEGER,
  model_usage JSONB,
  UNIQUE(api_key_id, usage_date)
);
```

**1.3 Automated Aggregation Triggers**
```sql
-- Trigger on conversation_analytics INSERT/UPDATE
-- Automatically updates:
--   - organization_daily_stats
--   - api_key_daily_stats
--   - user daily stats (existing)
```

### Phase 2: IDE Integration Enhancement (Week 2)

**2.1 Pass Organization & API Key Context**
```typescript
// duck-code: When sending analytics
interface ChatAnalyticsPayload {
  user_id: string
  organization_id: string     // NEW: From auth session
  api_key_id: string          // NEW: Which key was actually used
  api_key_provider: string    // NEW: openai, anthropic, etc.
  conversation_id: string
  model_name: string
  // ... rest
}
```

**2.2 API Key Usage Tracking**
```typescript
// IDE tracks WHICH key was used for each API call
class ApiKeyUsageTracker {
  trackApiCall(provider: string, keyId: string, cost: number) {
    // Record which key was used
    // Send to backend with analytics
  }
}
```

### Phase 3: Backend API Development (Week 3)

**3.1 Organization Analytics Endpoints**
```
GET /api/organizations/:orgId/analytics/summary
GET /api/organizations/:orgId/analytics/trends
GET /api/organizations/:orgId/analytics/users
GET /api/organizations/:orgId/analytics/api-keys
GET /api/organizations/:orgId/analytics/models
GET /api/organizations/:orgId/analytics/export
```

**3.2 User Analytics Endpoints**
```
GET /api/users/:userId/analytics/summary
GET /api/users/:userId/analytics/trends
GET /api/users/:userId/analytics/conversations
GET /api/users/:userId/analytics/compare-org
```

**3.3 Drill-Down Endpoint**
```
GET /api/analytics/drill-down
Query params:
  - organization_id
  - user_id (optional)
  - team_id (optional)
  - api_key_id (optional)
  - date_from
  - date_to
  - group_by (user|model|api_key|date)
```

### Phase 4: Admin Panel UI (Week 4)

**4.1 Organization Analytics Dashboard**
- Summary cards (cost, users, tokens, profit)
- Cost trend chart (30-day line chart)
- API key breakdown (bar chart + table)
- User leaderboard (sortable table)
- Model distribution (pie chart)
- Export to CSV

**4.2 API Key Analytics Tab**
- Per-key usage metrics
- Cost attribution
- User breakdown per key
- Trend analysis
- Cost predictions

**4.3 User Management Enhancement**
- Add usage column to members table
- Click user → View detailed usage
- Set cost limits per user
- Usage alerts

### Phase 5: Individual Dashboard Enhancement (Week 5)

**5.1 Personal Analytics**
- Comparison with org average
- Personal trends
- Model preferences
- Conversation history with cost

**5.2 Budget Tracking**
- Personal budget (if set by admin)
- Usage alerts
- Efficiency metrics
- Recommendations

---

## 🎯 KEY FEATURES TO IMPLEMENT

### 1. Multi-Dimensional Filtering
```
Filter by:
  - Date range (last 7/30/90 days, custom)
  - Organization
  - User
  - Team/Department
  - API Key
  - Provider (OpenAI, Anthropic, Azure)
  - Model
  - Status (active, completed)
```

### 2. Cost Attribution
```
Track:
  - Which API key was used
  - Actual cost (what we paid)
  - Charged cost (what user paid)
  - Profit margin per key
  - Cost per department/team
```

### 3. Drill-Down Capabilities
```
Organization View → Click user → User View
User View → Click conversation → Conversation Details
API Key View → Click user → User's usage of that key
Model View → Click model → All conversations with that model
```

### 4. Export & Reporting
```
Export formats:
  - CSV (for Excel analysis)
  - JSON (for programmatic access)
  - PDF (for executive reports)

Reports:
  - Monthly summary
  - Cost allocation
  - User activity
  - API key efficiency
```

---

## 📝 IMPLEMENTATION STEPS SUMMARY

1. **Database Migration** (2 days)
   - Add organization_id, api_key_id columns
   - Create aggregation tables
   - Add indexes
   - Create triggers

2. **IDE Enhancement** (3 days)
   - Pass org context with analytics
   - Track API key usage
   - Update analytics payload schema

3. **Backend API** (5 days)
   - Organization analytics endpoints
   - User analytics endpoints
   - Drill-down queries
   - Export functionality

4. **Admin Panel UI** (5 days)
   - Organization dashboard
   - API key analytics
   - User leaderboard
   - Charts and visualizations

5. **Individual Dashboard** (3 days)
   - Personal analytics
   - Org comparison
   - Budget tracking

6. **Testing & Optimization** (2 days)
   - Query performance
   - Data accuracy
   - UI/UX refinement

**Total: ~3 weeks for MVP**

---

## ✅ SUCCESS CRITERIA

- ✅ Admin can view organization-wide usage
- ✅ Admin can see cost per user
- ✅ Admin can analyze usage per API key
- ✅ Admin can drill down: Org → User → Conversation
- ✅ User can see personal usage vs org average
- ✅ All data properly attributed to organization
- ✅ Real-time updates (within 5 minutes)
- ✅ Export functionality works
- ✅ Dashboard loads in < 2 seconds

This architecture provides enterprise-grade analytics with complete cost visibility and multi-level drill-down capabilities!
