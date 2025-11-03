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
