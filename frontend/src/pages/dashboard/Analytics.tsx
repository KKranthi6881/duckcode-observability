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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-foreground text-lg">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="bg-card border border-red-500/50 rounded-xl p-8 max-w-md text-center">
          <div className="text-red-400 text-xl mb-3">⚠️ Error loading analytics</div>
          <div className="text-muted-foreground text-sm mb-6">{error}</div>
          <button 
            onClick={() => fetchAnalyticsData()} 
            className="px-6 py-3 bg-primary text-foreground rounded-lg hover:bg-primary/90 font-medium transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!conversationStats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="text-muted-foreground text-center">No analytics data available</div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Brain className="w-8 h-8 text-primary" />
              DuckCode IDE Analytics
            </h1>
            <p className="text-muted-foreground mt-1">Track your IDE usage, LLM costs, token consumption, and performance metrics</p>
          </div>
          
          {/* Time Range Selector */}
          <div className="flex bg-card border border-border rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  timeRange === range
                    ? 'bg-primary text-foreground shadow-lg'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card border-2 border-blue-500/40 rounded-xl p-6 shadow-lg hover:border-blue-500/60 transition">
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="w-10 h-10 text-blue-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conversations</span>
            </div>
            <div className="text-4xl font-bold text-foreground mb-1">{conversationStats.totalConversations.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total IDE sessions</div>
          </div>

          <div className="bg-card border-2 border-green-500/40 rounded-xl p-6 shadow-lg hover:border-green-500/60 transition">
            <div className="flex items-center justify-between mb-3">
              <MessageSquare className="w-10 h-10 text-green-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Messages</span>
            </div>
            <div className="text-4xl font-bold text-foreground mb-1">{conversationStats.totalMessages.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Chat interactions</div>
          </div>

          <div className="bg-card border-2 border-purple-500/40 rounded-xl p-6 shadow-lg hover:border-purple-500/60 transition">
            <div className="flex items-center justify-between mb-3">
              <Brain className="w-10 h-10 text-purple-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tokens</span>
            </div>
            <div className="text-4xl font-bold text-foreground mb-1">{((conversationStats.totalTokensIn + conversationStats.totalTokensOut) / 1000000).toFixed(2)}M</div>
            <div className="text-sm text-muted-foreground">{(conversationStats.totalTokensIn + conversationStats.totalTokensOut).toLocaleString()} total</div>
          </div>

          <div className="bg-card border-2 border-orange-500/40 rounded-xl p-6 shadow-lg hover:border-orange-500/60 transition">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="w-10 h-10 text-orange-500" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Cost</span>
            </div>
            <div className="text-4xl font-bold text-foreground mb-1">${conversationStats.totalCost.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">LLM API charges</div>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border-2 border-border rounded-xl p-6 hover:border-primary/30 transition">
            <div className="flex items-center justify-between mb-3">
              <TrendingUp className="w-8 h-8 text-green-400" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completion</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{conversationStats.completionRate}%</div>
            <div className="text-sm text-muted-foreground">Success rate</div>
          </div>

          <div className="bg-card border-2 border-border rounded-xl p-6 hover:border-primary/30 transition">
            <div className="flex items-center justify-between mb-3">
              <Zap className="w-8 h-8 text-blue-400" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cache Hits</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{conversationStats.totalCacheReads > 0 ? ((conversationStats.totalCacheReads / (conversationStats.totalCacheReads + conversationStats.totalCacheWrites)) * 100).toFixed(1) : '0'}%</div>
            <div className="text-sm text-muted-foreground">Efficiency rate</div>
          </div>

          <div className="bg-card border-2 border-border rounded-xl p-6 hover:border-primary/30 transition">
            <div className="flex items-center justify-between mb-3">
              <Activity className="w-8 h-8 text-purple-400" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tool Calls</span>
            </div>
            <div className="text-3xl font-bold text-foreground mb-1">{conversationStats.totalToolCalls.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total executions</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Usage Chart */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-xl font-semibold text-foreground">Daily Usage Trend</h3>
                <p className="text-sm text-muted-foreground mt-1">Historical activity breakdown</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
              {dailyStats.map((day) => (
                <div key={day.usage_date} className="flex items-center justify-between py-3 px-4 bg-muted rounded-lg hover:bg-accent transition">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span className="text-sm text-foreground font-medium">{new Date(day.usage_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">{day.total_conversations} sessions</div>
                    <div className="text-xs text-muted-foreground">{day.total_messages} msgs · {((day.total_tokens_in + day.total_tokens_out) / 1000).toFixed(1)}K tokens</div>
                    <div className="text-xs font-semibold text-orange-400">${day.total_cost.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Model Usage Breakdown */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Brain className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-xl font-semibold text-foreground">Model Usage & Costs</h3>
                <p className="text-sm text-muted-foreground mt-1">LLM cost breakdown by model</p>
              </div>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {modelStats.map((model) => (
                <div key={model.model} className="bg-muted rounded-lg p-4 border border-border hover:border-primary/50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-purple-500/20 border border-purple-500/30 rounded-lg flex items-center justify-center">
                        <Brain className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{model.model}</div>
                        <div className="text-xs text-muted-foreground">{model.totalConversations} sessions</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-foreground">
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
        <div className="bg-card border border-border rounded-xl">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Performance Metrics
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Completion Rate</span>
                <span className="text-sm font-semibold text-green-400">{conversationStats.completionRate}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Input/Output Ratio</span>
                <span className="text-sm font-semibold text-foreground">
                  {conversationStats.totalTokensIn > 0 ? (conversationStats.totalTokensOut / conversationStats.totalTokensIn).toFixed(2) : '0'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Cost per Conversation</span>
                <span className="text-sm font-semibold text-orange-400">
                  ${conversationStats.totalConversations > 0 ? (conversationStats.totalCost / conversationStats.totalConversations).toFixed(4) : '0'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Avg Messages per Conversation</span>
                <span className="text-sm font-semibold text-foreground">
                  {conversationStats.totalConversations > 0 ? (conversationStats.totalMessages / conversationStats.totalConversations).toFixed(1) : '0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Insights */}
        <div className="bg-card border-2 border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <Activity className="h-6 w-6 text-blue-400 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">💡 Conversation Insights</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Your conversations have a <span className="font-bold text-green-400">{conversationStats.completionRate}%</span> completion rate</p>
                <p>• Average of <span className="font-bold text-foreground">{conversationStats.totalConversations > 0 ? (conversationStats.totalMessages / conversationStats.totalConversations).toFixed(1) : '0'}</span> messages per conversation</p>
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
