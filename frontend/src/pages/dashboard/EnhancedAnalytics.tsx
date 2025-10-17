import { useState, useEffect, useCallback } from 'react';
import { BarChart3, DollarSign, Zap, Download, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { userAnalyticsService } from '../../services/userAnalyticsService';
import { ConversationHistoryTable } from '../../components/analytics/ConversationHistoryTable';
import { Card } from '../../components/ui/card';

interface AnalyticsSummary {
  totalConversations: number;
  totalCost: number;
  totalTokens: number;
  avgCostPerConversation: number;
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
        status: (conv.status || 'completed') as any,
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

      setSummary({
        totalConversations,
        totalCost,
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
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Usage Analytics</h1>
            <p className="text-sm text-gray-600 mt-1">Track your AI model usage and costs</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    timeRange === range
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards - Clean Enterprise Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total Cost */}
        <Card className="p-6 bg-white hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Cost</p>
          <p className="text-3xl font-bold text-gray-900">
            ${(summary?.totalCost || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            ${((summary?.totalCost || 0) / (summary?.totalConversations || 1)).toFixed(3)} per conversation
          </p>
        </Card>

        {/* Conversations */}
        <Card className="p-6 bg-white hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Conversations</p>
          <p className="text-3xl font-bold text-gray-900">
            {(summary?.totalConversations || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            ${((summary?.totalCost || 0) / (summary?.totalConversations || 1)).toFixed(3)} avg
          </p>
        </Card>

        {/* Tokens */}
        <Card className="p-6 bg-white hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Zap className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Tokens</p>
          <p className="text-3xl font-bold text-gray-900">
            {((summary?.totalTokens || 0) / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {summary?.totalConversations ? Math.round((summary.totalTokens || 0) / summary.totalConversations).toLocaleString() : 0} avg per conversation
          </p>
        </Card>
      </div>

      {/* Usage Trend Chart - Full Width */}
      <div className="mb-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Daily Cost Trend</h3>
              <p className="text-xs text-gray-500 mt-0.5">Daily spending over time</p>
            </div>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyStats} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="usage_date"
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                stroke="#999"
                style={{ fontSize: '11px' }}
              />
              <YAxis stroke="#999" style={{ fontSize: '11px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => `$${value.toFixed(2)}`}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar
                dataKey="total_cost"
                fill="#3b82f6"
                name="Cost"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Conversation History */}
      <ConversationHistoryTable
        conversations={conversations}
        onExport={handleExport}
      />
    </div>
  );
}
