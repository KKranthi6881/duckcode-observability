import { supabase } from '../config/supabaseClient';

export interface SnowflakeBudget {
  id: string;
  organization_id: string;
  connector_id: string;
  level: 'overall' | 'warehouse' | 'tag' | 'user';
  warehouse_name?: string | null;
  tag_name?: string | null;
  tag_value?: string | null;
  user_name?: string | null;
  threshold_credits: number;
  period: '7d' | '30d' | '90d' | 'custom';
  start_time?: string | null;
  end_time?: string | null;
  notify_slack_webhook?: string | null;
  notify_email?: string[] | null;
  status: 'active' | 'paused' | 'archived';
  created_at: string;
}

export interface BudgetAlert {
  id: string;
  organization_id: string;
  budget_id: string;
  connector_id: string;
  fired_at: string;
  current_credits: number;
  message?: string;
  sent_targets?: Record<string, unknown>;
}

class SnowflakeBudgetsService {
  private baseUrl: string;
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  }
  private async token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  }

  async list(connectorId: string): Promise<SnowflakeBudget[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    const json = await res.json();
    return json.budgets || [];
  }

  async save(connectorId: string, budget: Partial<SnowflakeBudget> & { level: SnowflakeBudget['level']; threshold_credits: number; period?: SnowflakeBudget['period'] }, upsert = false): Promise<SnowflakeBudget> {
    const t = await this.token();
    const url = new URL(`${this.baseUrl}/api/connectors/${connectorId}/budgets`);
    if (upsert) url.searchParams.set('upsert', '1');
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(budget),
    });
    if (!res.ok) throw new Error('Failed to save budget');
    const json = await res.json();
    return json.budget as SnowflakeBudget;
  }

  async remove(connectorId: string, budgetId: string): Promise<void> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets/${budgetId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to delete budget');
  }

  async listAlerts(connectorId: string): Promise<BudgetAlert[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets/alerts`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to fetch alerts');
    const json = await res.json();
    return (json.alerts || []) as BudgetAlert[];
  }

  async check(connectorId: string, budgetId: string): Promise<{ fired: boolean; current: number }> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets/${budgetId}/check`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to check budget');
    const json = await res.json();
    return { fired: !!json.fired, current: Number(json.current || 0) };
  }
}

export const snowflakeBudgetsService = new SnowflakeBudgetsService();
