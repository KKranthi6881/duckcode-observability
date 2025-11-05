import { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, Zap, Download, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { userAnalyticsService } from '../../services/userAnalyticsService';
import { ConversationHistoryTable } from '../../components/analytics/ConversationHistoryTable';

interface AnalyticsSummary {
  totalConversations: number;
  totalCost: number;
  totalTokens: number;
  avgCostPerConversation: number;
  totalTokensIn: number;
  totalTokensOut: number;
  avgTokensPerConversation: number;
}

interface DailyStats {
  usage_date: string;
  total_conversations: number;
  total_cost: number;
}

interface Conversation {
  id: string;
  conversation_id: string;
  topic_title: string;
  model_name: string;
  status: 'active' | 'completed' | 'abandoned' | 'error';
  started_at: string;
  ended_at?: string;
  duration_minutes?: number;
  message_count: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  tool_call_count: number;
  tools_used: string[];
}

export function EnhancedAnalytics() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;

      // Fetch data from user analytics API
      const [summaryData, trendsData, conversationsData] = await Promise.all([
        userAnalyticsService.getUserSummary(days),
        userAnalyticsService.getUserTrends(days),
        userAnalyticsService.getUserRecentConversations(100),
      ]);

      // Transform trends data to match expected format
      const dailyData: DailyStats[] = trendsData.trends.map(trend => ({
        usage_date: trend.usage_date,
        total_conversations: trend.conversations || 0,
        total_cost: trend.total_cost,
      }));

      // Transform conversations data to match expected format
      const conversationsFormatted: Conversation[] = conversationsData.conversations.map(conv => ({
        id: conv.conversation_id,
        conversation_id: conv.conversation_id,
        topic_title: conv.topic_title || 'Untitled Conversation',
        model_name: conv.model_name,
        status: (conv.status || 'completed') as 'active' | 'completed' | 'abandoned' | 'error',
        started_at: conv.created_at,
        ended_at: undefined,
        duration_minutes: undefined,
        message_count: 0,
        total_tokens_in: conv.total_tokens_in,
        total_tokens_out: conv.total_tokens_out,
        total_cost: conv.total_cost,
        tool_call_count: 0,
        tools_used: [],
      }));

      // Calculate summary
      const totalCost = summaryData.totals.total_cost;
      const totalConversations = summaryData.totals.conversations;
      const totalTokens = summaryData.totals.total_tokens;
      const totalTokensIn = summaryData.totals.tokens_in || 0;
      const totalTokensOut = summaryData.totals.tokens_out || 0;

      setSummary({
        totalConversations,
        totalCost,
        totalTokens,
        totalTokensIn,
        totalTokensOut,
        avgCostPerConversation: totalConversations > 0 ? totalCost / totalConversations : 0,
        avgTokensPerConversation: totalConversations > 0 ? totalTokens / totalConversations : 0,
      });

      setDailyStats(dailyData);
      setConversations(conversationsFormatted);

    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = () => {
    // Create CSV export
    const csvData = conversations.map(conv => ({
      Date: new Date(conv.started_at).toISOString(),
      Topic: conv.topic_title,
      Model: conv.model_name,
      Status: conv.status,
      Messages: conv.message_count,
      'Tokens In': conv.total_tokens_in,
      'Tokens Out': conv.total_tokens_out,
      'Total Tokens': conv.total_tokens_in + conv.total_tokens_out,
      Cost: conv.total_cost,
    }));

    const headers = Object.keys(csvData[0] || {}) as Array<keyof typeof csvData[0]>;
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duckcode-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            onClick={fetchAnalytics} 
            className="px-6 py-3 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#d94a1e] font-medium transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0c0c] p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-[#ff6a3c]" />
              My Usage Analytics
            </h1>
            <p className="text-[#8d857b] mt-1">Track your AI model usage and costs</p>
          </div>
          <div className="flex items-center gap-3">
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
                  {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#d94a1e] transition-colors font-medium text-sm shadow-lg"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* KPI Cards - 4 Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Cost */}
          <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-white/90" />
              <span className="text-xs font-bold text-white/70 uppercase">Total Cost</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${(summary?.totalCost || 0).toFixed(2)}
            </div>
            <div className="text-xs text-white/80">
              ${((summary?.totalCost || 0) / (summary?.totalConversations || 1)).toFixed(4)} per session
            </div>
          </div>

          {/* Conversations */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <BarChart3 className="w-8 h-8 text-white/90" />
              <span className="text-xs font-bold text-white/70 uppercase">Sessions</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {(summary?.totalConversations || 0).toLocaleString()}
            </div>
            <div className="text-xs text-white/80">
              Total conversations
            </div>
          </div>

          {/* Total Tokens */}
          <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-8 h-8 text-white/90" />
              <span className="text-xs font-bold text-white/70 uppercase">Tokens</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {((summary?.totalTokens || 0) / 1000000).toFixed(2)}M
            </div>
            <div className="text-xs text-white/80">
              {summary?.avgTokensPerConversation ? Math.round(summary.avgTokensPerConversation).toLocaleString() : 0} avg/session
            </div>
          </div>

          {/* Avg Cost */}
          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-8 h-8 text-white/90" />
              <span className="text-xs font-bold text-white/70 uppercase">Avg Cost</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${(summary?.avgCostPerConversation || 0).toFixed(3)}
            </div>
            <div className="text-xs text-white/80">
              Per conversation
            </div>
          </div>
        </div>

        {/* Detailed Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#8d857b] font-medium">Token Distribution</span>
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8d857b]">Input Tokens</span>
                <span className="text-sm font-semibold text-white">{((summary?.totalTokensIn || 0) / 1000).toFixed(1)}K</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8d857b]">Output Tokens</span>
                <span className="text-sm font-semibold text-white">{((summary?.totalTokensOut || 0) / 1000).toFixed(1)}K</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#2d2a27]">
                <span className="text-xs text-[#8d857b]">Ratio (Out/In)</span>
                <span className="text-sm font-semibold text-green-400">
                  {summary?.totalTokensIn ? (summary.totalTokensOut / summary.totalTokensIn).toFixed(2) : '0.00'}x
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#8d857b] font-medium">Cost Breakdown</span>
              <DollarSign className="w-4 h-4 text-orange-400" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8d857b]">Total Spend</span>
                <span className="text-sm font-semibold text-white">${(summary?.totalCost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8d857b]">Per Session</span>
                <span className="text-sm font-semibold text-white">${(summary?.avgCostPerConversation || 0).toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#2d2a27]">
                <span className="text-xs text-[#8d857b]">Per 1K Tokens</span>
                <span className="text-sm font-semibold text-orange-400">
                  ${summary?.totalTokens ? ((summary.totalCost / summary.totalTokens) * 1000).toFixed(4) : '0.0000'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#8d857b] font-medium">Activity Summary</span>
              <BarChart3 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8d857b]">Total Sessions</span>
                <span className="text-sm font-semibold text-white">{(summary?.totalConversations || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#8d857b]">Avg Tokens/Session</span>
                <span className="text-sm font-semibold text-white">{summary?.avgTokensPerConversation ? Math.round(summary.avgTokensPerConversation).toLocaleString() : 0}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#2d2a27]">
                <span className="text-xs text-[#8d857b]">Time Period</span>
                <span className="text-sm font-semibold text-blue-400">{timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : '90 days'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Trend Chart - Enhanced Grafana Style */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#ff6a3c]/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-[#ff6a3c]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Daily Cost Trend</h3>
                <p className="text-xs text-[#8d857b] mt-0.5">Historical spending analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#ff6a3c] rounded"></div>
                <span className="text-[#8d857b]">Daily Cost</span>
              </div>
            </div>
          </div>
          <div className="bg-[#0d0c0c] rounded-lg p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6a3c" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#ff6a3c" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2a27" vertical={false} />
                <XAxis
                  dataKey="usage_date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  stroke="#8d857b"
                  style={{ fontSize: '11px' }}
                  tick={{ fill: '#8d857b' }}
                />
                <YAxis 
                  stroke="#8d857b" 
                  style={{ fontSize: '11px' }}
                  tick={{ fill: '#8d857b' }}
                  tickFormatter={(value) => `$${value.toFixed(2)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f1d1b',
                    border: '1px solid #2d2a27',
                    borderRadius: '8px',
                    fontSize: '12px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                  }}
                  labelStyle={{ color: '#ffffff', marginBottom: '4px' }}
                  itemStyle={{ color: '#ff6a3c' }}
                  formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                />
                <Bar
                  dataKey="total_cost"
                  fill="url(#costGradient)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <div className="text-[#8d857b]">
              Showing {dailyStats.length} days of activity
            </div>
            <div className="text-[#8d857b]">
              Total: <span className="text-[#ff6a3c] font-semibold">${dailyStats.reduce((sum, day) => sum + day.total_cost, 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Conversation History */}
        <ConversationHistoryTable
          conversations={conversations}
          onExport={handleExport}
        />
      </div>
    </div>
  );
}
