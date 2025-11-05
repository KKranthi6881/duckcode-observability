import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import budgetTrackingService from '../../services/BudgetTrackingService';

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

export async function listBudgets(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const connector = await getConnector(connectorId);
    const isAdmin = await ensureAdmin(userId, connector.organization_id);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const budgets = await budgetTrackingService.listBudgets(
      connector.organization_id,
      connectorId
    );

    return res.json({ success: true, budgets });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to list budgets' });
  }
}

export async function createBudget(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const connector = await getConnector(connectorId);
    const isAdmin = await ensureAdmin(userId, connector.organization_id);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const body = req.body || {};
    const budgetData = {
      organization_id: connector.organization_id,
      connector_id: body.budget_type === 'organization' ? undefined : connectorId,
      budget_type: body.budget_type,
      warehouse_name: body.warehouse_name,
      budget_name: body.budget_name,
      budget_amount: body.budget_amount,
      budget_period: body.budget_period,
      alert_threshold_1: body.alert_threshold_1,
      alert_threshold_2: body.alert_threshold_2,
      alert_threshold_3: body.alert_threshold_3,
      email_alerts: body.email_alerts,
      slack_webhook_url: body.slack_webhook_url,
      auto_suspend_at_limit: body.auto_suspend_at_limit,
      created_by: userId,
    };

    const budget = await budgetTrackingService.createBudget(budgetData);
    return res.json({ success: true, budget });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to create budget' });
  }
}

export async function updateBudget(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const budgetId = req.params.budgetId;
    const connector = await getConnector(connectorId);
    const isAdmin = await ensureAdmin(userId, connector.organization_id);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const budget = await budgetTrackingService.updateBudget(budgetId, req.body);
    return res.json({ success: true, budget });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to update budget' });
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

export async function getBudgetCurrentSpend(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const budgetId = req.params.budgetId;
    const spend = await budgetTrackingService.getCurrentSpend(budgetId);

    return res.json({ success: true, data: spend });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to get current spend' });
  }
}

export async function getBudgetAlerts(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const budgetId = req.params.budgetId;
    const alerts = await budgetTrackingService.getAlertHistory(budgetId);

    return res.json({ success: true, alerts });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to fetch alerts' });
  }
}

export async function checkBudgetAlerts(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const budgetId = req.params.budgetId;
    const alerts = await budgetTrackingService.checkBudgetAlerts(budgetId);

    return res.json({ success: true, alerts });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to check budget alerts' });
  }
}

export async function getOrganizationBudgetSummary(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const organizationId = req.params.organizationId;
    const isAdmin = await ensureAdmin(userId, organizationId);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const summary = await budgetTrackingService.getOrganizationSummary(organizationId);

    return res.json({ success: true, data: summary });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Failed to get organization summary' });
  }
}
