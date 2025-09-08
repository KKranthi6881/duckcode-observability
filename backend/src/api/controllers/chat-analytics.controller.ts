import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { supabaseDuckCode } from '../../config/supabase';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

// Start a new conversation
export const startConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      conversationId, 
      topicTitle, 
      modelName, 
      providerName, 
      modeName, 
      workspacePath, 
      metadata = {} 
    } = req.body;
    const userId = req.user?.id;

    console.log('Starting conversation:', { conversationId, topicTitle, modelName, userId });

    // For debugging: allow test user ID if no auth user
    const effectiveUserId = userId || (req.body.userId === 'test-user-123' ? 'test-user-123' : null);
    
    if (!effectiveUserId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check if conversation already exists
    const { data: existingConversation } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('id')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .single();

    if (existingConversation) {
      return res.status(200).json({ 
        message: 'Conversation already exists',
        conversationId: existingConversation.id 
      });
    }

    // Create new conversation
    const { data: newConversation, error } = await supabaseDuckCode
      .from('conversation_analytics')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        topic_title: topicTitle,
        model_name: modelName,
        provider_name: providerName,
        mode_name: modeName,
        workspace_path: workspacePath,
        status: 'active',
        metadata
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating conversation:', JSON.stringify(error, null, 2));
      return res.status(500).json({ message: 'Failed to create conversation', error: error.message });
    }

    res.status(201).json({
      message: 'Conversation started successfully',
      conversation: newConversation
    });

  } catch (error) {
    console.error('Error in startConversation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Update conversation with metrics (incremental or final)
export const updateConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      conversationId, 
      apiMetrics,
      totalMessages, 
      totalToolCalls,
      toolUsage = {},
      status = 'active',
      endedAt
    } = req.body;

    // Extract metrics from apiMetrics object
    const {
      totalTokensIn = 0,
      totalTokensOut = 0,
      totalCacheWrites = 0,
      totalCacheReads = 0,
      totalCost = 0,
      contextTokens = 0,
      // Optional cost breakdowns if provided by IDE
      inputCost = 0,
      outputCost = 0,
      cacheWriteCost = 0,
      cacheReadCost = 0
    } = apiMetrics || {};
    const userId = req.user?.id;

    console.log('Updating conversation:', { conversationId, totalTokensIn, totalTokensOut, totalCost, status });

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Get existing conversation
    const { data: existingConversation } = await supabaseDuckCode
      .from('conversation_analytics')
      .select('started_at')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .single();

    let conversationExists = existingConversation;
    
    if (!conversationExists) {
      console.warn(`⚠️ Conversation ${conversationId} not found for user ${userId} - may be a race condition`);
      // Instead of returning 404, wait a bit and retry once
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const { data: retryConversation } = await supabaseDuckCode
        .from('conversation_analytics')
        .select('started_at')
        .eq('user_id', userId)
        .eq('conversation_id', conversationId)
        .single();
        
      if (!retryConversation) {
        console.error(`❌ Conversation ${conversationId} still not found after retry`);
        return res.status(404).json({ message: 'Conversation not found' });
      }
      
      conversationExists = retryConversation;
    }

    // Extract metrics from apiMetrics if provided (legacy format)
    const metrics = req.body.apiMetrics || {};
    // Derived metrics for convenience/UI
    const totalTokens = (totalTokensIn || metrics.totalTokensIn || 0) + (totalTokensOut || metrics.totalTokensOut || 0);
    const cacheTokens = (totalCacheWrites || metrics.totalCacheWrites || 0) + (totalCacheReads || metrics.totalCacheReads || 0);
    const cacheEfficiency = (totalTokensIn + totalCacheReads) > 0
      ? Number((totalCacheReads / (totalTokensIn + totalCacheReads)).toFixed(3))
      : 0;

    // Build update object
    // Compute tool call count robustly from provided fields
    const arrayToolCallsLen = Array.isArray((req.body as any).toolCalls) ? (req.body as any).toolCalls.length : 0;
    const mapToolCallsSum = toolUsage && typeof toolUsage === 'object'
      ? Object.values(toolUsage as Record<string, number>).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
      : 0;
    const computedToolCallCount = typeof totalToolCalls === 'number'
      ? totalToolCalls
      : (mapToolCallsSum || arrayToolCallsLen);

    const updateData: any = {
      total_tokens_in: totalTokensIn || metrics.totalTokensIn || 0,
      total_tokens_out: totalTokensOut || metrics.totalTokensOut || 0,
      total_cache_writes: totalCacheWrites || metrics.totalCacheWrites || 0,
      total_cache_reads: totalCacheReads || metrics.totalCacheReads || 0,
      context_tokens: contextTokens || metrics.contextTokens || 0,
      total_cost: totalCost || metrics.totalCost || 0,
      // Persist derived and optional breakdowns
      total_tokens: totalTokens,
      cache_tokens: cacheTokens,
      cache_efficiency: cacheEfficiency,
      input_cost: inputCost,
      output_cost: outputCost,
      cache_write_cost: cacheWriteCost,
      cache_read_cost: cacheReadCost,
      message_count: totalMessages || (req.body as any).messageCount || 0,
      tool_call_count: computedToolCallCount,
      // Prefer counts map if provided; else fall back to array
      tools_used: (toolUsage && Object.keys(toolUsage).length > 0) ? toolUsage : ((req.body as any).toolCalls || []),
      status: status,
      updated_at: new Date().toISOString()
    };

    // If this is a final update (conversation ending)
    if (status === 'completed' || status === 'abandoned' || endedAt) {
      const startTime = new Date(conversationExists.started_at);
      const endTime = endedAt ? new Date(endedAt) : new Date();
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      updateData.ended_at = endTime.toISOString();
      updateData.duration_minutes = durationMinutes;
      updateData.user_message_count = Math.ceil((totalMessages || 0) / 2);
      updateData.assistant_message_count = Math.floor((totalMessages || 0) / 2);
    }

    // Update conversation
    const { data, error: updateError } = await supabaseDuckCode
      .from('conversation_analytics')
      .update(updateData)
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating conversation:', updateError);
      return res.status(500).json({ message: 'Failed to update conversation' });
    }

    res.json({
      message: 'Conversation updated successfully',
      conversation: data
    });

  } catch (error) {
    console.error('Error in updateConversation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Track a chat message
export const trackChatMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      sessionId,
      messageType,
      content,
      inputTokens = 0,
      outputTokens = 0,
      modelName,
      responseTimeMs,
      cost = 0,
      toolCalls = [],
      metadata = {}
    } = req.body;

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Get the database session ID
    const { data: session, error: sessionError } = await supabaseDuckCode
      .from('chat_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    // Create chat message record
    const { data, error: messageError } = await supabaseDuckCode
      .from('chat_messages')
      .insert({
        user_id: userId,
        session_id: session.id,
        message_type: messageType,
        content,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        model_name: modelName,
        response_time_ms: responseTimeMs,
        cost,
        tool_calls: toolCalls,
        metadata
      })
      .select('*')
      .single();

    if (messageError) {
      console.error('Error tracking chat message:', messageError);
      return res.status(500).json({ message: 'Failed to track chat message' });
    }

    res.status(201).json({
      message: 'Chat message tracked successfully',
      messageRecord: data
    });

  } catch (error) {
    console.error('Error in trackChatMessage:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get conversation statistics
export const getChatStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = '30d' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const startDate = getStartDate(period as string);

    // Get overall statistics from daily conversation stats
    const { data: stats } = await supabaseDuckCode
      .from('daily_conversation_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('usage_date', startDate.toISOString().split('T')[0]);

    const totalConversations = stats?.reduce((sum, day) => sum + (day.total_conversations || 0), 0) || 0;
    const completedConversations = stats?.reduce((sum, day) => sum + (day.completed_conversations || 0), 0) || 0;
    const totalMessages = stats?.reduce((sum, day) => sum + (day.total_messages || 0), 0) || 0;
    const totalTokensIn = stats?.reduce((sum, day) => sum + (day.total_tokens_in || 0), 0) || 0;
    const totalTokensOut = stats?.reduce((sum, day) => sum + (day.total_tokens_out || 0), 0) || 0;
    const totalTokens = stats?.reduce((sum, day) => sum + (day.total_tokens || ((day.total_tokens_in || 0) + (day.total_tokens_out || 0))), 0) || 0;
    const totalCacheWrites = stats?.reduce((sum, day) => sum + (day.total_cache_writes || 0), 0) || 0;
    const totalCacheReads = stats?.reduce((sum, day) => sum + (day.total_cache_reads || 0), 0) || 0;
    const cacheTokens = stats?.reduce((sum, day) => sum + (day.cache_tokens || ((day.total_cache_writes || 0) + (day.total_cache_reads || 0))), 0) || 0;
    const totalCost = stats?.reduce((sum, day) => sum + (day.total_cost || 0), 0) || 0;
    const inputCost = stats?.reduce((sum, day) => sum + (day.input_cost || 0), 0) || 0;
    const outputCost = stats?.reduce((sum, day) => sum + (day.output_cost || 0), 0) || 0;
    const cacheCost = stats?.reduce((sum, day) => sum + (day.cache_cost || 0), 0) || 0;
    const totalToolCalls = stats?.reduce((sum, day) => sum + (day.total_tool_calls || 0), 0) || 0;

    res.json({
      period,
      summary: {
        totalConversations,
        completedConversations,
        totalMessages,
        totalTokensIn,
        totalTokensOut,
        totalTokens,
        totalCacheWrites,
        totalCacheReads,
        cacheTokens,
        totalCost,
        inputCost,
        outputCost,
        cacheCost,
        totalToolCalls,
        completionRate: totalConversations > 0 ? (completedConversations / totalConversations * 100).toFixed(1) : '0'
      },
      startDate: startDate.toISOString()
    });

  } catch (error) {
    console.error('Error in getChatStats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get conversations
export const getConversations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    let query = supabaseDuckCode
      .from('conversation_analytics')
      .select('*')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting conversations:', error);
      return res.status(500).json({ message: 'Failed to get conversations' });
    }

    res.json({
      conversations: data || [],
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: data?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in getConversations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get daily statistics
export const getDailyStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = '30d' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const startDate = getStartDate(period as string);

    const { data, error } = await supabaseDuckCode
      .from('daily_conversation_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('usage_date', startDate.toISOString().split('T')[0])
      .order('usage_date', { ascending: true });

    if (error) {
      console.error('Error getting daily stats:', error);
      return res.status(500).json({ message: 'Failed to get daily stats' });
    }

    res.json({
      period,
      dailyStats: data || []
    });

  } catch (error) {
    console.error('Error in getDailyStats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Get model statistics from conversation data
export const getModelStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = '30d' } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const startDate = getStartDate(period as string);

    // Get model usage from daily stats
    const { data, error } = await supabaseDuckCode
      .from('daily_conversation_stats')
      .select('model_usage, usage_date')
      .eq('user_id', userId)
      .gte('usage_date', startDate.toISOString().split('T')[0]);

    if (error) {
      console.error('Error getting model stats:', error);
      return res.status(500).json({ message: 'Failed to get model stats' });
    }

    // Aggregate model usage across all days
    const modelStats: any = {};
    
    (data || []).forEach((day: any) => {
      const modelUsage = day.model_usage || {};
      Object.keys(modelUsage).forEach((modelName: string) => {
        const usage = modelUsage[modelName];
        if (!modelStats[modelName]) {
          modelStats[modelName] = {
            model: modelName,
            totalConversations: 0,
            totalTokensIn: 0,
            totalTokensOut: 0,
            totalTokens: 0,
            totalCost: 0
          };
        }
        
        modelStats[modelName].totalConversations += usage.conversations || 0;
        modelStats[modelName].totalTokensIn += usage.tokens_in || 0;
        modelStats[modelName].totalTokensOut += usage.tokens_out || 0;
        modelStats[modelName].totalTokens += (usage.tokens_total || ((usage.tokens_in || 0) + (usage.tokens_out || 0)));
        modelStats[modelName].totalCost += usage.cost || 0;
      });
    });

    // Sort by total cost descending
    const sortedModelStats = Object.values(modelStats)
      .sort((a: any, b: any) => b.totalCost - a.totalCost);

    res.json({
      period,
      modelStats: sortedModelStats
    });

  } catch (error) {
    console.error('Error in getModelStats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Helper function to get start date based on period
function getStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}
