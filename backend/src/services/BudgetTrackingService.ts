import { createClient } from '@supabase/supabase-js';

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

export class BudgetTrackingService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a new budget
   */
  async createBudget(budget: Partial<Budget>): Promise<Budget> {
    // Calculate period dates based on budget_period
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let periodEnd: Date;

    switch (budget.budget_period) {
      case 'monthly':
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarterly':
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        periodEnd = new Date(now.getFullYear(), quarterMonth + 3, 0);
        break;
      case 'annually':
        periodEnd = new Date(now.getFullYear(), 11, 31);
        break;
      default:
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const budgetData = {
      ...budget,
      current_period_start: periodStart.toISOString().split('T')[0],
      current_period_end: periodEnd.toISOString().split('T')[0],
      status: budget.status || 'active',
      alert_threshold_1: budget.alert_threshold_1 || 75,
      alert_threshold_2: budget.alert_threshold_2 || 90,
      alert_threshold_3: budget.alert_threshold_3 || 100,
      email_alerts: budget.email_alerts !== undefined ? budget.email_alerts : true,
      auto_suspend_at_limit: budget.auto_suspend_at_limit || false,
      currency: budget.currency || 'USD',
    };

    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budgets')
      .insert([budgetData])
      .select()
      .single();

    if (error) {
      console.error('[BudgetService] Error creating budget:', error);
      throw new Error(`Failed to create budget: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all budgets for an organization
   */
  async listBudgets(organizationId: string, connectorId?: string): Promise<Budget[]> {
    let query = this.supabase
      .schema('enterprise')
      .from('snowflake_budgets')
      .select('*')
      .eq('organization_id', organizationId);

    if (connectorId) {
      query = query.or(`connector_id.eq.${connectorId},budget_type.eq.organization`);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[BudgetService] Error listing budgets:', error);
      throw new Error(`Failed to list budgets: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single budget by ID
   */
  async getBudget(budgetId: string): Promise<Budget | null> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budgets')
      .select('*')
      .eq('id', budgetId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('[BudgetService] Error getting budget:', error);
      throw new Error(`Failed to get budget: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a budget
   */
  async updateBudget(budgetId: string, updates: Partial<Budget>): Promise<Budget> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budgets')
      .update(updates)
      .eq('id', budgetId)
      .select()
      .single();

    if (error) {
      console.error('[BudgetService] Error updating budget:', error);
      throw new Error(`Failed to update budget: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a budget
   */
  async deleteBudget(budgetId: string): Promise<void> {
    const { error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budgets')
      .delete()
      .eq('id', budgetId);

    if (error) {
      console.error('[BudgetService] Error deleting budget:', error);
      throw new Error(`Failed to delete budget: ${error.message}`);
    }
  }

  /**
   * Get current spend for a budget
   */
  async getCurrentSpend(budgetId: string): Promise<BudgetSpend> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .rpc('get_budget_current_spend', { p_budget_id: budgetId });

    if (error) {
      console.error('[BudgetService] Error getting current spend:', error);
      throw new Error(`Failed to get current spend: ${error.message}`);
    }

    const budget = await this.getBudget(budgetId);
    if (!budget) {
      throw new Error('Budget not found');
    }

    const currentSpend = data || 0;
    const percentageUsed = (currentSpend / budget.budget_amount) * 100;
    const remainingBudget = budget.budget_amount - currentSpend;

    // Calculate forecast
    const periodStart = new Date(budget.current_period_start);
    const periodEnd = new Date(budget.current_period_end);
    const now = new Date();
    
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = totalDays - elapsedDays;

    let projectedSpend = 0;
    let daysUntilLimit: Date | null = null;

    if (elapsedDays > 0) {
      const dailyBurn = currentSpend / elapsedDays;
      projectedSpend = currentSpend + (dailyBurn * remainingDays);
      
      if (dailyBurn > 0 && currentSpend < budget.budget_amount) {
        const daysToLimit = (budget.budget_amount - currentSpend) / dailyBurn;
        daysUntilLimit = new Date(now.getTime() + (daysToLimit * 24 * 60 * 60 * 1000));
      }
    }

    return {
      budget_id: budgetId,
      current_spend: currentSpend,
      budget_amount: budget.budget_amount,
      percentage_used: percentageUsed,
      remaining_budget: remainingBudget,
      projected_end_of_period_spend: projectedSpend,
      projected_overage: projectedSpend > budget.budget_amount ? projectedSpend - budget.budget_amount : 0,
      days_until_limit: daysUntilLimit ? daysUntilLimit.toISOString().split('T')[0] : undefined,
    };
  }

  /**
   * Check budget alerts
   */
  async checkBudgetAlerts(budgetId: string): Promise<BudgetAlert[]> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .rpc('check_budget_alerts', { p_budget_id: budgetId });

    if (error) {
      console.error('[BudgetService] Error checking alerts:', error);
      throw new Error(`Failed to check alerts: ${error.message}`);
    }

    // Get recent alerts
    const { data: alerts, error: alertsError } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budget_alerts')
      .select('*')
      .eq('budget_id', budgetId)
      .order('alerted_at', { ascending: false })
      .limit(10);

    if (alertsError) {
      console.error('[BudgetService] Error fetching alerts:', alertsError);
      return [];
    }

    return alerts || [];
  }

  /**
   * Get alert history for a budget
   */
  async getAlertHistory(budgetId: string): Promise<BudgetAlert[]> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budget_alerts')
      .select('*')
      .eq('budget_id', budgetId)
      .order('alerted_at', { ascending: false });

    if (error) {
      console.error('[BudgetService] Error getting alert history:', error);
      throw new Error(`Failed to get alert history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budget_alerts')
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
      })
      .eq('id', alertId);

    if (error) {
      console.error('[BudgetService] Error acknowledging alert:', error);
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }
  }

  /**
   * Create budget snapshot (daily)
   */
  async createSnapshot(budgetId: string): Promise<void> {
    const spend = await this.getCurrentSpend(budgetId);

    const { error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budget_snapshots')
      .upsert({
        budget_id: budgetId,
        snapshot_date: new Date().toISOString().split('T')[0],
        current_spend: spend.current_spend,
        budget_amount: spend.budget_amount,
        percentage_used: spend.percentage_used,
        remaining_budget: spend.remaining_budget,
        projected_end_of_period_spend: spend.projected_end_of_period_spend,
        projected_overage: spend.projected_overage,
        days_until_limit: spend.days_until_limit,
      }, {
        onConflict: 'budget_id,snapshot_date',
      });

    if (error) {
      console.error('[BudgetService] Error creating snapshot:', error);
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }
  }

  /**
   * Get budget snapshots (for trending)
   */
  async getSnapshots(budgetId: string, days: number = 30): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_budget_snapshots')
      .select('*')
      .eq('budget_id', budgetId)
      .gte('snapshot_date', startDate.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: true });

    if (error) {
      console.error('[BudgetService] Error getting snapshots:', error);
      throw new Error(`Failed to get snapshots: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get budget summary for organization
   */
  async getOrganizationSummary(organizationId: string): Promise<any> {
    const budgets = await this.listBudgets(organizationId);
    
    let totalBudget = 0;
    let totalSpend = 0;
    let budgetsOnTrack = 0;
    let budgetsAtRisk = 0;
    let budgetsExceeded = 0;

    for (const budget of budgets.filter(b => b.status === 'active')) {
      totalBudget += budget.budget_amount;
      
      try {
        const spend = await this.getCurrentSpend(budget.id);
        totalSpend += spend.current_spend;

        if (spend.percentage_used >= 100) {
          budgetsExceeded++;
        } else if (spend.percentage_used >= 90) {
          budgetsAtRisk++;
        } else {
          budgetsOnTrack++;
        }
      } catch (err) {
        console.error(`Error getting spend for budget ${budget.id}:`, err);
      }
    }

    return {
      total_budgets: budgets.length,
      active_budgets: budgets.filter(b => b.status === 'active').length,
      total_budget_amount: totalBudget,
      total_current_spend: totalSpend,
      overall_percentage_used: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
      budgets_on_track: budgetsOnTrack,
      budgets_at_risk: budgetsAtRisk,
      budgets_exceeded: budgetsExceeded,
    };
  }
}

export default new BudgetTrackingService();
