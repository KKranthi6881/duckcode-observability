import { createClient } from '@supabase/supabase-js';

export interface UserCost {
  user_name: string;
  total_queries: number;
  total_cost_usd: number;
  compute_cost_usd: number;
  storage_accessed_bytes: number;
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
  database_name?: string;
  schema_name?: string;
  object_name?: string;
  is_anomaly: boolean;
  anomaly_reason?: string;
  risk_score?: number;
  event_timestamp: string;
}

export interface RolePermission {
  role_name: string;
  grantee_name: string;
  privilege: string;
  granted_on: string;
  object_name: string;
  is_excessive: boolean;
  is_unused: boolean;
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

export class SecurityMonitoringService {
  private supabase;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Get top expensive users
   */
  async getTopExpensiveUsers(connectorId: string, limit: number = 20): Promise<UserCost[]> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('v_top_expensive_users')
      .select('*')
      .eq('connector_id', connectorId)
      .order('total_cost_usd', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SecurityService] Error fetching top users:', error);
      throw new Error(`Failed to fetch top users: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get user cost details
   */
  async getUserCostDetails(connectorId: string, userName: string): Promise<UserCost | null> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('v_top_expensive_users')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('user_name', userName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[SecurityService] Error fetching user details:', error);
      throw new Error(`Failed to fetch user details: ${error.message}`);
    }

    return data;
  }

  /**
   * Get access patterns
   */
  async getAccessPatterns(
    connectorId: string,
    options: {
      userName?: string;
      eventType?: string;
      anomaliesOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<AccessPattern[]> {
    let query = this.supabase
      .schema('enterprise')
      .from('snowflake_access_patterns')
      .select('*')
      .eq('connector_id', connectorId);

    if (options.userName) {
      query = query.eq('user_name', options.userName);
    }

    if (options.eventType) {
      query = query.eq('event_type', options.eventType);
    }

    if (options.anomaliesOnly) {
      query = query.eq('is_anomaly', true);
    }

    query = query.order('event_timestamp', { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SecurityService] Error fetching access patterns:', error);
      throw new Error(`Failed to fetch access patterns: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get anomalous access patterns
   */
  async getAnomalies(connectorId: string, days: number = 30): Promise<AccessPattern[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_access_patterns')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('is_anomaly', true)
      .gte('event_timestamp', startDate.toISOString())
      .order('risk_score', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[SecurityService] Error fetching anomalies:', error);
      throw new Error(`Failed to fetch anomalies: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Detect access anomalies
   */
  async detectAnomalies(connectorId: string, lookbackDays: number = 30): Promise<any[]> {
    const { data, error } = await this.supabase
      .rpc('detect_access_anomalies', {
        p_connector_id: connectorId,
        p_lookback_days: lookbackDays,
      });

    if (error) {
      console.error('[SecurityService] Error detecting anomalies:', error);
      throw new Error(`Failed to detect anomalies: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get role permissions
   */
  async getRolePermissions(connectorId: string, roleName?: string): Promise<RolePermission[]> {
    let query = this.supabase
      .schema('enterprise')
      .from('snowflake_role_permissions')
      .select('*')
      .eq('connector_id', connectorId);

    if (roleName) {
      query = query.eq('role_name', roleName);
    }

    query = query.order('role_name');

    const { data, error } = await query;

    if (error) {
      console.error('[SecurityService] Error fetching permissions:', error);
      throw new Error(`Failed to fetch permissions: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get security issues summary
   */
  async getSecurityIssues(connectorId: string): Promise<SecurityIssue[]> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('v_security_issues')
      .select('*')
      .eq('connector_id', connectorId)
      .order('severity', { ascending: false });

    if (error) {
      console.error('[SecurityService] Error fetching security issues:', error);
      throw new Error(`Failed to fetch security issues: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get permission issues (over-permissioned or unused)
   */
  async getPermissionIssues(connectorId: string): Promise<RolePermission[]> {
    const { data, error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_role_permissions')
      .select('*')
      .eq('connector_id', connectorId)
      .or('is_excessive.eq.true,is_unused.eq.true')
      .order('role_name');

    if (error) {
      console.error('[SecurityService] Error fetching permission issues:', error);
      throw new Error(`Failed to fetch permission issues: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get security summary
   */
  async getSecuritySummary(connectorId: string): Promise<SecuritySummary> {
    const [topUsers, issues, anomalies, permissionIssues] = await Promise.all([
      this.getTopExpensiveUsers(connectorId, 1),
      this.getSecurityIssues(connectorId),
      this.getAnomalies(connectorId, 30),
      this.getPermissionIssues(connectorId),
    ]);

    const totalCost = topUsers.reduce((sum, user) => sum + user.total_cost_usd, 0);
    const topSpender = topUsers[0];

    const overPermissionedCount = issues.find(i => i.issue_type === 'over_permissioned_role')?.issue_count || 0;
    const unusedPermissionsCount = issues.find(i => i.issue_type === 'unused_permission')?.issue_count || 0;

    return {
      total_users: topUsers.length,
      total_cost: totalCost,
      top_spender: topSpender?.user_name || 'N/A',
      top_spender_cost: topSpender?.total_cost_usd || 0,
      security_issues_count: issues.reduce((sum, issue) => sum + issue.issue_count, 0),
      anomalies_count: anomalies.length,
      over_permissioned_roles: overPermissionedCount,
      unused_permissions: unusedPermissionsCount,
    };
  }

  /**
   * Log access pattern (for ingestion)
   */
  async logAccessPattern(
    connectorId: string,
    organizationId: string,
    pattern: Partial<AccessPattern>
  ): Promise<void> {
    const { error } = await this.supabase
      .schema('enterprise')
      .from('snowflake_access_patterns')
      .insert({
        connector_id: connectorId,
        organization_id: organizationId,
        ...pattern,
      });

    if (error) {
      console.error('[SecurityService] Error logging access pattern:', error);
      throw new Error(`Failed to log access pattern: ${error.message}`);
    }
  }
}

export default new SecurityMonitoringService();
