# Phase 1 Testing Guide

## 🧪 Quick Test Instructions

### 1. Run Database Migration

```bash
cd /Users/Kranthi_1/duck-main/duckcode-observability

# Apply the Phase 1 migration
psql $DATABASE_URL -f supabase/migrations/20251104120000_snowflake_cost_phase1.sql

# Or via Supabase CLI
supabase db push
```

### 2. Start Backend Server

```bash
cd backend
npm run dev
# Backend should start on http://localhost:3001
```

### 3. Test API Endpoints

#### Get Cost Overview
```bash
curl -X GET "http://localhost:3001/api/connectors/{CONNECTOR_ID}/cost/overview?days=30" \
  -H "Authorization: Bearer {YOUR_TOKEN}"

# Expected response:
{
  "success": true,
  "data": {
    "period_days": 30,
    "compute_credits": 4150.23,
    "storage_credits": 1033.67,
    "total_credits": 5183.90,
    "total_cost": 15551.70,
    "total_queries": 145230,
    "failed_queries": 1204,
    "failure_rate": "0.83"
  }
}
```

#### Get Storage Usage
```bash
curl -X GET "http://localhost:3001/api/connectors/{CONNECTOR_ID}/cost/storage-usage" \
  -H "Authorization: Bearer {YOUR_TOKEN}"

# Expected response:
{
  "success": true,
  "data": [
    {
      "DATABASE_NAME": "PROD_DB",
      "SCHEMA_NAME": "PUBLIC",
      "TABLE_NAME": "ORDERS",
      "STORAGE_BYTES": 52428800,
      "ROW_COUNT": 1204512,
      "RETENTION_DAYS": 7,
      "LAST_ALTERED": "2024-11-01T12:00:00Z"
    }
  ]
}
```

#### Get Waste Detection
```bash
curl -X GET "http://localhost:3001/api/connectors/{CONNECTOR_ID}/cost/waste-detection" \
  -H "Authorization: Bearer {YOUR_TOKEN}"

# Expected response:
{
  "success": true,
  "data": {
    "unused_tables": [...],
    "idle_warehouses": [...],
    "warehouse_utilization": [...],
    "summary": {
      "total_potential_savings": 11243.50,
      "unused_table_savings": 5120.00,
      "idle_warehouse_savings": 3840.00,
      "underutilized_warehouse_savings": 2283.50,
      "total_opportunities": 18
    }
  }
}
```

### 4. Frontend Integration Test

```typescript
// In your React component
import snowflakeCostPhase1Service from '../../services/snowflakeCostPhase1Service';

// Test cost overview
const overview = await snowflakeCostPhase1Service.getCostOverview(connectorId, 30);
console.log('Cost Overview:', overview);

// Test waste detection
const waste = await snowflakeCostPhase1Service.getWasteDetection(connectorId);
console.log('Total Savings:', waste.summary.total_potential_savings);
```

## ✅ Success Criteria

Phase 1 is working correctly if:

1. ✅ All API endpoints return 200 status
2. ✅ Cost overview shows compute + storage breakdown
3. ✅ Storage usage returns table-level data
4. ✅ Waste detection identifies:
   - Unused tables (>90 days no access)
   - Idle warehouses (>30 days no queries)
   - Underutilized warehouses (<30% utilization)
5. ✅ Savings calculations are accurate
6. ✅ Frontend service successfully fetches data

## 🐛 Common Issues

### Issue: "Not authenticated"
**Solution**: Ensure you're passing valid Bearer token in Authorization header

### Issue: "Connector not found"
**Solution**: Use valid connector ID from your organization

### Issue: "Failed to fetch from Snowflake"
**Solution**: Check Snowflake connector credentials and ACCOUNT_USAGE access

### Issue: Empty results
**Solution**: Snowflake ACCOUNT_USAGE views have 45min-3hour latency. Wait or use existing test data.

## 📊 Test with Sample Data

If you don't have real Snowflake data yet, you can insert test data:

```sql
-- Insert test cost metrics
INSERT INTO enterprise.snowflake_cost_metrics 
  (organization_id, connector_id, metric_date, compute_credits, storage_credits, total_credits)
VALUES 
  ('your-org-id', 'your-connector-id', CURRENT_DATE, 150.5, 45.2, 195.7);

-- Insert test storage usage
INSERT INTO enterprise.snowflake_storage_usage
  (organization_id, connector_id, database_name, schema_name, table_name, storage_bytes, snapshot_date)
VALUES
  ('your-org-id', 'your-connector-id', 'PROD_DB', 'PUBLIC', 'ORDERS', 52428800, CURRENT_DATE);
```

## 🎯 Next: Build Frontend Dashboard

Once backend tests pass, proceed to build the frontend components:
1. Cost Overview Dashboard
2. Storage Breakdown Table
3. Waste Detection Dashboard

See `SNOWFLAKE_PHASE1_IMPLEMENTATION.md` for component specifications.
