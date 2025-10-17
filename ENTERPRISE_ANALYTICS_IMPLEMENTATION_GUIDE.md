# Enterprise Analytics - Implementation Guide

## ✅ PHASE 1 COMPLETE: Database Foundation

### Migrations Applied

1. **20251017000002_add_enterprise_analytics_foundation.sql**
   - ✅ Added `organization_id`, `api_key_id`, `team_id`, `department` to `conversation_analytics`
   - ✅ Created `organization_daily_stats` table
   - ✅ Created `api_key_daily_stats` table
   - ✅ Added triggers for automatic aggregation
   - ✅ Created indexes for performance
   - ✅ Set up RLS policies
   - ✅ Created helper view: `organization_analytics_summary`

2. **20251017000003_backfill_organization_ids.sql**
   - ✅ Backfills `organization_id` for existing analytics
   - ✅ Adds `organization_id` to daily/weekly/monthly stats
   - ✅ Creates indexes for org-level queries

### Database Schema Changes

```sql
-- ADDED TO: duckcode.conversation_analytics
organization_id UUID  -- Links to enterprise.organizations
api_key_id UUID       -- Links to enterprise.organization_api_keys
team_id UUID          -- Team attribution (optional)
department TEXT       -- Cost center (optional)
cost_center TEXT      -- Alternative cost center field

-- NEW TABLE: duckcode.organization_daily_stats
```

### How It Works (Zero Downtime)

1. **Existing Flow (Still Works)**:
   ```
   IDE → Backend → conversation_analytics (user_id only)
   └─ Triggers → daily/weekly/monthly stats (existing)
   ```

2. **New Flow (When IDE Enhanced)**:
   ```
   IDE → Backend → conversation_analytics (user_id + organization_id + api_key_id)
   └─ Triggers → daily/weekly/monthly stats (existing)
   └─ Triggers → organization_daily_stats (NEW)
   └─ Triggers → api_key_daily_stats (NEW)
   ```

---

## 🚀 PHASE 2: IDE Integration

### Changes Needed in `duck-code`

#### 1. Update Analytics Payload Schema

**File**: `duck-code/webview-ui/src/services/chatAnalyticsService.ts`

```typescript
// Current payload
interface ChatAnalyticsPayload {
  user_id: string
  conversation_id: string
  model_name: string
  total_cost: number
  // ...
}

// ENHANCE TO:
interface ChatAnalyticsPayload {
  user_id: string
  organization_id: string          // NEW: From auth session
  api_key_id: string | null        // NEW: Which key was used
  api_key_provider: string | null  // NEW: openai, anthropic, etc.
  team_id: string | null           // NEW: Optional team
  conversation_id: string
  model_name: string
  total_cost: number
  // ...
}
```

#### 2. Track API Key Usage

**File**: `duck-code/src/services/cloud/DuckCodeCloudService.ts`

```typescript
// Add method to get current organization context
public async getOrganizationContext(): Promise<{
  organizationId: string
  apiKeyMappings: Record<string, string> // provider -> api_key_id
}> {
  const session = await this.context.globalState.get("duckcode.session")
  const authState = await this.context.globalState.get("duckcode.authState")
  
  return {
    organizationId: authState.organization?.id,
    apiKeyMappings: authState.organization?.apiKeyMappings || {}
  }
}
```

#### 3. Update webviewMessageHandler

**File**: `duck-code/src/core/webview/webviewMessageHandler.ts`

```typescript
case "chatAnalytics": {
  try {
    const cloudService = DuckCodeCloudService.getInstance()
    const analyticsData = { ...message.data }
    
    // ADD: Get organization context
    const orgContext = await cloudService.getOrganizationContext()
    
    // Enhance payload with org data
    if (analyticsData.apiMetrics) {
      analyticsData.apiMetrics.organization_id = orgContext.organizationId
      
      // Map provider to api_key_id
      const provider = analyticsData.model?.provider || 'unknown'
      analyticsData.apiMetrics.api_key_id = orgContext.apiKeyMappings[provider] || null
      analyticsData.apiMetrics.api_key_provider = provider
      
      // Calculate actual API cost
      const chargedCost = analyticsData.apiMetrics.totalCost || 0
      analyticsData.apiMetrics.actualApiCost = chargedCost / 2.0
    }
    
    await cloudService.sendChatAnalytics(
      message.action || "updateConversation", 
      analyticsData
    )
  } catch (error) {
    console.error("Failed to handle chat analytics:", error)
  }
  break
}
```

#### 4. Store API Key Mappings After Sync

**File**: `duck-code/webview-ui/src/services/authService.ts`

```typescript
// When user syncs API keys from organization
async syncOrganizationApiKeys(): Promise<void> {
  const response = await fetch('/api/organizations/:orgId/api-keys/active')
  const { api_keys } = await response.json()
  
  // Store mappings: provider -> api_key_id
  const apiKeyMappings = {}
  for (const [provider, keyData] of Object.entries(api_keys)) {
    apiKeyMappings[provider] = keyData.key_id  // Store the key ID, not the actual key
  }
  
  // Save to auth state
  await vscode.postMessage({
    type: 'storeApiKeyMappings',
    mappings: apiKeyMappings
  })
}
```

---

## 📡 PHASE 3: Backend API Endpoints

### New Routes File

**Create**: `backend/src/api/routes/organization-analytics.routes.ts`

```typescript
import express from 'express';
import {
  getOrganizationSummary,
  getOrganizationTrends,
  getOrganizationUserBreakdown,
  getOrganizationApiKeyBreakdown,
  getOrganizationModelBreakdown,
  getUserAnalyticsWithComparison,
  exportOrganizationAnalytics
} from '../controllers/organization-analytics.controller';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Organization-level analytics (admin only)
router.get('/:organizationId/summary', getOrganizationSummary);
router.get('/:organizationId/trends', getOrganizationTrends);
router.get('/:organizationId/users', getOrganizationUserBreakdown);
router.get('/:organizationId/api-keys', getOrganizationApiKeyBreakdown);
router.get('/:organizationId/models', getOrganizationModelBreakdown);
router.get('/:organizationId/export', exportOrganizationAnalytics);

// User analytics with org comparison
router.get('/users/:userId/summary', getUserAnalyticsWithComparison);

export default router;
```

### Controller Implementation

**Create**: `backend/src/api/controllers/organization-analytics.controller.ts`

```typescript
import { Request, Response } from 'express';
import { supabaseDuckCode, supabaseAdmin } from '../../config/supabase';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

// Get organization summary (last 30 days)
export async function getOrganizationSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.id;
    
    // Verify user is admin of this organization
    const { data: userRole, error: roleError } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role_id, organization_roles!inner(name)')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .single();
    
    if (roleError || !userRole || (userRole.organization_roles as any).name !== 'Admin') {
      return res.status(403).json({ error: 'Only org admins can view organization analytics' });
    }
    
    // Get 30-day summary from organization_daily_stats
    const { data: stats, error } = await supabaseDuckCode
      .from('organization_daily_stats')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('usage_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('usage_date', { ascending: false });
    
    if (error) throw error;
    
    // Aggregate stats
    const summary = {
      total_cost: stats.reduce((sum, s) => sum + parseFloat(s.total_cost), 0),
      total_profit: stats.reduce((sum, s) => sum + parseFloat(s.profit_amount), 0),
      total_conversations: stats.reduce((sum, s) => sum + s.total_conversations, 0),
      unique_users: new Set(stats.flatMap(s => Object.keys(s.model_usage || {}))).size,
      avg_cost_per_day: stats.length > 0 ? stats.reduce((sum, s) => sum + parseFloat(s.total_cost), 0) / stats.length : 0,
      model_breakdown: combineModelUsage(stats),
      api_key_breakdown: combineApiKeyUsage(stats),
      daily_stats: stats
    };
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching organization summary:', error);
    res.status(500).json({ error: 'Failed to fetch organization summary' });
  }
}

// Helper: Combine model usage across days
function combineModelUsage(stats: any[]) {
  const combined: Record<string, any> = {};
  
  stats.forEach(day => {
    const modelUsage = day.model_usage || {};
    Object.entries(modelUsage).forEach(([model, data]: [string, any]) => {
      if (!combined[model]) {
        combined[model] = { conversations: 0, tokens: 0, cost: 0 };
      }
      combined[model].conversations += data.conversations || 0;
      combined[model].tokens += (data.tokens_in || 0) + (data.tokens_out || 0);
      combined[model].cost += parseFloat(data.cost || 0);
    });
  });
  
  return combined;
}

// Helper: Combine API key usage
function combineApiKeyUsage(stats: any[]) {
  const combined: Record<string, any> = {};
  
  stats.forEach(day => {
    const apiKeyUsage = day.api_key_usage || {};
    Object.entries(apiKeyUsage).forEach(([keyId, data]: [string, any]) => {
      if (!combined[keyId]) {
        combined[keyId] = { conversations: 0, tokens: 0, cost: 0 };
      }
      combined[keyId].conversations += data.conversations || 0;
      combined[keyId].tokens += data.tokens || 0;
      combined[keyId].cost += parseFloat(data.cost || 0);
    });
  });
  
  return combined;
}

// Get organization trends (daily breakdown)
export async function getOrganizationTrends(req: AuthenticatedRequest, res: Response) {
  // Similar to getOrganizationSummary but returns daily breakdown
  // Implementation...
}

// Get user breakdown
export async function getOrganizationUserBreakdown(req: AuthenticatedRequest, res: Response) {
  try {
    const { organizationId } = req.params;
    const { dateFrom, dateTo } = req.query;
    
    // Query conversation_analytics grouped by user_id
    const { data, error } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('user_id, total_cost, total_tokens_in, total_tokens_out, conversation_id')
      .eq('organization_id', organizationId)
      .gte('started_at', dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('started_at', dateTo || new Date().toISOString());
    
    if (error) throw error;
    
    // Group by user
    const userBreakdown = data.reduce((acc, conv) => {
      if (!acc[conv.user_id]) {
        acc[conv.user_id] = {
          user_id: conv.user_id,
          total_cost: 0,
          total_tokens: 0,
          conversation_count: 0
        };
      }
      acc[conv.user_id].total_cost += parseFloat(conv.total_cost);
      acc[conv.user_id].total_tokens += conv.total_tokens_in + conv.total_tokens_out;
      acc[conv.user_id].conversation_count += 1;
      return acc;
    }, {});
    
    res.json(Object.values(userBreakdown).sort((a: any, b: any) => b.total_cost - a.total_cost));
  } catch (error) {
    console.error('Error fetching user breakdown:', error);
    res.status(500).json({ error: 'Failed to fetch user breakdown' });
  }
}

// Get API key breakdown
export async function getOrganizationApiKeyBreakdown(req: AuthenticatedRequest, res: Response) {
  // Query api_key_daily_stats
  // Implementation...
}

// Get model breakdown
export async function getOrganizationModelBreakdown(req: AuthenticatedRequest, res: Response) {
  // Query organization_daily_stats and aggregate model_usage
  // Implementation...
}

// Export to CSV
export async function exportOrganizationAnalytics(req: AuthenticatedRequest, res: Response) {
  // Generate CSV from organization_daily_stats
  // Implementation...
}

// Get user analytics with org comparison
export async function getUserAnalyticsWithComparison(req: AuthenticatedRequest, res: Response) {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id;
    
    // Only allow users to view their own analytics or admins
    if (userId !== currentUserId) {
      // Check if requesting user is admin
      const { data: userRole } = await supabaseAdmin
        .schema('enterprise')
        .from('user_organization_roles')
        .select('organization_roles!inner(name)')
        .eq('user_id', currentUserId)
        .single();
      
      if (!(userRole?.organization_roles as any)?.name === 'Admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }
    
    // Get user's analytics
    const { data: userStats } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
    // Get org average
    const userOrgId = userStats?.[0]?.organization_id;
    const { data: orgStats } = await supabaseDuckCode
      .from('organization_daily_stats')
      .select('*')
      .eq('organization_id', userOrgId)
      .gte('usage_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    const totalOrgUsers = orgStats?.[0]?.total_users || 1;
    const avgOrgCost = orgStats.reduce((sum, s) => sum + parseFloat(s.total_cost), 0) / totalOrgUsers;
    
    const userTotalCost = userStats.reduce((sum, s) => sum + parseFloat(s.total_cost), 0);
    
    res.json({
      user: {
        total_cost: userTotalCost,
        conversation_count: userStats.length,
        // ...
      },
      org_average: {
        cost_per_user: avgOrgCost,
        // ...
      },
      comparison: {
        cost_vs_avg_percentage: (userTotalCost / avgOrgCost) * 100,
        // ...
      }
    });
  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ error: 'Failed to fetch user analytics' });
  }
}
```

### Register Routes in App

**File**: `backend/src/app.ts`

```typescript
import organizationAnalyticsRoutes from './api/routes/organization-analytics.routes';

// ... existing routes

app.use('/api/organizations', organizationAnalyticsRoutes);
```

---

## 🎨 PHASE 4: Admin Panel UI

### New Component: Organization Analytics Dashboard

**Create**: `frontend/src/pages/admin/Analytics.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  DollarSign,
  Users,
  TrendingUp,
  Key,
  Brain
} from 'lucide-react';
import { Line, Pie, Bar } from 'recharts';

export const Analytics: React.FC = () => {
  const { selectedOrg } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAnalytics();
  }, [selectedOrg]);
  
  const fetchAnalytics = async () => {
    const response = await fetch(`/api/organizations/${selectedOrg.id}/summary`);
    const data = await response.json();
    setSummary(data);
    setLoading(false);
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="p-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Cost"
          value={`$${summary.total_cost.toFixed(2)}`}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Profit"
          value={`$${summary.total_profit.toFixed(2)}`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Active Users"
          value={summary.unique_users}
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Conversations"
          value={summary.total_conversations}
          icon={Brain}
          color="orange"
        />
      </div>
      
      {/* Cost Trend Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">30-Day Cost Trend</h2>
        <Line data={summary.daily_stats} />
      </div>
      
      {/* API Key Breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">API Key Usage</h2>
          <Bar data={transformApiKeyData(summary.api_key_breakdown)} />
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Model Distribution</h2>
          <Pie data={transformModelData(summary.model_breakdown)} />
        </div>
      </div>
    </div>
  );
};
```

---

## ✅ TESTING CHECKLIST

### Database Tests
- [ ] Verify triggers fire on new conversations
- [ ] Check organization_daily_stats updates correctly
- [ ] Check api_key_daily_stats updates correctly
- [ ] Verify backfill works for existing data
- [ ] Test RLS policies (admins can see org data)

### IDE Integration Tests
- [ ] Analytics payload includes organization_id
- [ ] Analytics payload includes api_key_id
- [ ] API key mappings stored after sync
- [ ] Organization context retrieved correctly

### Backend API Tests
- [ ] GET /api/organizations/:id/summary returns correct data
- [ ] Only admins can access org analytics
- [ ] User analytics includes org comparison
- [ ] Export to CSV works

### Frontend Tests
- [ ] Admin panel shows organization summary
- [ ] Charts render correctly
- [ ] User leaderboard displays
- [ ] Drill-down navigation works

---

## 🚀 DEPLOYMENT STEPS

1. **Database** (Already Done ✅)
   - Migrations applied
   - Triggers active
   - Indexes created

2. **IDE** (Next)
   - Update analytics payload
   - Store API key mappings
   - Test with sample conversation

3. **Backend** (Next)
   - Create controller file
   - Create routes file
   - Register routes in app.ts
   - Test endpoints with Postman

4. **Frontend** (Final)
   - Create Analytics component
   - Add to admin panel routing
   - Connect to backend APIs
   - Test UI

---

## 📝 NEXT STEPS

**Ready to proceed with Phase 2 (IDE Integration)?**

Let me know and I'll:
1. Create the exact code changes for IDE
2. Test the analytics flow end-to-end
3. Verify organization/API key tracking works

Then move to Phase 3 (Backend APIs) and Phase 4 (Frontend UI)!
