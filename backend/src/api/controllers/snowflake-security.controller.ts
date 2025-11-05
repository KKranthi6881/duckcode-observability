import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import SnowflakeSecurityService from '../../services/SnowflakeSecurityService';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

/**
 * Get security summary for dashboard
 */
export async function getSecuritySummary(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;

    // Get organization from connector
    const { data: connector } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('organization_id')
      .eq('id', connectorId)
      .single();

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    // Check user has access to this organization
    const { data: membership } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', connector.organization_id)
      .single();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const summary = await SnowflakeSecurityService.getSecuritySummary(connectorId);
    res.json(summary);
  } catch (error) {
    console.error('[SecurityController] Error getting summary:', error);
    res.status(500).json({ error: 'Failed to get security summary' });
  }
}

/**
 * Get security alerts
 */
export async function getSecurityAlerts(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const status = req.query.status as string || 'open';
    const severity = req.query.severity as string;

    let query = supabaseAdmin
      .schema('enterprise')
      .from('snowflake_security_alerts')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('status', status)
      .order('severity', { ascending: false })
      .order('detected_at', { ascending: false });

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: alerts, error } = await query;

    if (error) {
      console.error('[SecurityController] Error getting alerts:', error);
      return res.status(500).json({ error: 'Failed to get alerts' });
    }

    res.json(alerts || []);
  } catch (error) {
    console.error('[SecurityController] Error getting alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
}

/**
 * Get stale users
 */
export async function getStaleUsers(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const riskLevel = req.query.risk_level as string;

    let query = supabaseAdmin
      .schema('enterprise')
      .from('snowflake_stale_users')
      .select('*')
      .eq('connector_id', connectorId)
      .order('risk_level', { ascending: false })
      .order('days_since_login', { ascending: false });

    if (riskLevel) {
      query = query.eq('risk_level', riskLevel);
    }

    const { data: staleUsers, error } = await query;

    if (error) {
      console.error('[SecurityController] Error getting stale users:', error);
      return res.status(500).json({ error: 'Failed to get stale users' });
    }

    res.json(staleUsers || []);
  } catch (error) {
    console.error('[SecurityController] Error getting stale users:', error);
    res.status(500).json({ error: 'Failed to get stale users' });
  }
}

/**
 * Get failed login attempts
 */
export async function getFailedLogins(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const days = parseInt(req.query.days as string) || 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: failedLogins, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_login_history')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('is_success', false)
      .gte('event_timestamp', startDate.toISOString())
      .order('event_timestamp', { ascending: false });

    if (error) {
      console.error('[SecurityController] Error getting failed logins:', error);
      return res.status(500).json({ error: 'Failed to get failed logins' });
    }

    res.json(failedLogins || []);
  } catch (error) {
    console.error('[SecurityController] Error getting failed logins:', error);
    res.status(500).json({ error: 'Failed to get failed logins' });
  }
}

/**
 * Get login history
 */
export async function getLoginHistory(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;
    const userName = req.query.user_name as string;
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabaseAdmin
      .schema('enterprise')
      .from('snowflake_login_history')
      .select('*')
      .eq('connector_id', connectorId)
      .gte('event_timestamp', startDate.toISOString())
      .order('event_timestamp', { ascending: false })
      .limit(1000);

    if (userName) {
      query = query.eq('user_name', userName);
    }

    const { data: loginHistory, error } = await query;

    if (error) {
      console.error('[SecurityController] Error getting login history:', error);
      return res.status(500).json({ error: 'Failed to get login history' });
    }

    res.json(loginHistory || []);
  } catch (error) {
    console.error('[SecurityController] Error getting login history:', error);
    res.status(500).json({ error: 'Failed to get login history' });
  }
}

/**
 * Get users without MFA
 */
export async function getUsersWithoutMFA(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;

    // Get users who logged in with PASSWORD only (no MFA)
    const { data: logins, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_login_history')
      .select('user_name, first_authentication_factor')
      .eq('connector_id', connectorId)
      .eq('first_authentication_factor', 'PASSWORD')
      .eq('is_success', true)
      .gte('event_timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('[SecurityController] Error getting users without MFA:', error);
      return res.status(500).json({ error: 'Failed to get users without MFA' });
    }

    // Count logins per user
    const userCounts = (logins || []).reduce((acc: any, login: any) => {
      acc[login.user_name] = (acc[login.user_name] || 0) + 1;
      return acc;
    }, {});

    // Filter users with 5+ password-only logins
    const usersWithoutMFA = Object.entries(userCounts)
      .filter(([_, count]) => (count as number) >= 5)
      .map(([user_name, login_count]) => ({ user_name, login_count }));

    res.json(usersWithoutMFA);
  } catch (error) {
    console.error('[SecurityController] Error getting users without MFA:', error);
    res.status(500).json({ error: 'Failed to get users without MFA' });
  }
}

/**
 * Get admin role assignments
 */
export async function getAdminAccess(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;

    const { data: adminGrants, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_user_role_grants')
      .select('*')
      .eq('connector_id', connectorId)
      .in('role_name', ['ACCOUNTADMIN', 'SECURITYADMIN'])
      .order('granted_on', { ascending: false });

    if (error) {
      console.error('[SecurityController] Error getting admin access:', error);
      return res.status(500).json({ error: 'Failed to get admin access' });
    }

    res.json(adminGrants || []);
  } catch (error) {
    console.error('[SecurityController] Error getting admin access:', error);
    res.status(500).json({ error: 'Failed to get admin access' });
  }
}

/**
 * Trigger security data extraction
 */
export async function extractSecurityData(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const connectorId = req.params.id;

    // Check user is admin
    const { data: connector } = await supabaseAdmin
      .schema('enterprise')
      .from('connectors')
      .select('organization_id')
      .eq('id', connectorId)
      .single();

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    const { data: membership } = await supabaseAdmin
      .schema('enterprise')
      .from('user_organization_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', connector.organization_id)
      .single();

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Trigger extraction (runs async)
    SnowflakeSecurityService.extractSecurityData(connectorId)
      .catch(err => console.error('[SecurityController] Extraction error:', err));

    res.json({ 
      message: 'Security data extraction started',
      connector_id: connectorId 
    });
  } catch (error) {
    console.error('[SecurityController] Error starting extraction:', error);
    res.status(500).json({ error: 'Failed to start extraction' });
  }
}

/**
 * Resolve a security alert
 */
export async function resolveAlert(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const alertId = req.params.alertId;
    const { status, resolution_notes } = req.body;

    const { data: alert, error } = await supabaseAdmin
      .schema('enterprise')
      .from('snowflake_security_alerts')
      .update({
        status,
        resolution_notes,
        resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        resolved_by: status === 'resolved' ? userId : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      console.error('[SecurityController] Error resolving alert:', error);
      return res.status(500).json({ error: 'Failed to resolve alert' });
    }

    res.json(alert);
  } catch (error) {
    console.error('[SecurityController] Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
}
