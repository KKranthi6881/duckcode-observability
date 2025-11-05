import { createClient } from '@supabase/supabase-js';

export interface DailyCost {
  id: string;
  organization_id: string;
  connector_id: string;
  usage_date: string;
  total_cost: number;
  total_credits: number;
  credit_price: number;
  compute_cost?: number;
  storage_cost?: number;
  data_transfer_cost?: number;
  total_queries?: number;
  successful_queries?: number;
  failed_queries?: number;
  created_at: string;
  updated_at: string;
}

export class SnowflakeCostTrackingService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Add or update daily cost data
   */
  async upsertDailyCost(data: {
    connector_id: string;
    usage_date: string;
    total_cost: number;
    total_queries?: number;
    compute_cost?: number;
    storage_cost?: number;
  }): Promise<string> {
    const { data: result, error } = await this.supabase
      .schema('enterprise')
      .rpc('upsert_daily_cost', {
        p_connector_id: data.connector_id,
        p_usage_date: data.usage_date,
        p_total_cost: data.total_cost,
        p_total_queries: data.total_queries || 0,
      });

    if (error) {
      console.error('[CostTracking] Error upserting daily cost:', error);
      throw new Error(`Failed to upsert daily cost: ${error.message}`);
    }

    return result;
  }

  /**
   * Get daily costs for a connector
   */
  async getDailyCosts(
    connectorId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyCost[]> {
    let query = this.supabase
      .schema('enterprise')
      .from('snowflake_daily_costs')
      .select('*')
      .eq('connector_id', connectorId);

    if (startDate) {
      query = query.gte('usage_date', startDate);
    }
    if (endDate) {
      query = query.lte('usage_date', endDate);
    }

    query = query.order('usage_date', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[CostTracking] Error getting daily costs:', error);
      throw new Error(`Failed to get daily costs: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get cost summary for a period
   */
  async getCostSummary(
    connectorId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    total_cost: number;
    total_credits: number;
    total_queries: number;
    avg_daily_cost: number;
    days_with_data: number;
  }> {
    const costs = await this.getDailyCosts(connectorId, startDate, endDate);

    const totalCost = costs.reduce((sum, c) => sum + c.total_cost, 0);
    const totalCredits = costs.reduce((sum, c) => sum + c.total_credits, 0);
    const totalQueries = costs.reduce((sum, c) => sum + (c.total_queries || 0), 0);

    return {
      total_cost: totalCost,
      total_credits: totalCredits,
      total_queries: totalQueries,
      avg_daily_cost: costs.length > 0 ? totalCost / costs.length : 0,
      days_with_data: costs.length,
    };
  }

  /**
   * Bulk insert costs (for Snowflake data sync)
   */
  async bulkInsertCosts(costs: Array<{
    connector_id: string;
    usage_date: string;
    total_cost: number;
    total_queries?: number;
  }>): Promise<void> {
    for (const cost of costs) {
      await this.upsertDailyCost(cost);
    }
  }

  /**
   * Get current month costs for a connector
   */
  async getCurrentMonthCosts(connectorId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split('T')[0];

    const summary = await this.getCostSummary(connectorId, startOfMonth, endOfMonth);
    return summary.total_cost;
  }
}

export default new SnowflakeCostTrackingService();
