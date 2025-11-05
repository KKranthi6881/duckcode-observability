import { createClient } from '@supabase/supabase-js';
import { SnowflakeConnector } from './connectors/SnowflakeConnector';
import SnowflakeCostTrackingService from './SnowflakeCostTrackingService';

interface SyncResult {
  success: boolean;
  connector_id: string;
  records_synced: number;
  date_range: { start: string; end: string };
  errors?: string[];
}

export class SnowflakeDataSyncService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Sync daily costs from Snowflake for all active connectors
   */
  async syncAllConnectors(): Promise<SyncResult[]> {
    console.log('[SnowflakeSync] Starting sync for all connectors...');
    
    // Get all active Snowflake connectors
    const { data: connectors, error } = await this.supabase
      .schema('enterprise')
      .from('connectors')
      .select('id, name, snowflake_account, snowflake_username, snowflake_password, snowflake_warehouse')
      .eq('source_type', 'snowflake')
      .eq('status', 'active');

    if (error) {
      console.error('[SnowflakeSync] Error fetching connectors:', error);
      throw new Error(`Failed to fetch connectors: ${error.message}`);
    }

    if (!connectors || connectors.length === 0) {
      console.log('[SnowflakeSync] No active Snowflake connectors found');
      return [];
    }

    console.log(`[SnowflakeSync] Found ${connectors.length} active connectors`);

    const results: SyncResult[] = [];

    for (const connector of connectors) {
      try {
        const result = await this.syncConnector(connector.id);
        results.push(result);
        console.log(`[SnowflakeSync] ✓ Synced connector ${connector.name}: ${result.records_synced} records`);
      } catch (err) {
        console.error(`[SnowflakeSync] ✗ Failed to sync connector ${connector.name}:`, err);
        results.push({
          success: false,
          connector_id: connector.id,
          records_synced: 0,
          date_range: { start: '', end: '' },
          errors: [err instanceof Error ? err.message : String(err)],
        });
      }
    }

    return results;
  }

  /**
   * Sync daily costs for a specific connector
   */
  async syncConnector(connectorId: string): Promise<SyncResult> {
    console.log(`[SnowflakeSync] Syncing connector ${connectorId}...`);

    // Get last sync date or default to 30 days ago
    const lastSyncDate = await this.getLastSyncDate(connectorId);
    const startDate = lastSyncDate || this.getDefaultStartDate();
    const endDate = new Date().toISOString().split('T')[0]; // Today

    console.log(`[SnowflakeSync] Date range: ${startDate} to ${endDate}`);

    // Extract daily costs from Snowflake
    const dailyCosts = await this.extractDailyCosts(connectorId, startDate, endDate);

    if (dailyCosts.length === 0) {
      console.log(`[SnowflakeSync] No new data for connector ${connectorId}`);
      return {
        success: true,
        connector_id: connectorId,
        records_synced: 0,
        date_range: { start: startDate, end: endDate },
      };
    }

    // Bulk insert into database
    await SnowflakeCostTrackingService.bulkInsertCosts(dailyCosts);

    // Update last sync timestamp
    await this.updateLastSyncDate(connectorId, endDate);

    return {
      success: true,
      connector_id: connectorId,
      records_synced: dailyCosts.length,
      date_range: { start: startDate, end: endDate },
    };
  }

  /**
   * Extract daily costs from Snowflake
   */
  private async extractDailyCosts(
    connectorId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{ connector_id: string; usage_date: string; total_cost: number; total_queries: number }>> {
    // Get connector credentials
    const { data: connector, error } = await this.supabase
      .schema('enterprise')
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .single();

    if (error || !connector) {
      throw new Error(`Connector ${connectorId} not found`);
    }

    // Initialize Snowflake connection
    const snowflakeConnector = new SnowflakeConnector(
      connector.name,
      {
        account: connector.snowflake_account,
        username: connector.snowflake_username,
        password: connector.snowflake_password,
        warehouse: connector.snowflake_warehouse,
        database: 'SNOWFLAKE',
        schema: 'ACCOUNT_USAGE',
        role: connector.snowflake_role || 'ACCOUNTADMIN',
      },
      connectorId,
      connector.organization_id
    );
    
    // Query for daily aggregated costs
    const query = `
      SELECT 
        DATE(start_time) as usage_date,
        SUM(credits_used_cloud_services) as total_credits,
        SUM(credits_used_cloud_services) * 3.0 as total_cost,
        COUNT(*) as total_queries,
        SUM(CASE WHEN execution_status = 'SUCCESS' THEN 1 ELSE 0 END) as successful_queries
      FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
      WHERE start_time >= '${startDate}'::DATE
        AND start_time < '${endDate}'::DATE + INTERVAL '1 day'
        AND warehouse_name IS NOT NULL
      GROUP BY DATE(start_time)
      ORDER BY usage_date DESC
    `;

    try {
      // TODO: Implement proper Snowflake query execution using SnowflakeConnector
      // The connector needs a method to execute custom SQL queries
      // For now, return empty array - this will be implemented when Snowflake integration is active
      const results: any[] = [];
      
      console.log('[SnowflakeSync] TODO: Execute query via Snowflake connector');
      console.log('[SnowflakeSync] Query:', query);

      // Transform results
      return results.map((row: any) => ({
        connector_id: connectorId,
        usage_date: row.USAGE_DATE,
        total_cost: parseFloat(row.TOTAL_COST) || 0,
        total_queries: parseInt(row.TOTAL_QUERIES) || 0,
      }));
    } catch (err) {
      console.error('[SnowflakeSync] Error executing Snowflake query:', err);
      throw err;
    }
  }

  /**
   * Get last sync date for a connector
   */
  private async getLastSyncDate(connectorId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_daily_costs')
      .select('usage_date')
      .eq('connector_id', connectorId)
      .order('usage_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    // Return day after last sync to avoid duplicates
    const lastDate = new Date(data.usage_date);
    lastDate.setDate(lastDate.getDate() + 1);
    return lastDate.toISOString().split('T')[0];
  }

  /**
   * Get default start date (30 days ago)
   */
  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncDate(connectorId: string, syncDate: string): Promise<void> {
    await this.supabase
      .schema('enterprise')
      .from('connectors')
      .update({ 
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', connectorId);
  }

  /**
   * Sync warehouse metrics (for warehouse-level budgets)
   */
  async syncWarehouseMetrics(connectorId: string): Promise<void> {
    console.log(`[SnowflakeSync] Syncing warehouse metrics for ${connectorId}...`);

    const { data: connector } = await this.supabase
      .schema('enterprise')
      .from('connectors')
      .select('*')
      .eq('id', connectorId)
      .single();

    if (!connector) {
      throw new Error(`Connector ${connectorId} not found`);
    }

    // TODO: Implement proper Snowflake query execution
    const query = `
      SELECT 
        warehouse_name,
        DATE(start_time) as metric_date,
        COUNT(*) as total_queries,
        SUM(total_elapsed_time) as total_execution_time_ms,
        AVG(total_elapsed_time) as avg_execution_time_ms,
        SUM(credits_used_cloud_services) as credits_used,
        warehouse_size
      FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
      WHERE start_time >= CURRENT_DATE - 7
        AND warehouse_name IS NOT NULL
      GROUP BY warehouse_name, DATE(start_time), warehouse_size
      ORDER BY metric_date DESC
    `;

    console.log('[SnowflakeSync] TODO: Execute warehouse metrics query');
    const results: any[] = [];

    // Get organization_id
    const { data: org } = await this.supabase
      .schema('enterprise')
      .from('connectors')
      .select('organization_id')
      .eq('id', connectorId)
      .single();

    // Insert warehouse metrics
    const metrics = results.map((row: any) => ({
      organization_id: org?.organization_id,
      connector_id: connectorId,
      warehouse_name: row.WAREHOUSE_NAME,
      metric_date: row.METRIC_DATE,
      total_queries: parseInt(row.TOTAL_QUERIES) || 0,
      total_execution_time_ms: parseInt(row.TOTAL_EXECUTION_TIME_MS) || 0,
      avg_execution_time_ms: parseFloat(row.AVG_EXECUTION_TIME_MS) || 0,
      credits_used: parseFloat(row.CREDITS_USED) || 0,
      warehouse_size: row.WAREHOUSE_SIZE,
    }));

    if (metrics.length > 0) {
      await this.supabase
        .schema('enterprise')
        .from('snowflake_warehouse_metrics')
        .upsert(metrics, {
          onConflict: 'connector_id,warehouse_name,metric_date',
        });
    }

    console.log(`[SnowflakeSync] Synced ${metrics.length} warehouse metrics`);
  }
}

export default new SnowflakeDataSyncService();
