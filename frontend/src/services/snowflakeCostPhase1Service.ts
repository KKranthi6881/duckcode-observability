import { supabase } from '../config/supabaseClient';

// Phase 1: Cost Overview Response
export interface CostOverview {
  period_days: number;
  compute_credits: number;
  storage_credits: number;
  total_credits: number;
  total_cost: number;
  total_queries: number;
  failed_queries: number;
  failure_rate: string | number;
}

// Storage Usage Row - matches enterprise.snowflake_storage_usage table schema
export interface StorageUsageRow {
  database_name: string;
  schema_name: string;
  table_name: string;
  table_type?: string;
  storage_bytes: number;
  storage_gb?: number;
  failsafe_bytes?: number;
  time_travel_bytes?: number;
  row_count?: number;
  is_transient?: boolean;
  retention_days?: number;
  last_altered?: string;
  last_accessed?: string;
  days_since_access?: number;
  monthly_storage_cost?: number;
  snapshot_date?: string;
}

// Storage Costs Row
export interface StorageCostRow {
  USAGE_DATE: string;
  STORAGE_BYTES: number;
  STAGE_BYTES: number;
  FAILSAFE_BYTES: number;
}

// Waste Detection Types
export interface UnusedTable {
  DATABASE_NAME: string;
  SCHEMA_NAME: string;
  TABLE_NAME: string;
  STORAGE_BYTES: number;
  LAST_ALTERED: string;
  LAST_ACCESS: string | null;
  DAYS_SINCE_ACCESS: number;
}

export interface IdleWarehouse {
  WAREHOUSE_NAME: string;
  LAST_QUERY_TIME: string | null;
  QUERY_COUNT: number;
  DAYS_IDLE: number;
  MONTHLY_CREDITS: number;
}

export interface WarehouseUtilization {
  WAREHOUSE_NAME: string;
  WAREHOUSE_SIZE: string;
  TOTAL_CREDITS: number;
  ACTIVE_HOURS: number;
  AVG_UTILIZATION: number;
  AVG_QUEUE_LOAD: number;
  STATUS: 'UNDERUTILIZED' | 'OVERSIZED' | 'OPTIMAL';
}

export interface WasteDetectionSummary {
  total_potential_savings: number;
  unused_table_savings: number;
  idle_warehouse_savings: number;
  underutilized_warehouse_savings: number;
  total_opportunities: number;
}

export interface WasteDetectionData {
  unused_tables: UnusedTable[];
  idle_warehouses: IdleWarehouse[];
  warehouse_utilization: WarehouseUtilization[];
  summary: WasteDetectionSummary;
}

// Data Transfer Row
export interface DataTransferRow {
  USAGE_DATE: string;
  SOURCE_CLOUD: string;
  SOURCE_REGION: string;
  TARGET_CLOUD: string;
  TARGET_REGION: string;
  BYTES_TRANSFERRED: number;
  TRANSFER_TYPE: string;
}

class SnowflakeCostPhase1Service {
  private baseUrl: string;
  private cache = new Map<string, { data: unknown; ts: number }>();
  private cacheTTLms = 60000; // 60s TTL to keep data fresh but avoid refetching on quick tab switches
  
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  }

  private async token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  }

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

  /**
   * Get comprehensive cost overview (compute + storage + queries)
   */
  async getCostOverview(connectorId: string, days: number = 30): Promise<CostOverview> {
    const cacheKey = `overview:${connectorId}:${days}`;
    const cached = this.getFromCache<CostOverview>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/cost/overview?days=${days}`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch cost overview');
    const json = await res.json();
    this.setCache(cacheKey, json.data);
    return json.data;
  }

  /**
   * Get table-level storage usage breakdown
   */
  async getStorageUsage(connectorId: string): Promise<StorageUsageRow[]> {
    const cacheKey = `storage-usage:${connectorId}`;
    const cached = this.getFromCache<StorageUsageRow[]>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/cost/storage-usage`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch storage usage');
    const json = await res.json();
    const data = json.data || [];
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get historical storage costs
   */
  async getStorageCosts(connectorId: string, start?: string, end?: string): Promise<StorageCostRow[]> {
    const cacheKey = `storage-costs:${connectorId}:${start || ''}:${end || ''}`;
    const cached = this.getFromCache<StorageCostRow[]>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const url = new URL(`${this.baseUrl}/api/connectors/${connectorId}/cost/storage-costs`);
    if (start) url.searchParams.set('start', start);
    if (end) url.searchParams.set('end', end);
    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch storage costs');
    const json = await res.json();
    const data = json.data || [];
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Get waste detection opportunities
   */
  async getWasteDetection(connectorId: string): Promise<WasteDetectionData> {
    const cacheKey = `waste:${connectorId}`;
    const cached = this.getFromCache<WasteDetectionData>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/cost/waste-detection`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to detect waste');
    const json = await res.json();
    this.setCache(cacheKey, json.data);
    return json.data;
  }

  /**
   * Get data transfer costs
   */
  async getDataTransferCosts(connectorId: string, days: number = 30): Promise<DataTransferRow[]> {
    const cacheKey = `transfer:${connectorId}:${days}`;
    const cached = this.getFromCache<DataTransferRow[]>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/cost/data-transfer?days=${days}`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch data transfer costs');
    const json = await res.json();
    const data = json.data || [];
    this.setCache(cacheKey, data);
    return data;
  }
}

export default new SnowflakeCostPhase1Service();
