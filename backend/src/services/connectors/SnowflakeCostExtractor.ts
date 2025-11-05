/**
 * SnowflakeCostExtractor
 * Extracts cost and storage data from Snowflake and stores in our database
 * Called during metadata extraction process
 */

import { supabaseAdmin } from '../../config/supabase';

interface CostData {
  connectorId: string;
  organizationId: string;
  compute_credits: number;
  storage_credits: number;
  total_credits: number;
}

interface StorageData {
  connectorId: string;
  organizationId: string;
  database_name: string;
  schema_name: string;
  table_name: string;
  storage_bytes: number;
  row_count: number | null;
  table_type: string | null;
  is_transient: boolean;
  retention_days: number;
  last_altered: string | null;
  last_accessed: string | null;
  days_since_access: number | null;
}

interface WarehouseMetrics {
  connectorId: string;
  organizationId: string;
  warehouse_name: string;
  total_queries: number;
  total_execution_time_ms: number;
  credits_used: number;
  utilization_percent: number | null;
  warehouse_size: string | null;
}

interface WasteOpportunity {
  connectorId: string;
  organizationId: string;
  opportunity_type: string;
  severity: string;
  resource_type: string;
  resource_name: string;
  database_name: string | null;
  schema_name: string | null;
  current_monthly_cost: number;
  potential_monthly_savings: number;
  savings_confidence: number;
  title: string;
  description: string;
  recommendation: string;
  evidence: any;
}

export class SnowflakeCostExtractor {
  /**
   * Store daily cost metrics
   */
  async storeCostMetrics(data: CostData): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { error } = await supabaseAdmin
        .schema('enterprise')
        .from('snowflake_cost_metrics')
        .upsert({
          organization_id: data.organizationId,
          connector_id: data.connectorId,
          metric_date: today,
          period_type: 'daily',
          compute_credits: data.compute_credits,
          storage_credits: data.storage_credits,
          total_credits: data.total_credits,
          cost_per_credit: 3.0,
        }, {
          onConflict: 'connector_id,metric_date,period_type'
        });

      if (error) {
        console.error('[COST_EXTRACTOR] Failed to store cost metrics:', error);
        throw error;
      }

      console.log(`[COST_EXTRACTOR] Stored cost metrics: ${data.total_credits} credits`);
    } catch (e) {
      console.error('[COST_EXTRACTOR] Error storing cost metrics:', e);
      throw e;
    }
  }

  /**
   * Store storage usage data (batch)
   */
  async storeStorageUsage(storageData: StorageData[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Delete old data for this connector today (to handle re-extraction)
      if (storageData.length > 0) {
        await supabaseAdmin
          .schema('enterprise')
          .from('snowflake_storage_usage')
          .delete()
          .eq('connector_id', storageData[0].connectorId)
          .eq('snapshot_date', today);
      }

      // Insert new data in batches of 100
      const batchSize = 100;
      for (let i = 0; i < storageData.length; i += batchSize) {
        const batch = storageData.slice(i, i + batchSize);
        const records = batch.map(d => ({
          organization_id: d.organizationId,
          connector_id: d.connectorId,
          database_name: d.database_name,
          schema_name: d.schema_name,
          table_name: d.table_name,
          storage_bytes: d.storage_bytes,
          row_count: d.row_count,
          table_type: d.table_type,
          is_transient: d.is_transient,
          retention_days: d.retention_days,
          last_altered: d.last_altered,
          last_accessed: d.last_accessed,
          days_since_access: d.days_since_access,
          monthly_storage_cost: this.calculateStorageCost(d.storage_bytes),
          snapshot_date: today,
        }));

        const { error } = await supabaseAdmin
          .schema('enterprise')
          .from('snowflake_storage_usage')
          .insert(records);

        if (error) {
          console.error('[COST_EXTRACTOR] Failed to store storage batch:', error);
          throw error;
        }
      }

      console.log(`[COST_EXTRACTOR] Stored ${storageData.length} storage records`);
    } catch (e) {
      console.error('[COST_EXTRACTOR] Error storing storage usage:', e);
      throw e;
    }
  }

  /**
   * Store warehouse metrics (batch)
   */
  async storeWarehouseMetrics(metrics: WarehouseMetrics[]): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // Delete old data for this connector today
      if (metrics.length > 0) {
        await supabaseAdmin
          .schema('enterprise')
          .from('snowflake_warehouse_metrics')
          .delete()
          .eq('connector_id', metrics[0].connectorId)
          .eq('metric_date', today);
      }

      const records = metrics.map(m => ({
        organization_id: m.organizationId,
        connector_id: m.connectorId,
        warehouse_name: m.warehouse_name,
        metric_date: today,
        total_queries: m.total_queries,
        total_execution_time_ms: m.total_execution_time_ms,
        avg_execution_time_ms: m.total_queries > 0 ? m.total_execution_time_ms / m.total_queries : null,
        credits_used: m.credits_used,
        utilization_percent: m.utilization_percent,
        warehouse_size: m.warehouse_size,
      }));

      const { error } = await supabaseAdmin
        .schema('enterprise')
        .from('snowflake_warehouse_metrics')
        .insert(records);

      if (error) {
        console.error('[COST_EXTRACTOR] Failed to store warehouse metrics:', error);
        throw error;
      }

      console.log(`[COST_EXTRACTOR] Stored ${metrics.length} warehouse metrics`);
    } catch (e) {
      console.error('[COST_EXTRACTOR] Error storing warehouse metrics:', e);
      throw e;
    }
  }

  /**
   * Store waste opportunities (batch)
   */
  async storeWasteOpportunities(opportunities: WasteOpportunity[]): Promise<void> {
    try {
      // Delete old 'open' opportunities for this connector (re-detection)
      if (opportunities.length > 0) {
        await supabaseAdmin
          .schema('enterprise')
          .from('snowflake_waste_opportunities')
          .delete()
          .eq('connector_id', opportunities[0].connectorId)
          .eq('status', 'open');
      }

      const records = opportunities.map(o => ({
        organization_id: o.organizationId,
        connector_id: o.connectorId,
        opportunity_type: o.opportunity_type,
        severity: o.severity,
        status: 'open',
        resource_type: o.resource_type,
        resource_name: o.resource_name,
        database_name: o.database_name,
        schema_name: o.schema_name,
        current_monthly_cost: o.current_monthly_cost,
        potential_monthly_savings: o.potential_monthly_savings,
        savings_confidence: o.savings_confidence,
        title: o.title,
        description: o.description,
        recommendation: o.recommendation,
        evidence: o.evidence,
      }));

      const { error } = await supabaseAdmin
        .schema('enterprise')
        .from('snowflake_waste_opportunities')
        .insert(records);

      if (error) {
        console.error('[COST_EXTRACTOR] Failed to store waste opportunities:', error);
        throw error;
      }

      console.log(`[COST_EXTRACTOR] Stored ${opportunities.length} waste opportunities`);
    } catch (e) {
      console.error('[COST_EXTRACTOR] Error storing waste opportunities:', e);
      throw e;
    }
  }

  /**
   * Calculate monthly storage cost ($23 per TB per month)
   */
  private calculateStorageCost(bytes: number): number {
    const tb = bytes / 1099511627776; // bytes to TB
    return tb * 23; // $23 per TB per month
  }
}

export default new SnowflakeCostExtractor();
