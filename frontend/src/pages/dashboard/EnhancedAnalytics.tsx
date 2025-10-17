import { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, Zap, Download } from 'lucide-react';
import { userAnalyticsService } from '../../services/userAnalyticsService';
import { UsageTrendChart } from '../../components/analytics/UsageTrendChart';
import { ConversationHistoryTable } from '../../components/analytics/ConversationHistoryTable';

interface AnalyticsSummary {
  totalConversations: number;
  totalCost: number;
  totalProfit: number;
  avgProfitMargin: number;
  totalTokens: number;
  avgCostPerConversation: number;
}

interface DailyStats {
  usage_date: string;
  total_conversations: number;
  total_messages: number;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost: number;
  actual_api_cost: number;
  charged_cost: number;
  profit_amount: number;
  input_cost: number;
  output_cost: number;
  cache_cost: number;
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
  actual_api_cost?: number;
  profit_amount?: number;
  profit_margin?: number;
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
        total_messages: 0,
        total_tokens_in: 0,
        total_tokens_out: 0,
        total_cost: trend.total_cost,
        actual_api_cost: trend.total_cost, // No profit for enterprise users
        charged_cost: trend.total_cost,
        profit_amount: 0,
        input_cost: 0,
        output_cost: 0,
        cache_cost: 0,
      }));

      // Transform conversations data to match expected format
      const conversationsFormatted: Conversation[] = conversationsData.conversations.map(conv => ({
        id: conv.conversation_id,
        conversation_id: conv.conversation_id,
        topic_title: conv.topic_title || 'Untitled Conversation',
        model_name: conv.model_name,
        status: (conv.status || 'completed') as any,
        started_at: conv.created_at,
        ended_at: undefined,
        duration_minutes: undefined,
        message_count: 0,
        total_tokens_in: conv.total_tokens_in,
        total_tokens_out: conv.total_tokens_out,
        total_cost: conv.total_cost,
        actual_api_cost: conv.total_cost,
        profit_amount: 0,
        profit_margin: 0,
        tool_call_count: 0,
        tools_used: [],
      }));

      // Calculate summary
      const totalCost = summaryData.totals.total_cost;
      const totalConversations = summaryData.totals.conversations;
      const totalTokens = summaryData.totals.total_tokens;

      setSummary({
        totalConversations,
        totalCost,
        totalProfit: 0, // No profit for enterprise users with own API keys
        avgProfitMargin: 0,
        totalTokens,
        avgCostPerConversation: totalConversations > 0 ? totalCost / totalConversations : 0
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
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-600 mb-2 text-lg font-semibold">⚠️ Error loading analytics</div>
          <div className="text-gray-600 text-sm mb-4">{error}</div>
          <button 
            onClick={fetchAnalytics} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Usage Analytics</h1>
            <p className="text-sm text-gray-600 mt-1">Track your AI model usage and costs</p>
          </div>
          <div className="flex items-center gap-2">
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
                  {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total Cost */}
        <div className="p-4 bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Total Spend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${(summary?.totalCost || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ${((summary?.totalCost || 0) / (summary?.totalConversations || 1)).toFixed(3)} per conversation
          </p>
        </div>

        {/* Conversations */}
        <div className="p-4 bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Conversations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {(summary?.totalConversations || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            AI interactions
          </p>
        </div>

        {/* Tokens */}
        <div className="p-4 bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Zap className="h-4 w-4 text-green-600" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Total Tokens</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {((summary?.totalTokens || 0) / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {summary?.totalConversations ? Math.round((summary.totalTokens || 0) / summary.totalConversations).toLocaleString() : 0} avg per conversation
          </p>
        </div>
      </div>

      {/* Usage Trend Chart - Full Width */}
      <div className="mb-4">
        <UsageTrendChart
          data={dailyStats}
          metric="cost"
          title="Daily Cost Trend"
        />
      </div>

      {/* Conversation History */}
      <ConversationHistoryTable
        conversations={conversations}
        onExport={handleExport}
      />
    </div>
  );
}
