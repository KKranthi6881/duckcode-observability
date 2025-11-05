import { supabase } from '../config/supabaseClient';

export interface Budget {
  id: string;
  organization_id: string;
  connector_id?: string;
  budget_type: 'organization' | 'connector' | 'warehouse';
  warehouse_name?: string;
  budget_name: string;
  budget_amount: number;
  budget_period: 'monthly' | 'quarterly' | 'annually';
  currency: string;
  alert_threshold_1: number;
  alert_threshold_2: number;
  alert_threshold_3: number;
  email_alerts: boolean;
  slack_webhook_url?: string;
  auto_suspend_at_limit: boolean;
  status: 'active' | 'paused' | 'archived';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetSpend {
  budget_id: string;
  current_spend: number;
  budget_amount: number;
  percentage_used: number;
  remaining_budget: number;
  projected_end_of_period_spend?: number;
  projected_overage?: number;
  days_until_limit?: string;
}

export interface BudgetAlert {
  id: string;
  budget_id: string;
  alert_type: 'threshold_1' | 'threshold_2' | 'threshold_3' | 'exceeded';
  threshold_percentage: number;
  current_spend: number;
  budget_amount: number;
  percentage_used: number;
  alerted_at: string;
  acknowledged_at?: string;
  email_sent: boolean;
  slack_sent: boolean;
}

class BudgetService {
  private baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  private async token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  }

  async listBudgets(connectorId: string): Promise<Budget[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch budgets');
    const json = await res.json();
    return json.budgets || [];
  }

  async createBudget(connectorId: string, budget: Partial<Budget>): Promise<Budget> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${t}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(budget)
    });
    if (!res.ok) throw new Error('Failed to create budget');
    const json = await res.json();
    return json.budget;
  }

  async updateBudget(connectorId: string, budgetId: string, updates: Partial<Budget>): Promise<Budget> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets/${budgetId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${t}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update budget');
    const json = await res.json();
    return json.budget;
  }

  async deleteBudget(connectorId: string, budgetId: string): Promise<void> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/budgets/${budgetId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to delete budget');
  }

  async getCurrentSpend(budgetId: string): Promise<BudgetSpend> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/budgets/${budgetId}/spend`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch current spend');
    const json = await res.json();
    return json.data;
  }

  async getAlerts(budgetId: string): Promise<BudgetAlert[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/budgets/${budgetId}/alerts`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch alerts');
    const json = await res.json();
    return json.alerts || [];
  }

  async checkAlerts(budgetId: string): Promise<BudgetAlert[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/budgets/${budgetId}/check`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to check alerts');
    const json = await res.json();
    return json.alerts || [];
  }
}

export default new BudgetService();
