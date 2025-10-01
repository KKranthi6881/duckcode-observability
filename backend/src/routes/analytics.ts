import { Router, Request, Response } from 'express';
import { auth, AuthenticatedRequest } from '../middleware/auth';
import { supabaseDuckCode } from '../config/supabaseClient';

const router = Router();

// @route   GET /api/analytics/dashboard-summary
// @desc    Get comprehensive dashboard summary with profit tracking
// @access  Private
router.get('/dashboard-summary', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Query the materialized view for fast dashboard loading
    const { data, error } = await supabaseDuckCode
      .from('dashboard_summary')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If no data, return zeros
    if (!data) {
      return res.json({
        today: { conversations: 0, cost: 0, profit: 0, tokens: 0 },
        week: { conversations: 0, cost: 0, profit: 0 },
        month: { conversations: 0, cost: 0, profit: 0 },
        total: { conversations: 0, cost: 0, profit: 0, tokens: 0 },
        avgCostPer1kTokens: 0,
        avgCacheEfficiency: 0
      });
    }

    res.json({
      today: {
        conversations: data.today_conversations || 0,
        cost: parseFloat(data.today_charged_cost || 0),
        profit: parseFloat(data.today_profit || 0),
        tokens: parseInt(data.today_tokens || 0)
      },
      week: {
        conversations: data.week_conversations || 0,
        cost: parseFloat(data.week_charged_cost || 0),
        profit: parseFloat(data.week_profit || 0)
      },
      month: {
        conversations: data.month_conversations || 0,
        cost: parseFloat(data.month_charged_cost || 0),
        profit: parseFloat(data.month_profit || 0)
      },
      total: {
        conversations: data.total_conversations || 0,
        cost: parseFloat(data.total_charged_cost || 0),
        profit: parseFloat(data.total_profit || 0),
        tokens: parseInt(data.total_tokens || 0)
      },
      avgCostPer1kTokens: parseFloat(data.avg_cost_per_1k_tokens || 0),
      avgCacheEfficiency: parseFloat(data.avg_cache_efficiency || 0)
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// @route   GET /api/analytics/conversations
// @desc    Get recent conversations with detailed metrics
// @access  Private
router.get('/conversations', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error } = await supabaseDuckCode
      .from('conversation_analytics_enriched')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Conversations fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// @route   GET /api/analytics/daily-trends
// @desc    Get daily usage trends for charts
// @access  Private
router.get('/daily-trends', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    const { data, error } = await supabaseDuckCode
      .from('daily_conversation_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('usage_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('usage_date', { ascending: true });

    if (error) throw error;

    // Format for charts
    const formatted = (data || []).map(day => ({
      date: day.usage_date,
      charged_cost: parseFloat(day.charged_cost || 0),
      profit_amount: parseFloat(day.profit_amount || 0),
      actual_api_cost: parseFloat(day.actual_api_cost || 0),
      total_tokens_in: parseInt(day.total_tokens_in || 0),
      total_tokens_out: parseInt(day.total_tokens_out || 0),
      total_cache_reads: parseInt(day.total_cache_reads || 0),
      conversations: day.total_conversations || 0
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Daily trends error:', error);
    res.status(500).json({ error: 'Failed to fetch daily trends' });
  }
});

// @route   GET /api/analytics/model-breakdown
// @desc    Get model usage breakdown
// @access  Private
router.get('/model-breakdown', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Aggregate model usage from conversation analytics
    const { data, error } = await supabaseDuckCode
      .rpc('get_model_breakdown', { p_user_id: userId });

    if (error) throw error;

    // Calculate percentages
    const total = (data || []).reduce((sum: number, item: any) => sum + item.conversations, 0);
    const formatted = (data || []).map((item: any) => ({
      model_name: item.model_name,
      conversations: item.conversations,
      percentage: total > 0 ? ((item.conversations / total) * 100).toFixed(1) : 0,
      total_cost: parseFloat(item.total_cost || 0),
      total_tokens: parseInt(item.total_tokens || 0)
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Model breakdown error:', error);
    res.status(500).json({ error: 'Failed to fetch model breakdown' });
  }
});

// @route   POST /api/analytics/conversation/start
// @desc    Start a new conversation tracking
// @access  Private
router.post('/conversation/start', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { conversation_id, topic_title, model_name, provider_name, mode_name, max_context_window } = req.body;

    const { data, error } = await supabaseDuckCode
      .from('conversation_analytics')
      .insert({
        user_id: userId,
        conversation_id,
        topic_title: topic_title || 'New Conversation',
        model_name,
        provider_name,
        mode_name,
        max_context_window,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, conversation: data });
  } catch (error) {
    console.error('Conversation start error:', error);
    res.status(500).json({ error: 'Failed to start conversation tracking' });
  }
});

// @route   POST /api/analytics/conversation/update
// @desc    Update conversation with usage metrics
// @access  Private
router.post('/conversation/update', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      conversation_id,
      total_tokens_in,
      total_tokens_out,
      total_cache_writes,
      total_cache_reads,
      context_tokens,
      actual_api_cost,  // Cost before markup
      charged_cost,     // Cost with 2x markup
      message_count,
      tool_call_count,
      tools_used,
      status,
      avg_response_time_ms
    } = req.body;

    // Calculate profit metrics
    const profit_amount = charged_cost - actual_api_cost;
    const profit_margin = actual_api_cost > 0 ? ((profit_amount / actual_api_cost) * 100) : 100;

    // Calculate context usage percentage
    const { data: existingConv } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('max_context_window')
      .eq('user_id', userId)
      .eq('conversation_id', conversation_id)
      .single();

    const context_usage_percentage = existingConv && existingConv.max_context_window > 0
      ? (context_tokens / existingConv.max_context_window) * 100
      : 0;

    const { data, error } = await supabaseDuckCode
      .from('conversation_analytics')
      .update({
        total_tokens_in,
        total_tokens_out,
        total_cache_writes,
        total_cache_reads,
        context_tokens,
        actual_api_cost,
        charged_cost,
        profit_amount,
        profit_margin,
        message_count,
        tool_call_count,
        tools_used,
        status: status || 'active',
        context_usage_percentage,
        avg_response_time_ms,
        ended_at: status === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('conversation_id', conversation_id)
      .select()
      .single();

    if (error) throw error;

    // Refresh dashboard summary for real-time updates
    await supabaseDuckCode.rpc('refresh_dashboard_summary');

    res.json({ success: true, conversation: data });
  } catch (error) {
    console.error('Conversation update error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data as CSV
// @access  Private
router.get('/export', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const format = req.query.format || 'csv';

    const { data, error } = await supabaseDuckCode
      .from('conversation_analytics_enriched')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false });

    if (error) throw error;

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'Date', 'Topic', 'Model', 'Tokens In', 'Tokens Out', 'Cache Reads',
        'API Cost', 'Charged Cost', 'Profit', 'Profit Margin %', 'Context Usage %'
      ];
      
      const rows = (data || []).map(conv => [
        new Date(conv.started_at).toLocaleDateString(),
        conv.topic_title,
        conv.model_name,
        conv.total_tokens_in,
        conv.total_tokens_out,
        conv.total_cache_reads,
        conv.actual_api_cost,
        conv.charged_cost,
        conv.profit_amount,
        conv.profit_margin,
        conv.context_usage_percentage
      ]);

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.csv');
      res.send(csv);
    } else {
      res.json(data);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

export default router;
