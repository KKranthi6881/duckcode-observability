import { Request, Response } from 'express';
import { supabaseDuckCode as supabaseAdmin } from '../../config/supabase';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Get analytics summary for the logged-in user
 */
export async function getUserSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's conversation analytics
    const { data: conversations, error } = await supabaseAdmin
      .schema('duckcode')
      .from('conversation_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    // Calculate totals
    const totals = {
      total_cost: conversations?.reduce((sum, c) => sum + parseFloat(c.total_cost || 0), 0) || 0,
      conversations: conversations?.length || 0,
      tokens_in: conversations?.reduce((sum, c) => sum + (c.total_tokens_in || 0), 0) || 0,
      tokens_out: conversations?.reduce((sum, c) => sum + (c.total_tokens_out || 0), 0) || 0,
      total_tokens: 0,
    };
    totals.total_tokens = totals.tokens_in + totals.tokens_out;

    res.json({ totals });
  } catch (error) {
    console.error('getUserSummary error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * Get daily cost trends for the logged-in user
 */
export async function getUserTrends(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's daily aggregated data
    const { data: trends, error } = await supabaseAdmin
      .schema('duckcode')
      .from('conversation_analytics')
      .select('created_at, total_cost, total_tokens_in, total_tokens_out')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching user trends:', error);
      return res.status(500).json({ error: 'Failed to fetch trends' });
    }

    // Group by date
    const dailyData: Record<string, { date: string; total_cost: number; tokens: number; conversations: number }> = {};
    
    trends?.forEach(trend => {
      const date = new Date(trend.created_at).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { date, total_cost: 0, tokens: 0, conversations: 0 };
      }
      dailyData[date].total_cost += parseFloat(trend.total_cost || 0);
      dailyData[date].tokens += (trend.total_tokens_in || 0) + (trend.total_tokens_out || 0);
      dailyData[date].conversations += 1;
    });

    const trendsArray = Object.values(dailyData).map(d => ({
      usage_date: d.date,
      total_cost: d.total_cost,
      tokens: d.tokens,
      conversations: d.conversations,
    }));

    res.json({ trends: trendsArray });
  } catch (error) {
    console.error('getUserTrends error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * Get model breakdown for the logged-in user
 */
export async function getUserModelBreakdown(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get user's conversations
    const { data: conversations, error } = await supabaseAdmin
      .schema('duckcode')
      .from('conversation_analytics')
      .select('model_name, total_cost, total_tokens_in, total_tokens_out')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Error fetching user model breakdown:', error);
      return res.status(500).json({ error: 'Failed to fetch model breakdown' });
    }

    // Group by model
    const modelMap: Record<string, { model: string; cost: number; tokens: number; conversations: number }> = {};
    
    conversations?.forEach(conv => {
      const model = conv.model_name || 'unknown';
      if (!modelMap[model]) {
        modelMap[model] = { model, cost: 0, tokens: 0, conversations: 0 };
      }
      modelMap[model].cost += parseFloat(conv.total_cost || 0);
      modelMap[model].tokens += (conv.total_tokens_in || 0) + (conv.total_tokens_out || 0);
      modelMap[model].conversations += 1;
    });

    const models = Object.values(modelMap).sort((a, b) => b.cost - a.cost);

    res.json({ models });
  } catch (error) {
    console.error('getUserModelBreakdown error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * Get recent conversations for the logged-in user
 */
export async function getUserRecentConversations(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { data: conversations, error } = await supabaseAdmin
      .schema('duckcode')
      .from('conversation_analytics')
      .select('conversation_id, topic_title, model_name, total_cost, total_tokens_in, total_tokens_out, created_at, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent conversations:', error);
      return res.status(500).json({ error: 'Failed to fetch conversations' });
    }

    res.json({ conversations: conversations || [] });
  } catch (error) {
    console.error('getUserRecentConversations error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * Export user analytics data
 */
export async function exportUserAnalytics(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all user conversations
    const { data: conversations, error } = await supabaseAdmin
      .schema('duckcode')
      .from('conversation_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error exporting user analytics:', error);
      return res.status(500).json({ error: 'Failed to export analytics' });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="my-analytics-${timestamp}.json"`);
    res.json({
      exported_at: new Date().toISOString(),
      period_days: days,
      user_id: userId,
      conversations: conversations || [],
    });
  } catch (error) {
    console.error('exportUserAnalytics error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
