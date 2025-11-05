import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';
import securityMonitoringService from '../../services/SecurityMonitoringService';

async function checkConnectorAccess(userId: string, connectorId: string): Promise<boolean> {
  const { data: connector } = await supabaseAdmin
    .schema('enterprise')
    .from('connectors')
    .select('organization_id')
    .eq('id', connectorId)
    .single();

  if (!connector) return false;

  const { data: userRole } = await supabaseAdmin
    .schema('enterprise')
    .from('user_organization_roles')
    .select('role_id')
    .eq('user_id', userId)
    .eq('organization_id', connector.organization_id)
    .single();

  return !!userRole;
}

/**
 * GET /api/connectors/:id/security/user-costs
 * Get top expensive users
 */
export async function getTopExpensiveUsers(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = await securityMonitoringService.getTopExpensiveUsers(connectorId, limit);

    return res.json({ success: true, data: users });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/security/user-costs/:userName
 * Get specific user cost details
 */
export async function getUserCostDetails(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const userName = req.params.userName;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await securityMonitoringService.getUserCostDetails(connectorId, userName);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ success: true, data: user });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/security/access-patterns
 * Get access patterns
 */
export async function getAccessPatterns(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const { userName, eventType, anomaliesOnly, limit } = req.query;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const patterns = await securityMonitoringService.getAccessPatterns(connectorId, {
      userName: userName as string,
      eventType: eventType as string,
      anomaliesOnly: anomaliesOnly === 'true',
      limit: limit ? parseInt(limit as string) : undefined,
    });

    return res.json({ success: true, data: patterns });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/security/anomalies
 * Get detected anomalies
 */
export async function getAnomalies(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const days = parseInt(req.query.days as string) || 30;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const anomalies = await securityMonitoringService.getAnomalies(connectorId, days);

    return res.json({ success: true, data: anomalies });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * POST /api/connectors/:id/security/detect-anomalies
 * Trigger anomaly detection
 */
export async function detectAnomalies(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const lookbackDays = parseInt(req.body.lookbackDays) || 30;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const anomalies = await securityMonitoringService.detectAnomalies(connectorId, lookbackDays);

    return res.json({ success: true, data: anomalies });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/security/permissions
 * Get role permissions
 */
export async function getRolePermissions(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const roleName = req.query.roleName as string;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const permissions = await securityMonitoringService.getRolePermissions(connectorId, roleName);

    return res.json({ success: true, data: permissions });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/security/issues
 * Get security issues summary
 */
export async function getSecurityIssues(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const issues = await securityMonitoringService.getSecurityIssues(connectorId);

    return res.json({ success: true, data: issues });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/security/permission-issues
 * Get permission issues
 */
export async function getPermissionIssues(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const issues = await securityMonitoringService.getPermissionIssues(connectorId);

    return res.json({ success: true, data: issues });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/security/summary
 * Get security monitoring summary
 */
export async function getSecuritySummary(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;

    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const summary = await securityMonitoringService.getSecuritySummary(connectorId);

    return res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('[Security] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
