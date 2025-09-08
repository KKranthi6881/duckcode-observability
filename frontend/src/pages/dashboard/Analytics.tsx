import { useState, useEffect, useCallback } from 'react';
import { BarChart3, MessageSquare, DollarSign, TrendingUp, Brain, Zap, Activity } from 'lucide-react';
import { supabase } from '../../config/supabaseClient';

interface ConversationStats {
  totalConversations: number;
  completedConversations: number;
  totalMessages: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCacheWrites: number;
  totalCacheReads: number;
  totalCost: number;
  totalToolCalls: number;
  completionRate: string;
}

interface DailyConversationStats {
  usage_date: string;
  total_conversations: number;
  completed_conversations: number;
  total_messages: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cache_writes: number;
  total_cache_reads: number;
  total_cost: number;
  total_tool_calls: number;
  model_usage: Record<string, {
    conversations: number;
    tokens_in: number;
    tokens_out: number;
    cost: number;
  }>;
}

interface ModelStats {
  model: string;
  totalConversations: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
}

export function Analytics() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [conversationStats, setConversationStats] = useState<ConversationStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyConversationStats[]>([]);
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view analytics');
        return;
      }

      const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch daily conversation stats
      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_conversation_stats')
        .select('*')
        .eq('user_id', user.id)
        .gte('usage_date', startDate.toISOString().split('T')[0])
        .order('usage_date', { ascending: true });

      if (dailyError) throw dailyError;

      // Note: conversation analytics data could be used for detailed conversation history
      // For now, we're focusing on aggregated daily stats

      // Aggregate model stats from daily data
      const modelStatsMap: Record<string, ModelStats> = {};
      
      (dailyData || []).forEach(day => {
        const modelUsage = day.model_usage || {};
        Object.keys(modelUsage).forEach(modelName => {
          const usage = modelUsage[modelName];
          if (!modelStatsMap[modelName]) {
            modelStatsMap[modelName] = {
              model: modelName,
              totalConversations: 0,
              totalTokensIn: 0,
              totalTokensOut: 0,
              totalCost: 0
            };
          }
          
          modelStatsMap[modelName].totalConversations += usage.conversations || 0;
          modelStatsMap[modelName].totalTokensIn += usage.tokens_in || 0;
          modelStatsMap[modelName].totalTokensOut += usage.tokens_out || 0;
          modelStatsMap[modelName].totalCost += usage.cost || 0;
        });
      });

      // Calculate overall conversation stats
      const totalStats = (dailyData || []).reduce((acc, day) => ({
        totalConversations: acc.totalConversations + (day.total_conversations || 0),
        completedConversations: acc.completedConversations + (day.completed_conversations || 0),
        totalMessages: acc.totalMessages + (day.total_messages || 0),
        totalTokensIn: acc.totalTokensIn + (day.total_tokens_in || 0),
        totalTokensOut: acc.totalTokensOut + (day.total_tokens_out || 0),
        totalCacheWrites: acc.totalCacheWrites + (day.total_cache_writes || 0),
        totalCacheReads: acc.totalCacheReads + (day.total_cache_reads || 0),
        totalCost: acc.totalCost + (day.total_cost || 0),
        totalToolCalls: acc.totalToolCalls + (day.total_tool_calls || 0),
        completionRate: '0'
      }), {
        totalConversations: 0,
        completedConversations: 0,
        totalMessages: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCacheWrites: 0,
        totalCacheReads: 0,
        totalCost: 0,
        totalToolCalls: 0,
        completionRate: '0'
      });

      // Calculate completion rate
      if (totalStats.totalConversations > 0) {
        totalStats.completionRate = (totalStats.completedConversations / totalStats.totalConversations * 100).toFixed(1);
      }

      setConversationStats(totalStats);
      setDailyStats(dailyData || []);
      setModelStats(Object.values(modelStatsMap));
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics data');
      
      // Fallback to mock data if real data fails
      setConversationStats({
        totalConversations: 0,
        completedConversations: 0,
        totalMessages: 0,
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCacheWrites: 0,
        totalCacheReads: 0,
        totalCost: 0,
        totalToolCalls: 0,
        completionRate: '0'
      });
      setDailyStats([]);
      setModelStats([]);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️ Error loading analytics</div>
          <div className="text-gray-600 text-sm">{error}</div>
          <button 
            onClick={() => fetchAnalyticsData()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!conversationStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">No analytics data available</div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DuckCode Analytics</h1>
          <p className="text-gray-600">Track your IDE usage, token consumption, and performance metrics</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                timeRange === range
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Conversations</p>
              <p className="text-2xl font-bold text-gray-900">{conversationStats.totalConversations.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <MessageSquare className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Messages</p>
              <p className="text-2xl font-bold text-gray-900">{conversationStats.totalMessages.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900">{(conversationStats.totalTokensIn + conversationStats.totalTokensOut).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Brain className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cost</p>
              <p className="text-2xl font-bold text-gray-900">${conversationStats.totalCost.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900">{conversationStats.completionRate}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cache Efficiency</p>
              <p className="text-2xl font-bold text-gray-900">{conversationStats.totalCacheReads > 0 ? ((conversationStats.totalCacheReads / (conversationStats.totalCacheReads + conversationStats.totalCacheWrites)) * 100).toFixed(1) : '0'}%</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tool Calls</p>
              <p className="text-2xl font-bold text-gray-900">{conversationStats.totalToolCalls.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Usage Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Daily Usage Trend</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {dailyStats.map((day) => (
              <div key={day.usage_date} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">{new Date(day.usage_date).toLocaleDateString()}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{day.total_conversations} conversations</div>
                  <div className="text-xs text-gray-500">{day.total_messages} messages</div>
                  <div className="text-xs text-gray-500">{(day.total_tokens_in + day.total_tokens_out).toLocaleString()} tokens</div>
                  <div className="text-xs text-gray-500">${day.total_cost.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Model Usage Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Model Usage</h3>
            <Brain className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {modelStats.map((model) => (
              <div key={model.model} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{model.model}</div>
                    <div className="text-sm text-gray-500">{model.totalConversations} conversations</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {(model.totalTokensIn + model.totalTokensOut).toLocaleString()} tokens
                  </div>
                  <div className="text-xs text-gray-500">
                    ${model.totalCost.toFixed(2)}
                  </div>
                  <div className="text-xs text-blue-600">
                    {model.totalTokensIn > 0 ? ((model.totalTokensOut / (model.totalTokensIn + model.totalTokensOut)) * 100).toFixed(1) : '0'}% output
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Performance Metrics</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Completion Rate</span>
              <span className="text-sm font-medium text-green-600">{conversationStats.completionRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Input/Output Ratio</span>
              <span className="text-sm font-medium text-gray-900">
                {conversationStats.totalTokensIn > 0 ? (conversationStats.totalTokensOut / conversationStats.totalTokensIn).toFixed(2) : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Cost per Conversation</span>
              <span className="text-sm font-medium text-gray-900">
                ${conversationStats.totalConversations > 0 ? (conversationStats.totalCost / conversationStats.totalConversations).toFixed(4) : '0'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Avg Messages per Conversation</span>
              <span className="text-sm font-medium text-gray-900">
                {conversationStats.totalConversations > 0 ? (conversationStats.totalMessages / conversationStats.totalConversations).toFixed(1) : '0'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Usage Insights */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-start space-x-3">
          <Activity className="h-6 w-6 text-blue-600 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Conversation Insights</h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>• Your conversations have a {conversationStats.completionRate}% completion rate</p>
              <p>• Average of {conversationStats.totalConversations > 0 ? (conversationStats.totalMessages / conversationStats.totalConversations).toFixed(1) : '0'} messages per conversation</p>
              <p>• Cache efficiency helps reduce costs by {conversationStats.totalCacheReads > 0 ? ((conversationStats.totalCacheReads / (conversationStats.totalCacheReads + conversationStats.totalCacheWrites)) * 100).toFixed(1) : '0'}%</p>
              <p>• Tool usage: {conversationStats.totalToolCalls} calls across all conversations</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
