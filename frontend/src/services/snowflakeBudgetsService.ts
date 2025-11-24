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

  private cache = new Map<string, { data: unknown; ts: number }>();
  private cacheTTLms = 60000;

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.cacheTTLms) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache<T>(key: string, data: T) {
    this.cache.set(key, { data, ts: Date.now() });
  }

  async list(connectorId: string): Promise<SnowflakeBudget[]> {
    const cacheKey = `list:${connectorId}`;
    const cached = this.getFromCache<SnowflakeBudget[]>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    const json = await res.json();
    const data = json.budgets || [];
    this.setCache(cacheKey, data);
    return data;
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
    this.cache.clear();
    return json.budget as SnowflakeBudget;
  }

  async remove(connectorId: string, budgetId: string): Promise<void> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets/${budgetId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to delete budget');
    this.cache.clear();
  }

  async listAlerts(connectorId: string): Promise<BudgetAlert[]> {
    const cacheKey = `alerts:${connectorId}`;
    const cached = this.getFromCache<BudgetAlert[]>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets/alerts`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to fetch alerts');
    const json = await res.json();
    const data = (json.alerts || []) as BudgetAlert[];
    this.setCache(cacheKey, data);
    return data;
  }

  async check(connectorId: string, budgetId: string): Promise<{ fired: boolean; current: number }> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets/${budgetId}/check`, {
      headers: { 'Authorization': `Bearer ${t}` },
    });
    if (!res.ok) throw new Error('Failed to check budget');
    const json = await res.json();
    this.cache.clear();
    return { fired: !!json.fired, current: Number(json.current || 0) };
  }
}

export const snowflakeBudgetsService = new SnowflakeBudgetsService();
