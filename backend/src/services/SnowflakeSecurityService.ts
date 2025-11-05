/**
 * Snowflake Security Monitoring Service
 * 
 * Extracts and analyzes security data from Snowflake ACCOUNT_USAGE:
 * - Login history and authentication
 * - User and role management
 * - Network policies
 * - Data access patterns
 * - Security alerts and anomalies
 */

import { createClient } from '@supabase/supabase-js';
import { SnowflakeConnector } from './connectors/SnowflakeConnector';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SecurityExtractionResult {
  login_events: number;
  user_roles: number;
  role_privileges: number;
  network_policies: number;
  access_events: number;
  security_alerts: number;
  stale_users: number;
}

export class SnowflakeSecurityService {
  private supabase = createClient(supabaseUrl, supabaseKey);

  /**
   * Extract all security data for a connector
   */
  async extractSecurityData(connectorId: string): Promise<SecurityExtractionResult> {
    console.log(`[SecurityService] Starting security extraction for connector ${connectorId}`);

    const results: SecurityExtractionResult = {
      login_events: 0,
      user_roles: 0,
      role_privileges: 0,
      network_policies: 0,
      access_events: 0,
      security_alerts: 0,
      stale_users: 0,
    };

    try {
      // Get connector details
      const { data: connector } = await this.supabase
        .schema('enterprise')
        .from('connectors')
        .select('*')
        .eq('id', connectorId)
        .single();

      if (!connector) {
        throw new Error(`Connector ${connectorId} not found`);
      }

      // Extract each security component
      results.login_events = await this.extractLoginHistory(connectorId, connector);
      results.user_roles = await this.extractUserRoleGrants(connectorId, connector);
      results.role_privileges = await this.extractRolePrivilegeGrants(connectorId, connector);
      results.network_policies = await this.extractNetworkPolicies(connectorId, connector);
      results.access_events = await this.extractAccessHistory(connectorId, connector);
      
      // Analyze and create security alerts
      results.stale_users = await this.detectStaleUsers(connectorId);
      results.security_alerts = await this.generateSecurityAlerts(connectorId);

      console.log('[SecurityService] Extraction complete:', results);
      return results;
    } catch (error) {
      console.error('[SecurityService] Extraction error:', error);
      throw error;
    }
  }

  /**
   * Extract login history (last 90 days)
   */
  private async extractLoginHistory(connectorId: string, connector: any): Promise<number> {
    console.log('[SecurityService] Extracting login history...');

    // TODO: Execute actual Snowflake query
    // For now, return placeholder
    const query = `
      SELECT
        event_id,
        event_timestamp,
        event_type,
        user_name,
        client_ip,
        reported_client_type,
        reported_client_version,
        first_authentication_factor,
        second_authentication_factor,
        is_success,
        error_code,
        error_message,
        connection,
        related_event_id
      FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
      WHERE event_timestamp >= DATEADD('day', -90, CURRENT_TIMESTAMP())
      ORDER BY event_timestamp DESC
      LIMIT 10000;
    `;

    console.log('[SecurityService] TODO: Execute login history query');
    console.log('[SecurityService] Query:', query);

    // Placeholder: Insert mock data or wait for Snowflake integration
    return 0;
  }

  /**
   * Extract user role grants (GRANTS_TO_USERS)
   */
  private async extractUserRoleGrants(connectorId: string, connector: any): Promise<number> {
    console.log('[SecurityService] Extracting user role grants...');

    const query = `
      SELECT
        created_on,
        role,
        role_owner,
        grantee_name,
        granted_by,
        granted_on
      FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
      WHERE deleted_on IS NULL
      ORDER BY created_on DESC;
    `;

    console.log('[SecurityService] TODO: Execute user role grants query');
    return 0;
  }

  /**
   * Extract role privilege grants (GRANTS_TO_ROLES)
   */
  private async extractRolePrivilegeGrants(connectorId: string, connector: any): Promise<number> {
    console.log('[SecurityService] Extracting role privilege grants...');

    const query = `
      SELECT
        created_on,
        role,
        privilege,
        granted_on,
        granted_on_type,
        granted_by,
        grant_option
      FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
      WHERE deleted_on IS NULL
      ORDER BY created_on DESC;
    `;

    console.log('[SecurityService] TODO: Execute role privilege grants query');
    return 0;
  }

  /**
   * Extract network policies
   */
  private async extractNetworkPolicies(connectorId: string, connector: any): Promise<number> {
    console.log('[SecurityService] Extracting network policies...');

    const query = `
      SELECT
        name,
        created_on,
        owner,
        comment,
        allowed_ip_list,
        blocked_ip_list
      FROM SNOWFLAKE.ACCOUNT_USAGE.NETWORK_POLICIES
      WHERE deleted_on IS NULL;
    `;

    console.log('[SecurityService] TODO: Execute network policies query');
    return 0;
  }

  /**
   * Extract access history (last 30 days)
   */
  private async extractAccessHistory(connectorId: string, connector: any): Promise<number> {
    console.log('[SecurityService] Extracting access history...');

    const query = `
      SELECT
        query_id,
        query_start_time,
        user_name,
        direct_objects_accessed,
        base_objects_accessed,
        objects_modified
      FROM SNOWFLAKE.ACCOUNT_USAGE.ACCESS_HISTORY
      WHERE query_start_time >= DATEADD('day', -30, CURRENT_TIMESTAMP())
      ORDER BY query_start_time DESC
      LIMIT 5000;
    `;

    console.log('[SecurityService] TODO: Execute access history query');
    return 0;
  }

  /**
   * Detect stale users (haven't logged in for 90+ days)
   */
  private async detectStaleUsers(connectorId: string): Promise<number> {
    console.log('[SecurityService] Detecting stale users...');

    const query = `
      WITH last_logins AS (
        SELECT
          user_name,
          MAX(event_timestamp) as last_login_date,
          DATEDIFF('day', MAX(event_timestamp), CURRENT_TIMESTAMP()) as days_since_login
        FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
        WHERE is_success = TRUE
        GROUP BY user_name
      ),
      user_roles AS (
        SELECT
          grantee_name,
          ARRAY_AGG(role) as assigned_roles,
          MAX(CASE WHEN role IN ('ACCOUNTADMIN', 'SECURITYADMIN') THEN TRUE ELSE FALSE END) as has_admin_role
        FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
        WHERE deleted_on IS NULL
        GROUP BY grantee_name
      )
      SELECT
        l.user_name,
        l.last_login_date,
        l.days_since_login,
        COALESCE(r.assigned_roles, ARRAY_CONSTRUCT()) as assigned_roles,
        COALESCE(r.has_admin_role, FALSE) as has_admin_role,
        CASE
          WHEN l.days_since_login > 180 AND r.has_admin_role THEN 'high'
          WHEN l.days_since_login > 180 THEN 'medium'
          WHEN l.days_since_login > 90 THEN 'low'
        END as risk_level,
        CASE
          WHEN l.days_since_login > 180 THEN 'remove'
          WHEN l.days_since_login > 90 THEN 'disable'
          ELSE 'monitor'
        END as recommended_action
      FROM last_logins l
      LEFT JOIN user_roles r ON l.user_name = r.grantee_name
      WHERE l.days_since_login >= 90
      ORDER BY l.days_since_login DESC, r.has_admin_role DESC;
    `;

    console.log('[SecurityService] TODO: Execute stale users detection');
    return 0;
  }

  /**
   * Generate security alerts based on analysis
   */
  private async generateSecurityAlerts(connectorId: string): Promise<number> {
    console.log('[SecurityService] Generating security alerts...');

    let alertCount = 0;

    // Check for users without MFA
    alertCount += await this.checkMissingMFA(connectorId);

    // Check for failed login attempts
    alertCount += await this.checkFailedLogins(connectorId);

    // Check for ACCOUNTADMIN usage
    alertCount += await this.checkAdminAccess(connectorId);

    // Check for over-privileged roles
    alertCount += await this.checkOverPrivilegedRoles(connectorId);

    return alertCount;
  }

  /**
   * Check for users without MFA
   */
  private async checkMissingMFA(connectorId: string): Promise<number> {
    const query = `
      SELECT
        user_name,
        first_authentication_factor,
        COUNT(*) as login_count
      FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
      WHERE first_authentication_factor = 'PASSWORD'
        AND is_success = TRUE
        AND event_timestamp >= DATEADD('day', -30, CURRENT_TIMESTAMP())
      GROUP BY user_name, first_authentication_factor
      HAVING COUNT(*) > 5; -- Users with multiple password-only logins
    `;

    console.log('[SecurityService] TODO: Check for missing MFA');
    return 0;
  }

  /**
   * Check for excessive failed login attempts
   */
  private async checkFailedLogins(connectorId: string): Promise<number> {
    const query = `
      SELECT
        user_name,
        client_ip,
        COUNT(*) as failed_logins,
        MAX(event_timestamp) as last_attempt
      FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
      WHERE is_success = FALSE
        AND error_message LIKE '%LOGIN_FAILED%'
        AND event_timestamp >= DATEADD('day', -7, CURRENT_TIMESTAMP())
      GROUP BY user_name, client_ip
      HAVING COUNT(*) >= 10 -- 10+ failed attempts
      ORDER BY failed_logins DESC;
    `;

    console.log('[SecurityService] TODO: Check for failed logins');
    return 0;
  }

  /**
   * Check ACCOUNTADMIN and SECURITYADMIN usage
   */
  private async checkAdminAccess(connectorId: string): Promise<number> {
    const query = `
      SELECT
        grantee_name as user_name,
        role,
        granted_on as grant_date,
        granted_by
      FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
      WHERE role IN ('ACCOUNTADMIN', 'SECURITYADMIN')
        AND deleted_on IS NULL
      ORDER BY granted_on DESC;
    `;

    console.log('[SecurityService] TODO: Check admin access');
    return 0;
  }

  /**
   * Check for over-privileged roles
   */
  private async checkOverPrivilegedRoles(connectorId: string): Promise<number> {
    const query = `
      SELECT
        role,
        COUNT(DISTINCT privilege) AS num_privileges,
        COUNT(DISTINCT granted_on) AS num_objects
      FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
      WHERE role NOT IN ('PUBLIC', 'SYSADMIN', 'ACCOUNTADMIN', 'SECURITYADMIN')
        AND deleted_on IS NULL
      GROUP BY role
      HAVING COUNT(DISTINCT privilege) > 10 -- Roles with 10+ privileges
      ORDER BY num_privileges DESC;
    `;

    console.log('[SecurityService] TODO: Check over-privileged roles');
    return 0;
  }

  /**
   * Get security dashboard summary
   */
  async getSecuritySummary(connectorId: string): Promise<any> {
    const { data: summary } = await this.supabase
      .schema('enterprise')
      .from('snowflake_security_alerts')
      .select('alert_type, severity, status')
      .eq('connector_id', connectorId);

    const { data: staleUsers } = await this.supabase
      .schema('enterprise')
      .from('snowflake_stale_users')
      .select('risk_level')
      .eq('connector_id', connectorId);

    const { data: failedLogins } = await this.supabase
      .schema('enterprise')
      .from('snowflake_login_history')
      .select('user_name')
      .eq('connector_id', connectorId)
      .eq('is_success', false)
      .gte('event_timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    return {
      alerts: {
        critical: summary?.filter(a => a.severity === 'critical' && a.status === 'open').length || 0,
        high: summary?.filter(a => a.severity === 'high' && a.status === 'open').length || 0,
        medium: summary?.filter(a => a.severity === 'medium' && a.status === 'open').length || 0,
        low: summary?.filter(a => a.severity === 'low' && a.status === 'open').length || 0,
      },
      stale_users: {
        high_risk: staleUsers?.filter(u => u.risk_level === 'high').length || 0,
        medium_risk: staleUsers?.filter(u => u.risk_level === 'medium').length || 0,
        low_risk: staleUsers?.filter(u => u.risk_level === 'low').length || 0,
      },
      failed_logins_last_week: failedLogins?.length || 0,
    };
  }
}

export default new SnowflakeSecurityService();
