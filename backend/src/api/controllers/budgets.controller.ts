import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import { SlackNotifier } from '../../services/notifications/SlackNotifier';
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

async function getConnector(connectorId: string) {
  const { data, error } = await supabaseAdmin
    .schema('enterprise')
    .from('connectors')
    .select('*')
    .eq('id', connectorId)
    .single();
  if (error || !data) throw new Error('Connector not found');
  return data;
}

const notifier = new SlackNotifier();
const costSvc = new SnowflakeCostService();

export async function listBudgets(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const connector = await getConnector(connectorId);
    const isAdmin = await ensureAdmin(userId, connector.organization_id);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_budgets')
      .select('*')
      .eq('connector_id', connectorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json({ success: true, budgets: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to list budgets' });
  }
}

export async function createOrUpdateBudget(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const connector = await getConnector(connectorId);
    const isAdmin = await ensureAdmin(userId, connector.organization_id);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const body = req.body || {};
    const payload = {
      organization_id: connector.organization_id,
      connector_id: connectorId,
      level: body.level,
      warehouse_name: body.warehouse_name || null,
      tag_name: body.tag_name || null,
      tag_value: body.tag_value || null,
      user_name: body.user_name || null,
      threshold_credits: body.threshold_credits,
      period: body.period || '30d',
      start_time: body.start_time || null,
      end_time: body.end_time || null,
      notify_slack_webhook: body.notify_slack_webhook || null,
      notify_email: body.notify_email || null,
      status: body.status || 'active',
      created_by: userId,
    };

    const upsert = req.query?.upsert === '1' || req.query?.upsert === 'true';

    let result;
    if (upsert && body.id) {
      const { data, error } = await supabaseAdmin
        .schema('enterprise')
        .from('snowflake_budgets')
        .update(payload)
        .eq('id', body.id)
        .select('*')
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .schema('enterprise')
        .from('snowflake_budgets')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      result = data;
    }

    return res.json({ success: true, budget: result });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to save budget' });
  }
}

export async function deleteBudget(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const budgetId = req.params.budgetId;
    const connector = await getConnector(connectorId);
    const isAdmin = await ensureAdmin(userId, connector.organization_id);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_budgets')
      .delete()
      .eq('id', budgetId);

    if (error) throw error;
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to delete budget' });
  }
}

export async function listBudgetAlerts(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const connector = await getConnector(connectorId);
    const isAdmin = await ensureAdmin(userId, connector.organization_id);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { data, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_budget_alerts')
      .select('*')
      .eq('connector_id', connectorId)
      .order('fired_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    return res.json({ success: true, alerts: data || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to fetch alerts' });
  }
}

export async function checkBudget(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const budgetId = req.params.budgetId;
    const connector = await getConnector(connectorId);
    const isAdmin = await ensureAdmin(userId, connector.organization_id);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { data: budget, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_budgets')
      .select('*')
      .eq('id', budgetId)
      .eq('connector_id', connectorId)
      .single();

    if (error || !budget) return res.status(404).json({ error: 'Budget not found' });

    // Determine start/end from budget period
    let start: string | undefined = undefined;
    let end: string | undefined = undefined;
    if (budget.period === '7d') {
      const d = new Date(); d.setDate(d.getDate() - 7); start = d.toISOString().slice(0, 19);
    } else if (budget.period === '30d') {
      const d = new Date(); d.setDate(d.getDate() - 30); start = d.toISOString().slice(0, 19);
    } else if (budget.period === '90d') {
      const d = new Date(); d.setDate(d.getDate() - 90); start = d.toISOString().slice(0, 19);
    } else if (budget.period === 'custom') {
      start = budget.start_time || undefined;
      end = budget.end_time || undefined;
    }

    const level = budget.level as 'overall' | 'warehouse' | 'tag' | 'user';
    const current = await costSvc.getCreditsSummary(
      connectorId,
      start,
      end,
      {
        level,
        warehouse: budget.warehouse_name || undefined,
        tagName: budget.tag_name || undefined,
        tagValue: budget.tag_value || undefined,
        user: budget.user_name || undefined,
      }
    );

    let fired = false;
    if (Number(current) >= Number(budget.threshold_credits)) {
      fired = true;
      const message = `Budget exceeded: level=${level}, threshold=${budget.threshold_credits}, current=${current}`;

      const sentTargets: Record<string, boolean> = {};
      if (budget.notify_slack_webhook) {
        await notifier.send(budget.notify_slack_webhook, message);
        sentTargets.slack = true;
      }
      // Email notifications can be integrated here (SES/SMTP). For now, we log only.

      await supabaseAdmin
        .schema('enterprise')
        .from('snowflake_budget_alerts')
        .insert({
          organization_id: connector.organization_id,
          budget_id: budget.id,
          connector_id: connectorId,
          current_credits: current,
          message,
          sent_targets: sentTargets,
        });
    }

    return res.json({ success: true, fired, current });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to check budget' });
  }
}
