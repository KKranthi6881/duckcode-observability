import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { SnowflakeCostService } from '../../services/connectors/SnowflakeCostService';

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

const svc = new SnowflakeCostService();

export async function getDailyCredits(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { start, end, warehouse, tagName, tagValue } = req.query as { start?: string; end?: string; warehouse?: string; tagName?: string; tagValue?: string };
    const rows = await svc.getOverviewDailyCredits(connectorId, start, end, { warehouse, tagName, tagValue });
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch daily credits' });
  }
}

export async function getWarehouseCosts(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { start, end, tagName, tagValue } = req.query as { start?: string; end?: string; tagName?: string; tagValue?: string };
    const rows = await svc.getWarehouseCosts(connectorId, start, end, { tagName, tagValue });
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch warehouse costs' });
  }
}

export async function getCostByTags(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { start, end } = req.query as { start?: string; end?: string };
    const rows = await svc.getCostByTags(connectorId, start, end);
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch tag costs' });
  }
}

export async function getTopQueries(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { start, end, warehouse, user, includeText } = req.query as { start?: string; end?: string; warehouse?: string; user?: string; includeText?: string };
    const rows = await svc.getTopQueriesByBytes(connectorId, start, end, { warehouse, user });
    const sendText = includeText === '1' || includeText === 'true';
    const sanitized = sendText ? rows : rows.map(r => {
      const { QUERY_TEXT, ...rest } = r as any;
      return rest;
    });
    return res.json({ success: true, data: sanitized });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch top queries' });
  }
}

export async function getFilters(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { start, end } = req.query as { start?: string; end?: string };
    const [warehouses, tags, users] = await Promise.all([
      svc.listWarehouses(connectorId, start, end),
      svc.listTags(connectorId, start, end),
      svc.listUsers(connectorId, start, end),
    ]);
    return res.json({ success: true, data: { warehouses, tags, users } });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch filters' });
  }
}

// ============================================
// PHASE 1: Enhanced Cost Intelligence
// ============================================

export async function getCostOverview(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { days } = req.query as { days?: string };
    const period = days ? parseInt(days, 10) : 30;
    const overview = await svc.getCostOverview(connectorId, period);
    return res.json({ success: true, data: overview });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch cost overview' });
  }
}

export async function getStorageUsage(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const rows = await svc.getStorageUsage(connectorId);
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch storage usage' });
  }
}

export async function getStorageCosts(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { start, end } = req.query as { start?: string; end?: string };
    const rows = await svc.getStorageCosts(connectorId, start, end);
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch storage costs' });
  }
}

export async function getWasteDetection(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    // Run all waste detection queries in parallel
    const [unusedTables, idleWarehouses, warehouseUtilization] = await Promise.all([
      svc.detectUnusedTables(connectorId, 90),
      svc.detectIdleWarehouses(connectorId, 30),
      svc.analyzeWarehouseUtilization(connectorId, 7),
    ]);

    // Calculate total potential savings
    const tableSavings = unusedTables.reduce((sum, t) => {
      const bytes = Number(t.STORAGE_BYTES || 0);
      const monthlyCost = (bytes / 1099511627776) * 23; // $23 per TB/month
      return sum + monthlyCost;
    }, 0);

    const warehouseSavings = idleWarehouses.reduce((sum, w) => {
      const credits = Number(w.MONTHLY_CREDITS || 0);
      return sum + (credits * 3); // $3 per credit
    }, 0);

    const underutilizedSavings = warehouseUtilization
      .filter(w => w.STATUS === 'UNDERUTILIZED')
      .reduce((sum, w) => {
        const credits = Number(w.TOTAL_CREDITS || 0);
        return sum + (credits * 0.3 * 3); // 30% potential savings
      }, 0);

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
      }
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to detect waste' });
  }
}

export async function getDataTransferCosts(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const orgId = await getConnectorOrg(connectorId);
    const isAdmin = await ensureAdmin(userId, orgId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { days } = req.query as { days?: string };
    const period = days ? parseInt(days, 10) : 30;
    const rows = await svc.getDataTransferCosts(connectorId, period);
    return res.json({ success: true, data: rows });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to fetch data transfer costs' });
  }
}
