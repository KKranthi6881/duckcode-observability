/**
 * Snowflake Cost Controller - Database-First Approach
 * Reads from cached data stored during metadata extraction
 */

import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { SnowflakeCostService } from '../../services/connectors/SnowflakeCostService';

const svc = new SnowflakeCostService();

function parseRoleName(roleRow: any): string | null {
  const role = (roleRow?.organization_roles as any) || null;
  if (!role) return null;
  if (Array.isArray(role)) return role[0]?.name || null;
  return role.name || null;
}

async function ensureAdmin(userId: string, organizationId: string) {
  const { data, error } = await supabaseAdmin
    .schema('enterprise')
    .from('user_organization_roles')
    .select('role_id, organization_roles!inner(name)')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();
  if (error || !data) return false;
  const roleName = parseRoleName(data);
  return roleName === 'Admin';
}

async function getConnectorOrg(connectorId: string) {
  const { data, error } = await supabaseAdmin
    .schema('enterprise')
    .from('connectors')
    .select('id, organization_id')
    .eq('id', connectorId)
    .single();
  if (error || !data) throw new Error('Connector not found');
  return data.organization_id as string;
}

/**
 * Get cost overview from database (cached from last extraction)
 */
export async function getCostOverviewFromDB(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { days } = req.query as { days?: string };
    const period = days ? parseInt(days, 10) : 30;

    // Read from database
    const { data: metrics, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_cost_metrics')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('period_type', 'daily')
      .order('metric_date', { ascending: false })
      .limit(period);

    if (error) {
      console.error('[COST_DB] Error fetching cost metrics:', error);
      return res.status(500).json({ error: 'Failed to fetch cost overview' });
    }

    if (!metrics || metrics.length === 0) {
      // No cached data, fall back to real-time query
      console.log('[COST_DB] No cached data, falling back to real-time query');
      const overview = await svc.getCostOverview(connectorId, period);
      return res.json({ success: true, data: overview, cached: false });
    }

    // Calculate aggregates from cached data
    const totalCompute = metrics.reduce((sum, m) => sum + Number(m.compute_credits || 0), 0);
    const totalStorage = metrics.reduce((sum, m) => sum + Number(m.storage_credits || 0), 0);
    const totalCredits = totalCompute + totalStorage;
    const totalCost = totalCredits * 3;

    // Get query stats from database
    const { data: queryMetrics } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_query_metrics')
      .select('execution_status')
      .eq('connector_id', connectorId);

    const totalQueries = queryMetrics?.length || 0;
    const failedQueries = queryMetrics?.filter(q => q.execution_status === 'FAIL').length || 0;

    const overview = {
      period_days: period,
      compute_credits: totalCompute,
      storage_credits: totalStorage,
      total_credits: totalCredits,
      total_cost: totalCost,
      total_queries: totalQueries,
      failed_queries: failedQueries,
      failure_rate: totalQueries > 0 ? (failedQueries / totalQueries * 100).toFixed(2) : 0,
      extracted_at: metrics[0]?.extracted_at,
      cached: true
    };

    return res.json({ success: true, data: overview });
  } catch (e: any) {
    console.error('[COST_DB] Error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch cost overview' });
  }
}

/**
 * Get storage usage from database
 */
export async function getStorageUsageFromDB(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    // Get latest snapshot
    const { data: latestSnapshot } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_storage_usage')
      .select('snapshot_date')
      .eq('connector_id', connectorId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestSnapshot) {
      // No cached data, fall back to real-time
      console.log('[COST_DB] No cached storage data, falling back to real-time query');
      const storage = await svc.getStorageUsage(connectorId);
      return res.json({ success: true, data: storage, cached: false });
    }

    // Get storage data from latest snapshot
    const { data: storage, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_storage_usage')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('snapshot_date', latestSnapshot.snapshot_date)
      .order('storage_bytes', { ascending: false });

    if (error) {
      console.error('[COST_DB] Error fetching storage:', error);
      return res.status(500).json({ error: 'Failed to fetch storage usage' });
    }

    return res.json({ 
      success: true, 
      data: storage,
      snapshot_date: latestSnapshot.snapshot_date,
      cached: true 
    });
  } catch (e: any) {
    console.error('[COST_DB] Error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch storage usage' });
  }
}

/**
 * Get waste opportunities from database
 */
export async function getWasteDetectionFromDB(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    // Get waste opportunities from database
    const { data: opportunities, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_waste_opportunities')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('status', 'open')
      .order('potential_monthly_savings', { ascending: false });

    if (error) {
      console.error('[COST_DB] Error fetching waste:', error);
      return res.status(500).json({ error: 'Failed to fetch waste detection' });
    }

    if (!opportunities || opportunities.length === 0) {
      // No cached data, fall back to real-time
      console.log('[COST_DB] No cached waste data, falling back to real-time query');
      const [unusedTables, idleWarehouses, warehouseUtilization] = await Promise.all([
        svc.detectUnusedTables(connectorId, 90),
        svc.detectIdleWarehouses(connectorId, 30),
        svc.analyzeWarehouseUtilization(connectorId, 7),
      ]);

      const tableSavings = unusedTables.reduce((sum, t) => {
        const bytes = Number(t.STORAGE_BYTES || 0);
        return sum + (bytes / 1099511627776) * 23;
      }, 0);

      const warehouseSavings = idleWarehouses.reduce((sum, w) => {
        return sum + (Number(w.MONTHLY_CREDITS || 0) * 3);
      }, 0);

      const underutilizedSavings = warehouseUtilization
        .filter(w => w.STATUS === 'UNDERUTILIZED')
        .reduce((sum, w) => sum + (Number(w.TOTAL_CREDITS || 0) * 0.3 * 3), 0);

      return res.json({
        success: true,
        data: {
          unused_tables: unusedTables,
          idle_warehouses: idleWarehouses,
          warehouse_utilization: warehouseUtilization,
          summary: {
            total_potential_savings: tableSavings + warehouseSavings + underutilizedSavings,
            unused_table_savings: tableSavings,
            idle_warehouse_savings: warehouseSavings,
            underutilized_warehouse_savings: underutilizedSavings,
            total_opportunities: unusedTables.length + idleWarehouses.length + warehouseUtilization.filter(w => w.STATUS !== 'OPTIMAL').length
          }
        },
        cached: false
      });
    }

    // Group opportunities by type
    const unusedTables = opportunities.filter(o => o.opportunity_type === 'unused_table');
    const idleWarehouses = opportunities.filter(o => o.opportunity_type === 'idle_warehouse');
    const underutilizedWarehouses = opportunities.filter(o => o.opportunity_type === 'underutilized_warehouse');

    // Calculate summary
    const totalSavings = opportunities.reduce((sum, o) => sum + Number(o.potential_monthly_savings || 0), 0);
    const tableSavings = unusedTables.reduce((sum, o) => sum + Number(o.potential_monthly_savings || 0), 0);
    const idleSavings = idleWarehouses.reduce((sum, o) => sum + Number(o.potential_monthly_savings || 0), 0);
    const underutilizedSavings = underutilizedWarehouses.reduce((sum, o) => sum + Number(o.potential_monthly_savings || 0), 0);

    return res.json({
      success: true,
      data: {
        unused_tables: unusedTables,
        idle_warehouses: idleWarehouses,
        underutilized_warehouses: underutilizedWarehouses,
        summary: {
          total_potential_savings: totalSavings,
          unused_table_savings: tableSavings,
          idle_warehouse_savings: idleSavings,
          underutilized_warehouse_savings: underutilizedSavings,
          total_opportunities: opportunities.length
        }
      },
      cached: true,
      detected_at: opportunities[0]?.detected_at
    });
  } catch (e: any) {
    console.error('[COST_DB] Error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch waste detection' });
  }
}
