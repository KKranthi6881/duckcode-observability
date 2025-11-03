import { supabase } from '../config/supabaseClient';

export interface DailyCreditRow { DAY: string; CREDITS: number }
export interface WarehouseCostRow { WAREHOUSE_NAME: string; CREDITS: number }
export interface TagCostRow { TAG_NAME: string; TAG_VALUE: string; CREDITS: number }
export interface TopQueryRow {
  QUERY_ID: string;
  USER_NAME: string;
  WAREHOUSE_NAME: string;
  DATABASE_NAME: string | null;
  SCHEMA_NAME: string | null;
  BYTES_SCANNED: number | null;
  TOTAL_ELAPSED_TIME: number | null;
  EXECUTION_TIME: number | null;
  START_TIME: string;
  QUERY_TEXT?: string;
}

export interface ConnectorItem {
  id: string;
  name: string;
  type: string;
  organization_id: string;
}

class SnowflakeCostService {
  private baseUrl: string;
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  }

  private async token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  }

  async listSnowflakeConnectors(organizationId: string): Promise<ConnectorItem[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors?organizationId=${organizationId}`, {
      headers: {
        'Authorization': `Bearer ${t}`,
      }
    });
    if (!res.ok) throw new Error('Failed to list connectors');
    const json = await res.json();
    const all = (json.connectors || []) as ConnectorItem[];
    return all.filter(c => c.type === 'snowflake');
  }

  async getDailyCredits(connectorId: string, start?: string, end?: string, opts?: { warehouse?: string; tagName?: string; tagValue?: string }): Promise<DailyCreditRow[]> {
    const t = await this.token();
    const url = new URL(`${this.baseUrl}/api/connectors/${connectorId}/cost/overview`);
    if (start) url.searchParams.set('start', start);
    if (end) url.searchParams.set('end', end);
    if (opts?.warehouse) url.searchParams.set('warehouse', opts.warehouse);
    if (opts?.tagName) url.searchParams.set('tagName', opts.tagName);
    if (opts?.tagValue) url.searchParams.set('tagValue', opts.tagValue);
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${t}` } });
    if (!res.ok) throw new Error('Failed to fetch overview');
    const json = await res.json();
    return json.data || [];
  }

  async getWarehouseCosts(connectorId: string, start?: string, end?: string, opts?: { tagName?: string; tagValue?: string }): Promise<WarehouseCostRow[]> {
    const t = await this.token();
    const url = new URL(`${this.baseUrl}/api/connectors/${connectorId}/cost/warehouses`);
    if (start) url.searchParams.set('start', start);
    if (end) url.searchParams.set('end', end);
    if (opts?.tagName) url.searchParams.set('tagName', opts.tagName);
    if (opts?.tagValue) url.searchParams.set('tagValue', opts.tagValue);
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${t}` } });
    if (!res.ok) throw new Error('Failed to fetch warehouses');
    const json = await res.json();
    return json.data || [];
  }

  async getCostByTags(connectorId: string, start?: string, end?: string): Promise<TagCostRow[]> {
    const t = await this.token();
    const url = new URL(`${this.baseUrl}/api/connectors/${connectorId}/cost/tags`);
    if (start) url.searchParams.set('start', start);
    if (end) url.searchParams.set('end', end);
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${t}` } });
    if (!res.ok) throw new Error('Failed to fetch tags');
    const json = await res.json();
    return json.data || [];
  }

  async getTopQueries(connectorId: string, start?: string, end?: string, opts?: { warehouse?: string; user?: string; includeText?: boolean }): Promise<TopQueryRow[]> {
    const t = await this.token();
    const url = new URL(`${this.baseUrl}/api/connectors/${connectorId}/cost/top-queries`);
    if (start) url.searchParams.set('start', start);
    if (end) url.searchParams.set('end', end);
    if (opts?.warehouse) url.searchParams.set('warehouse', opts.warehouse);
    if (opts?.user) url.searchParams.set('user', opts.user);
    if (opts?.includeText) url.searchParams.set('includeText', '1');
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${t}` } });
    if (!res.ok) throw new Error('Failed to fetch queries');
    const json = await res.json();
    return json.data || [];
  }

  async getFilters(connectorId: string, start?: string, end?: string): Promise<{ warehouses: { WAREHOUSE_NAME: string }[]; tags: { TAG_NAME: string; TAG_VALUE: string }[]; users: { USER_NAME: string }[]; }> {
    const t = await this.token();
    const url = new URL(`${this.baseUrl}/api/connectors/${connectorId}/cost/filters`);
    if (start) url.searchParams.set('start', start);
    if (end) url.searchParams.set('end', end);
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${t}` } });
    if (!res.ok) throw new Error('Failed to fetch filters');
    const json = await res.json();
    return json.data || { warehouses: [], tags: [], users: [] };
  }
}

export const snowflakeCostService = new SnowflakeCostService();
