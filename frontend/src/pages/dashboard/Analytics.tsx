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
      <div className="min-h-screen bg-[#0d0c0c] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6a3c]"></div>
          <span className="text-white text-lg">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d0c0c] flex items-center justify-center p-6">
        <div className="bg-[#161413] border border-red-500/50 rounded-xl p-8 max-w-md text-center">
          <div className="text-red-400 text-xl mb-3">⚠️ Error loading analytics</div>
          <div className="text-[#8d857b] text-sm mb-6">{error}</div>
          <button 
            onClick={() => fetchAnalyticsData()} 
            className="px-6 py-3 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#d94a1e] font-medium transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!conversationStats) {
    return (
      <div className="min-h-screen bg-[#0d0c0c] flex items-center justify-center">
        <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-8">
          <div className="text-[#8d857b] text-center">No analytics data available</div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#0d0c0c] p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Brain className="w-8 h-8 text-[#ff6a3c]" />
              DuckCode IDE Analytics
            </h1>
            <p className="text-[#8d857b] mt-1">Track your IDE usage, LLM costs, token consumption, and performance metrics</p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex bg-[#161413] border border-[#1f1d1b] rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-[#ff6a3c] text-white shadow-lg'
                    : 'text-[#8d857b] hover:text-white hover:bg-[#1f1d1b]'
                }`}
              >
                {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="w-10 h-10 text-white/80" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Conversations</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">{conversationStats.totalConversations.toLocaleString()}</div>
            <div className="text-sm text-white/80">Total IDE sessions</div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="w-10 h-10 text-white/80" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Messages</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">{conversationStats.totalMessages.toLocaleString()}</div>
            <div className="text-sm text-white/80">Chat interactions</div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <Brain className="w-10 h-10 text-white/80" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Tokens</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">{((conversationStats.totalTokensIn + conversationStats.totalTokensOut) / 1000000).toFixed(2)}M</div>
            <div className="text-sm text-white/80">{(conversationStats.totalTokensIn + conversationStats.totalTokensOut).toLocaleString()} total</div>
          </div>

          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="w-10 h-10 text-white/80" />
              <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Total Cost</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">${conversationStats.totalCost.toFixed(2)}</div>
            <div className="text-sm text-white/80">LLM API charges</div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-[#ff6a3c]/30 transition">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <span className="text-xs font-semibold text-[#8d857b] uppercase tracking-wider">Completion</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{conversationStats.completionRate}%</div>
            <div className="text-sm text-[#8d857b]">Success rate</div>
          </div>

          <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-[#ff6a3c]/30 transition">
            <div className="flex items-center justify-between mb-3">
              <Zap className="w-8 h-8 text-blue-400" />
              <span className="text-xs font-semibold text-[#8d857b] uppercase tracking-wider">Cache Hits</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{conversationStats.totalCacheReads > 0 ? ((conversationStats.totalCacheReads / (conversationStats.totalCacheReads + conversationStats.totalCacheWrites)) * 100).toFixed(1) : '0'}%</div>
            <div className="text-sm text-[#8d857b]">Efficiency rate</div>
          </div>

          <div className="bg-[#161413] border-2 border-[#1f1d1b] rounded-xl p-6 hover:border-[#ff6a3c]/30 transition">
            <div className="flex items-center justify-between mb-3">
              <Activity className="w-8 h-8 text-purple-400" />
              <span className="text-xs font-semibold text-[#8d857b] uppercase tracking-wider">Tool Calls</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{conversationStats.totalToolCalls.toLocaleString()}</div>
            <div className="text-sm text-[#8d857b]">Total executions</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Usage Chart */}
          <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-[#ff6a3c]" />
              <div>
                <h3 className="text-xl font-semibold text-white">Daily Usage Trend</h3>
                <p className="text-sm text-[#8d857b] mt-1">Historical activity breakdown</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {dailyStats.map((day) => (
                <div key={day.usage_date} className="flex items-center justify-between py-3 px-4 bg-[#1f1d1b] rounded-lg hover:bg-[#2d2a27] transition">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-[#ff6a3c] rounded-full"></div>
                    <span className="text-sm text-white font-medium">{new Date(day.usage_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">{day.total_conversations} sessions</div>
                    <div className="text-xs text-[#8d857b]">{day.total_messages} msgs · {((day.total_tokens_in + day.total_tokens_out) / 1000).toFixed(1)}K tokens</div>
                    <div className="text-xs font-semibold text-orange-400">${day.total_cost.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Usage Breakdown */}
          <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Brain className="w-6 h-6 text-[#ff6a3c]" />
              <div>
                <h3 className="text-xl font-semibold text-white">Model Usage & Costs</h3>
                <p className="text-sm text-[#8d857b] mt-1">LLM cost breakdown by model</p>
              </div>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {modelStats.map((model) => (
                <div key={model.model} className="bg-gradient-to-br from-[#1f1d1b] to-[#2d2a27] rounded-lg p-4 border border-[#2d2a27] hover:border-[#ff6a3c]/50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                        <Brain className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{model.model}</div>
                        <div className="text-xs text-[#8d857b]">{model.totalConversations} sessions</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-white">
                        {((model.totalTokensIn + model.totalTokensOut) / 1000).toFixed(1)}K tokens
                      </div>
                      <div className="text-lg font-bold text-orange-400">
                        ${model.totalCost.toFixed(2)}
                      </div>
                      <div className="text-xs text-blue-400">
                        {model.totalTokensIn > 0 ? ((model.totalTokensOut / (model.totalTokensIn + model.totalTokensOut)) * 100).toFixed(1) : '0'}% output
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-[#161413] border border-[#1f1d1b] rounded-xl">
          <div className="p-6 border-b border-[#2d2a27]">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ff6a3c]" />
              Performance Metrics
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-[#1f1d1b] rounded-lg">
                <span className="text-sm text-[#8d857b]">Completion Rate</span>
                <span className="text-sm font-semibold text-green-400">{conversationStats.completionRate}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#1f1d1b] rounded-lg">
                <span className="text-sm text-[#8d857b]">Input/Output Ratio</span>
                <span className="text-sm font-semibold text-white">
                  {conversationStats.totalTokensIn > 0 ? (conversationStats.totalTokensOut / conversationStats.totalTokensIn).toFixed(2) : '0'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#1f1d1b] rounded-lg">
                <span className="text-sm text-[#8d857b]">Cost per Conversation</span>
                <span className="text-sm font-semibold text-orange-400">
                  ${conversationStats.totalConversations > 0 ? (conversationStats.totalCost / conversationStats.totalConversations).toFixed(4) : '0'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#1f1d1b] rounded-lg">
                <span className="text-sm text-[#8d857b]">Avg Messages per Conversation</span>
                <span className="text-sm font-semibold text-white">
                  {conversationStats.totalConversations > 0 ? (conversationStats.totalMessages / conversationStats.totalConversations).toFixed(1) : '0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Insights */}
        <div className="bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border-2 border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <Activity className="h-6 w-6 text-blue-400 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">💡 Conversation Insights</h3>
              <div className="space-y-2 text-sm text-blue-100">
                <p>• Your conversations have a <span className="font-bold text-green-400">{conversationStats.completionRate}%</span> completion rate</p>
                <p>• Average of <span className="font-bold text-white">{conversationStats.totalConversations > 0 ? (conversationStats.totalMessages / conversationStats.totalConversations).toFixed(1) : '0'}</span> messages per conversation</p>
                <p>• Cache efficiency helps reduce costs by <span className="font-bold text-blue-400">{conversationStats.totalCacheReads > 0 ? ((conversationStats.totalCacheReads / (conversationStats.totalCacheReads + conversationStats.totalCacheWrites)) * 100).toFixed(1) : '0'}%</span></p>
                <p>• Tool usage: <span className="font-bold text-purple-400">{conversationStats.totalToolCalls}</span> calls across all conversations</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
