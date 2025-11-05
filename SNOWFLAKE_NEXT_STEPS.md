# Snowflake Intelligence Platform - Next Steps & Testing Guide

## 🎯 Immediate Next Steps

### 1. Backend Integration (Required)

#### Add Recommendations Route to Main Router
**File:** `backend/src/api/routes/index.ts`

```typescript
import snowflakeRecommendationsRoutes from './snowflake-recommendations.routes';

// Add to router setup
app.use('/api/connectors', snowflakeRecommendationsRoutes);
```

#### Create ROI Tracking Service
**File:** `backend/src/services/recommendations/ROITrackingService.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

class ROITrackingService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getROISummary(connectorId: string) {
    // Get all recommendations
    const { data: recommendations } = await this.supabase
      .schema('enterprise')
      .from('snowflake_recommendations')
      .select('status, estimated_monthly_savings_usd')
      .eq('connector_id', connectorId);

    const total = recommendations?.length || 0;
    const applied = recommendations?.filter(r => r.status === 'applied').length || 0;
    
    const projectedMonthly = recommendations
      ?.filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + (r.estimated_monthly_savings_usd || 0), 0) || 0;
    
    const actualMonthly = recommendations
      ?.filter(r => r.status === 'applied')
      .reduce((sum, r) => sum + (r.estimated_monthly_savings_usd || 0), 0) || 0;

    const roi = actualMonthly > 0 ? (actualMonthly / 500) * 100 : 0; // Assuming $500 platform cost
    const payback = actualMonthly > 0 ? 500 / actualMonthly : 0;

    return {
      total_recommendations: total,
      applied_recommendations: applied,
      projected_annual_savings: projectedMonthly * 12,
      actual_annual_savings: actualMonthly * 12,
      roi_percentage: roi,
      payback_months: payback,
      total_invested: 500
    };
  }

  async getROIBreakdown(connectorId: string) {
    const { data } = await this.supabase
      .schema('enterprise')
      .from('snowflake_roi_tracking')
      .select(`
        id,
        recommendation_id,
        projected_savings_usd,
        actual_savings_usd,
        variance_percent,
        baseline_period_start,
        baseline_period_end,
        measurement_period_start,
        measurement_period_end,
        snowflake_recommendations!inner(title)
      `)
      .eq('connector_id', connectorId);

    return (data || []).map(row => ({
      id: row.id,
      recommendation_id: row.recommendation_id,
      recommendation_title: row.snowflake_recommendations?.title || 'Unknown',
      projected_savings_usd: row.projected_savings_usd || 0,
      actual_savings_usd: row.actual_savings_usd || 0,
      variance_percent: row.variance_percent || 0,
      baseline_period_start: row.baseline_period_start,
      baseline_period_end: row.baseline_period_end,
      measurement_period_start: row.measurement_period_start,
      measurement_period_end: row.measurement_period_end
    }));
  }
}

export default new ROITrackingService();
```

#### Integrate Phase 2 Extraction into Main Flow
**File:** `backend/src/services/connectors/SnowflakeConnector.ts`

Add after Phase 1 extraction completes:

```typescript
import snowflakePhase2Extractor from './SnowflakePhase2Extractor';
import snowflakeRecommendationEngine from '../recommendations/SnowflakeRecommendationEngine';

// After Phase 1 extraction
await snowflakePhase2Extractor.extractAll(connectorId, connection);

// Generate recommendations automatically
await snowflakeRecommendationEngine.generateRecommendations(
  connectorId,
  organizationId
);
```

---

## 🧪 Testing Guide

### Phase 1: Cost Visibility Testing

**Test 1: Basic Dashboard Load**
```bash
# Navigate to dashboard
Open: http://localhost:3000/dashboard/snowflake

# Expected: 
- ✅ Dashboard loads within 2 seconds
- ✅ Cost overview cards display with data
- ✅ No console errors
```

**Test 2: Connector Selection**
```bash
# Test connector dropdown
1. Select different organization
2. Select different connector
3. Verify data updates

# Expected:
- ✅ Data refreshes for selected connector
- ✅ All tabs show correct connector data
```

**Test 3: Time Period Filtering**
```bash
# Test time period selector
1. Switch between 7/30/90 days
2. Verify cost calculations update

# Expected:
- ✅ Costs recalculate correctly
- ✅ Query counts adjust by period
```

### Phase 2: Recommendations Testing

**Test 4: Generate Recommendations**
```bash
# Click "Generate New" button
POST /api/connectors/{id}/recommendations/generate

# Expected:
- ✅ Recommendations appear within 30 seconds
- ✅ Multiple recommendation types shown
- ✅ Estimated savings calculated
- ✅ Confidence scores displayed
```

**Test 5: View SQL Commands**
```bash
# Click "View SQL" on any recommendation
1. Modal opens with SQL commands
2. SQL is properly formatted
3. Implementation notes shown

# Expected:
- ✅ SQL commands are valid
- ✅ Comments explain each step
- ✅ Can copy SQL to clipboard
```

**Test 6: Apply Recommendation**
```bash
# Click "Apply" on a recommendation
1. Confirmation dialog appears
2. SQL executes on Snowflake
3. Status updates to "Applied"
4. Success notification shown

# Expected:
- ✅ Confirmation required before execution
- ✅ SQL executes successfully
- ✅ Status persists in database
- ✅ ROI tracking initiated
```

**Test 7: Dismiss Recommendation**
```bash
# Click "Dismiss" on a recommendation
1. Reason prompt appears
2. Status updates to "Dismissed"
3. Audit log created

# Expected:
- ✅ Optional reason captured
- ✅ Status persists
- ✅ Action logged for audit
```

### Phase 3: ROI Tracking Testing

**Test 8: ROI Summary**
```bash
# Navigate to ROI Tracker tab
GET /api/connectors/{id}/roi

# Expected:
- ✅ Summary cards show:
  - Applied recommendations count
  - Projected annual savings
  - Actual annual savings
  - ROI percentage
  - Payback months
```

**Test 9: ROI Breakdown**
```bash
# View detailed breakdown table
1. Each applied recommendation listed
2. Variance calculated correctly
3. Measurement status shown

# Expected:
- ✅ Projected vs actual comparison
- ✅ Variance percentage accurate
- ✅ Measurement timeline displayed
```

### Phase 4: Query Performance Testing

**Test 10: Expensive Queries Analysis**
```bash
# Navigate to Query Performance tab
1. Top 50 queries displayed
2. Sort by cost/time/frequency
3. Click query to view details

# Expected:
- ✅ Queries sorted correctly
- ✅ Full SQL shown in modal
- ✅ Optimization suggestions provided
```

---

## 🐛 Common Issues & Fixes

### Issue 1: No Recommendations Generated
**Symptom:** "No recommendations found" message

**Fix:**
```bash
# Check Phase 2 data extraction
SELECT COUNT(*) FROM enterprise.snowflake_warehouse_utilization WHERE connector_id = 'YOUR_ID';
SELECT COUNT(*) FROM enterprise.snowflake_query_patterns WHERE connector_id = 'YOUR_ID';

# If counts are 0, run Phase 2 extraction manually
```

### Issue 2: ROI Data Not Loading
**Symptom:** "No ROI data available yet"

**Fix:**
```bash
# Ensure recommendations have been applied
SELECT * FROM enterprise.snowflake_recommendations 
WHERE connector_id = 'YOUR_ID' AND status = 'applied';

# Check ROI tracking table
SELECT * FROM enterprise.snowflake_roi_tracking WHERE connector_id = 'YOUR_ID';
```

### Issue 3: Query Performance Empty
**Symptom:** No queries shown in performance tab

**Fix:**
```sql
-- Verify query patterns exist
SELECT COUNT(*) FROM enterprise.snowflake_query_patterns 
WHERE connector_id = 'YOUR_ID';

-- If empty, re-run Phase 2 extraction
```

---

## 📊 Performance Benchmarks

### Expected Performance
- Dashboard Load: <2 seconds
- Recommendation Generation: <30 seconds
- ROI Calculation: <1 second
- Query Analysis: <5 seconds for 100+ queries

### Database Query Optimization
```sql
-- Add indexes if queries are slow
CREATE INDEX CONCURRENTLY idx_recommendations_connector_status 
  ON enterprise.snowflake_recommendations(connector_id, status);

CREATE INDEX CONCURRENTLY idx_query_patterns_connector_count 
  ON enterprise.snowflake_query_patterns(connector_id, execution_count DESC);
```

---

## 🔄 Data Refresh Schedule

### Recommended Refresh Intervals

**Phase 1 Data (Cost Visibility):**
- **Frequency:** Every 6 hours
- **Data:** Warehouse metrics, storage usage, query history
- **Trigger:** Cron job or manual refresh button

**Phase 2 Data (Advanced Metrics):**
- **Frequency:** Daily (overnight)
- **Data:** Utilization patterns, query patterns, clustering history
- **Trigger:** Scheduled job

**Recommendations:**
- **Frequency:** Weekly
- **Trigger:** Auto-generate after Phase 2 extraction
- **Manual:** On-demand via "Generate New" button

---

## 🎯 Success Criteria

### Phase 1 Success Metrics
- [ ] Dashboard loads all cost data in <2s
- [ ] Waste detection identifies $5K+ opportunities
- [ ] All 6 tabs render without errors
- [ ] Dark theme applied consistently

### Phase 2 Success Metrics
- [ ] Generates 5+ recommendations
- [ ] Recommendations show >80% confidence
- [ ] One-click apply works successfully
- [ ] ROI tracking initiates automatically

### User Acceptance
- [ ] Users can identify top cost drivers in <5 minutes
- [ ] Users can apply optimization in <30 seconds
- [ ] Users see projected savings before applying
- [ ] Users can track actual savings over time

---

## 📝 Deployment Checklist

### Backend
- [ ] Phase 2 migration applied
- [ ] ROI service created and imported
- [ ] Recommendations routes added to main router
- [ ] Phase 2 extraction integrated into connector flow
- [ ] Environment variables configured
- [ ] Database indexes created

### Frontend
- [ ] All components built successfully
- [ ] Services configured with correct API URLs
- [ ] Dark theme styles applied
- [ ] Routing configured for all tabs
- [ ] Error handling tested

### Testing
- [ ] All 10 test scenarios passed
- [ ] Performance benchmarks met
- [ ] No console errors
- [ ] Mobile responsive verified
- [ ] Cross-browser tested

---

## 🚀 Launch Strategy

### Week 1: Internal Testing
- Deploy to staging environment
- Run full test suite
- Gather internal feedback
- Fix critical bugs

### Week 2: Beta Testing
- Invite 3-5 customers to beta
- Monitor usage analytics
- Collect user feedback
- Iterate on UI/UX

### Week 3: Production Launch
- Deploy to production
- Announce to existing customers
- Create demo videos
- Write knowledge base articles

### Week 4+: Optimization
- Analyze user behavior
- Optimize slow queries
- Add requested features
- Plan Phase 3 enhancements

---

## 📚 Additional Resources

### Documentation
- [Snowflake Account Usage Schema](https://docs.snowflake.com/en/sql-reference/account-usage.html)
- [Database Migration Guide](./supabase/migrations/README.md)
- [API Documentation](./backend/docs/API.md)

### Support
- Technical issues: engineering@yourcompany.com
- Feature requests: product@yourcompany.com
- Documentation: docs.yourcompany.com/snowflake

---

**Status:** Ready for deployment and testing! 🚀
