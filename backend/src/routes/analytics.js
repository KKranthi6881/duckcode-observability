const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware to verify authentication
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// POST /api/analytics/chat_messages - Store chat message analytics
router.post('/chat_messages', authenticateUser, async (req, res) => {
  try {
    const { events } = req.body;
    const userId = req.user.id;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    // Process each chat message event
    const processedEvents = events.map(event => ({
      user_id: userId,
      session_id: event.sessionId,
      message_type: event.messageType,
      content: event.content,
      input_tokens: event.inputTokens || 0,
      output_tokens: event.outputTokens || 0,
      model_name: event.modelName,
      response_time_ms: event.responseTimeMs,
      cost: event.cost || 0,
      tool_calls: event.toolCalls || [],
      metadata: event.metadata || {},
      created_at: event.timestamp || new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('duckcode.chat_messages')
      .insert(processedEvents);

    if (error) {
      console.error('Error inserting chat messages:', error);
      return res.status(500).json({ error: 'Failed to store chat messages' });
    }

    res.json({ success: true, inserted: processedEvents.length });
  } catch (error) {
    console.error('Chat messages endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/analytics/chat_sessions - Store chat session analytics
router.post('/chat_sessions', authenticateUser, async (req, res) => {
  try {
    const { events } = req.body;
    const userId = req.user.id;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const processedEvents = events.map(event => ({
      user_id: userId,
      session_id: event.id,
      topic: event.topic,
      model_name: event.modelName,
      started_at: event.startedAt,
      ended_at: event.endedAt,
      total_messages: event.totalMessages || 0,
      total_input_tokens: event.totalInputTokens || 0,
      total_output_tokens: event.totalOutputTokens || 0,
      total_cost: event.totalCost || 0,
      metadata: event.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('duckcode.chat_sessions')
      .upsert(processedEvents, { onConflict: 'session_id' });

    if (error) {
      console.error('Error upserting chat sessions:', error);
      return res.status(500).json({ error: 'Failed to store chat sessions' });
    }

    res.json({ success: true, processed: processedEvents.length });
  } catch (error) {
    console.error('Chat sessions endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/analytics/ide_sessions - Store IDE session analytics
router.post('/ide_sessions', authenticateUser, async (req, res) => {
  try {
    const { events } = req.body;
    const userId = req.user.id;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const processedEvents = events.map(event => ({
      user_id: userId,
      session_token: null, // Will be linked later if needed
      ide_version: event.ideVersion,
      os_platform: event.osPlatform,
      workspace_path: event.workspacePath,
      project_language: event.projectLanguage,
      started_at: event.startedAt,
      ended_at: event.endedAt,
      duration_minutes: event.durationMinutes,
      files_analyzed: event.filesAnalyzed || 0,
      commands_executed: event.commandsExecuted || 0,
      errors_encountered: event.errorsEncountered || 0,
      metadata: event.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('duckcode.ide_usage_sessions')
      .upsert(processedEvents, { onConflict: 'id' });

    if (error) {
      console.error('Error upserting IDE sessions:', error);
      return res.status(500).json({ error: 'Failed to store IDE sessions' });
    }

    res.json({ success: true, processed: processedEvents.length });
  } catch (error) {
    console.error('IDE sessions endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/analytics/feature_usage - Store feature usage analytics
router.post('/feature_usage', authenticateUser, async (req, res) => {
  try {
    const { events } = req.body;
    const userId = req.user.id;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array is required' });
    }

    const processedEvents = events.map(event => ({
      user_id: userId,
      session_id: null, // Will be linked to IDE session if available
      feature_name: event.featureName,
      action: event.action,
      count: event.count || 1,
      duration_ms: event.durationMs,
      success: event.success !== false,
      error_message: event.errorMessage,
      metadata: event.metadata || {},
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('duckcode.feature_usage')
      .insert(processedEvents);

    if (error) {
      console.error('Error inserting feature usage:', error);
      return res.status(500).json({ error: 'Failed to store feature usage' });
    }

    res.json({ success: true, inserted: processedEvents.length });
  } catch (error) {
    console.error('Feature usage endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/dashboard - Get analytics data for dashboard
router.get('/dashboard', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { timeRange = '7d' } = req.query;
    
    // Calculate date range
    const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get usage statistics
    const { data: dailyStats, error: dailyError } = await supabase
      .from('duckcode.daily_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('usage_date', startDate.toISOString().split('T')[0])
      .order('usage_date', { ascending: true });

    if (dailyError) {
      console.error('Error fetching daily stats:', dailyError);
      return res.status(500).json({ error: 'Failed to fetch daily statistics' });
    }

    // Get model usage statistics
    const { data: modelStats, error: modelError } = await supabase
      .from('duckcode.model_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('usage_date', startDate.toISOString().split('T')[0]);

    if (modelError) {
      console.error('Error fetching model stats:', modelError);
      return res.status(500).json({ error: 'Failed to fetch model statistics' });
    }

    // Get recent chat sessions
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('duckcode.chat_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: false })
      .limit(10);

    if (sessionsError) {
      console.error('Error fetching recent sessions:', sessionsError);
      return res.status(500).json({ error: 'Failed to fetch recent sessions' });
    }

    // Calculate aggregated statistics
    const totalStats = dailyStats.reduce((acc, day) => ({
      totalSessions: acc.totalSessions + (day.total_sessions || 0),
      totalMessages: acc.totalMessages + (day.total_chat_messages || 0),
      totalInputTokens: acc.totalInputTokens + (day.total_input_tokens || 0),
      totalOutputTokens: acc.totalOutputTokens + (day.total_output_tokens || 0),
      totalCost: acc.totalCost + (parseFloat(day.total_cost) || 0),
      activeTimeMinutes: acc.activeTimeMinutes + (day.active_time_minutes || 0)
    }), {
      totalSessions: 0,
      totalMessages: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      activeTimeMinutes: 0
    });

    // Group model stats by model name
    const modelStatsGrouped = modelStats.reduce((acc, stat) => {
      if (!acc[stat.model_name]) {
        acc[stat.model_name] = {
          modelName: stat.model_name,
          requests: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          avgResponseTime: 0
        };
      }
      
      acc[stat.model_name].requests += stat.total_requests || 0;
      acc[stat.model_name].inputTokens += stat.total_input_tokens || 0;
      acc[stat.model_name].outputTokens += stat.total_output_tokens || 0;
      acc[stat.model_name].cost += parseFloat(stat.total_cost) || 0;
      acc[stat.model_name].avgResponseTime = stat.avg_response_time_ms || 0;
      
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        usageStats: {
          ...totalStats,
          avgResponseTime: 1250, // TODO: Calculate from actual data
          successRate: 98.5 // TODO: Calculate from actual data
        },
        dailyStats: dailyStats.map(day => ({
          date: day.usage_date,
          messages: day.total_chat_messages || 0,
          tokens: (day.total_input_tokens || 0) + (day.total_output_tokens || 0),
          cost: parseFloat(day.total_cost) || 0,
          activeTime: day.active_time_minutes || 0
        })),
        modelStats: Object.values(modelStatsGrouped),
        recentSessions
      }
    });
  } catch (error) {
    console.error('Dashboard endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/user-profile - Get user profile with usage summary
router.get('/user-profile', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('duckcode.user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }

    // Get recent activity summary
    const { data: recentActivity, error: activityError } = await supabase
      .from('duckcode.daily_usage_stats')
      .select('*')
      .eq('user_id', userId)
      .order('usage_date', { ascending: false })
      .limit(30);

    if (activityError) {
      console.error('Error fetching recent activity:', activityError);
      return res.status(500).json({ error: 'Failed to fetch recent activity' });
    }

    res.json({
      success: true,
      data: {
        profile,
        recentActivity
      }
    });
  } catch (error) {
    console.error('User profile endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
