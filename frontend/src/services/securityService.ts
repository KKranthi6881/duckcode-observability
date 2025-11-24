import { supabase } from '../config/supabaseClient';

export interface UserCost {
  user_name: string;
  total_queries: number;
  total_cost_usd: number;
  compute_cost_usd: number;
  avg_execution_time_ms: number;
  failed_queries: number;
  top_warehouse_name: string;
  cost_per_query: number;
  failure_rate_pct: number;
  cost_rank: number;
}

export interface AccessPattern {
  id: string;
  user_name: string;
  event_type: string;
  source_ip?: string;
  client_type?: string;
  is_anomaly: boolean;
  anomaly_reason?: string;
  risk_score?: number;
  event_timestamp: string;
}

export interface SecurityIssue {
  issue_type: string;
  affected_entity: string;
  issue_count: number;
  severity: string;
  description: string;
}

export interface SecuritySummary {
  total_users: number;
  total_cost: number;
  top_spender: string;
  top_spender_cost: number;
  security_issues_count: number;
  anomalies_count: number;
  over_permissioned_roles: number;
  unused_permissions: number;
}

class SecurityService {
  private baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

  private async token(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    return session.access_token;
  }

  async getSecuritySummary(connectorId: string): Promise<SecuritySummary> {
    const cacheKey = `summary:${connectorId}`;
    const cached = this.getFromCache<SecuritySummary>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/security/summary`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch security summary');
    const json = await res.json();
    this.setCache(cacheKey, json.data);
    return json.data;
  }

  async getTopExpensiveUsers(connectorId: string, limit: number = 20): Promise<UserCost[]> {
    const cacheKey = `top-users:${connectorId}:${limit}`;
    const cached = this.getFromCache<UserCost[]>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/security/user-costs?limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch top users');
    const json = await res.json();
    const data = json.data || [];
    this.setCache(cacheKey, data);
    return data;
  }

  async getUserDetails(connectorId: string, userName: string): Promise<UserCost | null> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/security/user-costs/${encodeURIComponent(userName)}`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch user details');
    const json = await res.json();
    return json.data;
  }

  async getAccessPatterns(
    connectorId: string,
    options: {
      userName?: string;
      eventType?: string;
      anomaliesOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<AccessPattern[]> {
    const t = await this.token();
    const params = new URLSearchParams();
    if (options.userName) params.append('userName', options.userName);
    if (options.eventType) params.append('eventType', options.eventType);
    if (options.anomaliesOnly) params.append('anomaliesOnly', 'true');
    if (options.limit) params.append('limit', options.limit.toString());

    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/security/access-patterns?${params}`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch access patterns');
    const json = await res.json();
    return json.data || [];
  }

  async getAnomalies(connectorId: string, days: number = 30): Promise<AccessPattern[]> {
    const cacheKey = `anomalies:${connectorId}:${days}`;
    const cached = this.getFromCache<AccessPattern[]>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/security/anomalies?days=${days}`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch anomalies');
    const json = await res.json();
    const data = json.data || [];
    this.setCache(cacheKey, data);
    return data;
  }

  async detectAnomalies(connectorId: string, lookbackDays: number = 30): Promise<any[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/security/detect-anomalies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${t}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ lookbackDays })
    });
    if (!res.ok) throw new Error('Failed to detect anomalies');
    const json = await res.json();
    this.cache.clear();
    return json.data || [];
  }

  async getSecurityIssues(connectorId: string): Promise<SecurityIssue[]> {
    const cacheKey = `issues:${connectorId}`;
    const cached = this.getFromCache<SecurityIssue[]>(cacheKey);
    if (cached) return cached;

    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/security/issues`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch security issues');
    const json = await res.json();
    const data = json.data || [];
    this.setCache(cacheKey, data);
    return data;
  }

  async getPermissionIssues(connectorId: string): Promise<any[]> {
    const t = await this.token();
    const res = await fetch(`${this.baseUrl}/api/connectors/${connectorId}/security/permission-issues`, {
      headers: { 'Authorization': `Bearer ${t}` }
    });
    if (!res.ok) throw new Error('Failed to fetch permission issues');
    const json = await res.json();
    return json.data || [];
  }
}

export default new SecurityService();
