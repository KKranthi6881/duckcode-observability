# ⚡ Quick Start Guide - Phase 1 Deployment

## 🚀 5-Minute Setup

### **Step 1: Run Database Migration** (30 seconds)
```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability

# Apply Phase 1 schema
psql $DATABASE_URL -f supabase/migrations/20251104120000_snowflake_cost_phase1.sql

# Or via Supabase CLI
supabase db push
```

### **Step 2: Restart Backend** (30 seconds)
```bash
cd backend
npm run dev
# Backend starts on http://localhost:3001
```

### **Step 3: Add Frontend Route** (1 minute)

**File**: `frontend/src/App.tsx`

```typescript
// Add import
import SnowflakeCostIntelligence from './pages/dashboard/SnowflakeCostIntelligence';

// Add route
<Route path="/dashboard/snowflake-cost" element={<SnowflakeCostIntelligence />} />
```

### **Step 4: Add Navigation Link** (1 minute)

**File**: `frontend/src/components/Sidebar.tsx` (or wherever your nav is)

```typescript
import { DollarSign } from 'lucide-react';

<Link to="/dashboard/snowflake-cost">
  <DollarSign className="w-5 h-5" />
  <span>Cost Intelligence</span>
</Link>
```

### **Step 5: Test It!** (2 minutes)

1. **Connect Snowflake** (if not already)
   - Go to Connectors page
   - Click "Add Connector"
   - Select "Snowflake"
   - Enter credentials
   - Click "Test Connection"

2. **Extract Metadata** (triggers cost extraction automatically)
   - Click "Extract Metadata" button
   - Wait ~2 minutes
   - Cost data is now cached in database!

3. **View Dashboard**
   - Navigate to http://localhost:3000/dashboard/snowflake-cost
   - See your beautiful cost dashboard! 🎉

---

## ✅ Verification Checklist

After setup, verify these work:

- [ ] Dashboard loads without errors
- [ ] 6 summary cards show data
- [ ] Organization selector works
- [ ] Connector selector works
- [ ] Time period selector changes data
- [ ] Refresh button works
- [ ] Top tables table shows data
- [ ] Waste summary shows opportunities
- [ ] Numbers format correctly (currency, bytes)
- [ ] Responsive on mobile/tablet

---

## 🐛 Troubleshooting

### **Problem: "No data showing"**
**Solution**: Run metadata extraction first to cache cost data
```bash
# In dashboard, click your Snowflake connector
# Click "Extract Metadata" button
# Wait 2 minutes
# Refresh cost dashboard
```

### **Problem: "Failed to fetch cost overview"**
**Solution**: Check backend logs for errors
```bash
# Check backend is running
curl http://localhost:3001/health

# Check authentication
# Make sure you're logged in
```

### **Problem: "Database migration failed"**
**Solution**: Check if tables already exist
```sql
-- Check if tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'enterprise' 
AND tablename LIKE 'snowflake_%';

-- If they exist, migration already ran
```

### **Problem: "TypeScript errors"**
**Solution**: Install dependencies
```bash
cd frontend
npm install lucide-react
npm install
```

---

## 📊 Sample Data (For Testing Without Snowflake)

If you want to test the UI without real Snowflake data:

```sql
-- Insert sample cost metrics
INSERT INTO enterprise.snowflake_cost_metrics 
  (organization_id, connector_id, metric_date, period_type, compute_credits, storage_credits, total_credits)
VALUES 
  ('your-org-id', 'your-connector-id', CURRENT_DATE, 'daily', 150.5, 45.2, 195.7),
  ('your-org-id', 'your-connector-id', CURRENT_DATE - INTERVAL '1 day', 'daily', 142.3, 44.8, 187.1);

-- Insert sample storage usage
INSERT INTO enterprise.snowflake_storage_usage
  (organization_id, connector_id, database_name, schema_name, table_name, storage_bytes, row_count, snapshot_date)
VALUES
  ('your-org-id', 'your-connector-id', 'PROD_DB', 'PUBLIC', 'ORDERS', 2147483648, 1204512, CURRENT_DATE),
  ('your-org-id', 'your-connector-id', 'PROD_DB', 'PUBLIC', 'CUSTOMERS', 1073741824, 845230, CURRENT_DATE);

-- Insert sample waste opportunity
INSERT INTO enterprise.snowflake_waste_opportunities
  (organization_id, connector_id, opportunity_type, severity, resource_type, resource_name, 
   current_monthly_cost, potential_monthly_savings, title, description, recommendation)
VALUES
  ('your-org-id', 'your-connector-id', 'unused_table', 'high', 'TABLE', 'OLD_LOGS_2023',
   120.50, 120.50, 'Unused table: OLD_LOGS_2023', 'Table has not been accessed in 145 days',
   'Archive or delete this table to save $120.50/month');
```

---

## 🎯 What Should Happen

### **After Metadata Extraction:**
Backend logs should show:
```
[SNOWFLAKE] Extracting cost and storage data...
[SNOWFLAKE] Extracting cost metrics...
[COST_EXTRACTOR] Stored cost metrics: 4150.23 credits
[SNOWFLAKE] Extracting storage usage...
[COST_EXTRACTOR] Stored 147 storage records
[SNOWFLAKE] Extracting warehouse metrics...
[COST_EXTRACTOR] Stored 5 warehouse metrics
[SNOWFLAKE] Detecting waste opportunities...
[COST_EXTRACTOR] Stored 12 waste opportunities
[SNOWFLAKE] Cost extraction complete
```

### **Dashboard Should Show:**
- ✅ Total Cost card with your actual Snowflake spending
- ✅ Compute & Storage breakdown
- ✅ Potential Savings (if waste detected)
- ✅ Query statistics
- ✅ Top 10 tables by cost
- ✅ Waste opportunities summary
- ✅ All data loads in <100ms (instant!)

---

## 🎉 Success!

If you see the dashboard with data, **congratulations!** You've successfully deployed Phase 1!

**Next Steps:**
1. Show it to your team
2. Get user feedback
3. Start tracking Snowflake costs
4. Find and fix waste
5. Save money! 💰

---

## 📞 Need Help?

Check these docs:
- `PHASE1_SHIPPED.md` - Complete overview
- `SNOWFLAKE_PHASE1_IMPLEMENTATION.md` - Technical details
- `PHASE1_FRONTEND_COMPLETE.md` - UI documentation
- `PHASE1_REFACTOR_COMPLETE.md` - Architecture explanation
- `PHASE1_TESTING_GUIDE.md` - Testing instructions

---

**Time to celebrate! 🎉 You built a production-ready Snowflake Cost Intelligence Platform!**
