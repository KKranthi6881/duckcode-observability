import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import snowflakeRecommendationEngine from '../../services/recommendations/SnowflakeRecommendationEngine';
import roiTrackingService from '../../services/recommendations/ROITrackingService';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Helper to check if user has admin access to connector's organization
async function checkConnectorAccess(userId: string, connectorId: string): Promise<boolean> {
  const { data: connector } = await supabase
    .schema('enterprise')
    .from('connectors')
    .select('organization_id')
    .eq('id', connectorId)
    .single();

  if (!connector) return false;

  const { data: userRole } = await supabase
    .schema('enterprise')
    .from('user_organization_roles')
    .select('role_id')
    .eq('user_id', userId)
    .eq('organization_id', connector.organization_id)
    .single();

  return !!userRole;
}

/**
 * GET /api/connectors/:id/recommendations
 * List all recommendations with optional filters
 */
export async function listRecommendations(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const { status, priority, type } = req.query;

    // Check access
    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build query
    let query = supabase
      .schema('enterprise')
      .from('snowflake_recommendations')
      .select('*')
      .eq('connector_id', connectorId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (priority) query = query.eq('priority', priority);
    if (type) query = query.eq('type', type);

    const { data, error } = await query;

    if (error) {
      console.error('[Recommendations] Error fetching recommendations:', error);
      return res.status(500).json({ error: 'Failed to fetch recommendations' });
    }

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error('[Recommendations] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/recommendations/summary
 * Get summary of recommendations (counts by status, priority, total savings)
 */
export async function getRecommendationsSummary(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;

    // Check access
    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get all recommendations
    const { data: recommendations, error } = await supabase
      .schema('enterprise')
      .from('snowflake_recommendations')
      .select('status, priority, estimated_monthly_savings_usd')
      .eq('connector_id', connectorId);

    if (error) {
      console.error('[Recommendations] Error fetching summary:', error);
      return res.status(500).json({ error: 'Failed to fetch summary' });
    }

    // Calculate summary
    const summary = {
      total: recommendations?.length || 0,
      by_status: {
        pending: 0,
        applied: 0,
        dismissed: 0,
        failed: 0,
        expired: 0,
      },
      by_priority: {
        high: 0,
        medium: 0,
        low: 0,
      },
      total_potential_savings: 0,
      applied_savings: 0,
    };

    recommendations?.forEach((rec: any) => {
      summary.by_status[rec.status as keyof typeof summary.by_status]++;
      summary.by_priority[rec.priority as keyof typeof summary.by_priority]++;
      
      if (rec.status === 'pending') {
        summary.total_potential_savings += rec.estimated_monthly_savings_usd || 0;
      } else if (rec.status === 'applied') {
        summary.applied_savings += rec.estimated_monthly_savings_usd || 0;
      }
    });

    return res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('[Recommendations] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * POST /api/connectors/:id/recommendations/:recommendationId/apply
 * Apply a recommendation (execute SQL commands)
 */
export async function applyRecommendation(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const recommendationId = req.params.recommendationId;

    // Check access
    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get connector config to establish Snowflake connection
    const { data: connector, error: connectorError } = await supabase
      .schema('enterprise')
      .from('connectors')
      .select('config')
      .eq('id', connectorId)
      .single();

    if (connectorError || !connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    // Create Snowflake connection
    const snowflake = require('snowflake-sdk');
    const connection = snowflake.createConnection(connector.config);

    await new Promise((resolve, reject) => {
      connection.connect((err: any) => {
        if (err) reject(err);
        else resolve(null);
      });
    });

    try {
      // Apply recommendation
      await snowflakeRecommendationEngine.applyRecommendation(
        recommendationId,
        userId,
        connection
      );

      return res.json({ 
        success: true, 
        message: 'Recommendation applied successfully' 
      });
    } finally {
      connection.destroy(() => {});
    }
  } catch (error: any) {
    console.error('[Recommendations] Error applying:', error);
    return res.status(500).json({ error: error.message || 'Failed to apply recommendation' });
  }
}

/**
 * PUT /api/connectors/:id/recommendations/:recommendationId/dismiss
 * Dismiss a recommendation
 */
export async function dismissRecommendation(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;
    const recommendationId = req.params.recommendationId;
    const { reason } = req.body;

    // Check access
    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update recommendation status
    const { error: updateError } = await supabase
      .schema('enterprise')
      .from('snowflake_recommendations')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
        dismissed_by: userId,
        dismissal_reason: reason,
      })
      .eq('id', recommendationId)
      .eq('connector_id', connectorId);

    if (updateError) {
      console.error('[Recommendations] Error dismissing:', updateError);
      return res.status(500).json({ error: 'Failed to dismiss recommendation' });
    }

    // Log action
    await supabase
      .schema('enterprise')
      .from('snowflake_recommendation_actions')
      .insert({
        recommendation_id: recommendationId,
        action_type: 'dismissed',
        user_id: userId,
        action_details: { reason },
      });

    return res.json({ success: true, message: 'Recommendation dismissed' });
  } catch (error: any) {
    console.error('[Recommendations] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * GET /api/connectors/:id/roi
 * Get ROI summary and breakdown
 */
export async function getROI(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;

    // Check access
    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get ROI summary and breakdown
    const [summary, breakdown] = await Promise.all([
      roiTrackingService.getROISummary(connectorId),
      roiTrackingService.getROIBreakdown(connectorId),
    ]);

    return res.json({
      success: true,
      data: {
        summary,
        breakdown,
      },
    });
  } catch (error: any) {
    console.error('[Recommendations] Error getting ROI:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch ROI data' });
  }
}

/**
 * POST /api/connectors/:id/recommendations/generate
 * Manually trigger recommendation generation
 */
export async function generateRecommendations(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const connectorId = req.params.id;

    // Check access
    const hasAccess = await checkConnectorAccess(userId, connectorId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get organization ID
    const { data: connector } = await supabase
      .schema('enterprise')
      .from('connectors')
      .select('organization_id')
      .eq('id', connectorId)
      .single();

    if (!connector) {
      return res.status(404).json({ error: 'Connector not found' });
    }

    // Generate recommendations
    await snowflakeRecommendationEngine.generateRecommendations(
      connectorId,
      connector.organization_id
    );

    return res.json({ 
      success: true, 
      message: 'Recommendations generated successfully' 
    });
  } catch (error: any) {
    console.error('[Recommendations] Error generating:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate recommendations' });
  }
}
