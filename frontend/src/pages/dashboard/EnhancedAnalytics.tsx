import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, DollarSign, Zap, Download, RefreshCw } from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import { CostBreakdownCard } from '../../components/analytics/CostBreakdownCard';
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view analytics');
        return;
      }

      const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch daily stats
      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_conversation_stats')
        .select('*')
        .eq('user_id', user.id)
        .gte('usage_date', startDate.toISOString().split('T')[0])
        .order('usage_date', { ascending: true });

      if (dailyError) throw dailyError;

      // Fetch individual conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversation_analytics')
        .select('*')
        .eq('user_id', user.id)
        .gte('started_at', startDate.toISOString())
        .order('started_at', { ascending: false })
        .limit(100);

      if (conversationsError) throw conversationsError;

      // Calculate summary
      const totalCost = (dailyData || []).reduce((sum, day) => sum + (day.charged_cost || day.total_cost || 0), 0);
      const totalApiCost = (dailyData || []).reduce((sum, day) => sum + (day.actual_api_cost || 0), 0);
      const totalProfit = totalCost - totalApiCost;
      const totalConversations = (dailyData || []).reduce((sum, day) => sum + (day.total_conversations || 0), 0);
      const totalTokensIn = (dailyData || []).reduce((sum, day) => sum + (day.total_tokens_in || 0), 0);
      const totalTokensOut = (dailyData || []).reduce((sum, day) => sum + (day.total_tokens_out || 0), 0);

      setSummary({
        totalConversations,
        totalCost,
        totalProfit,
        avgProfitMargin: totalApiCost > 0 ? (totalProfit / totalApiCost) * 100 : 0,
        totalTokens: totalTokensIn + totalTokensOut,
        avgCostPerConversation: totalConversations > 0 ? totalCost / totalConversations : 0
      });

      setDailyStats(dailyData || []);
      setConversations(conversationsData || []);

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
      Tokens: conv.total_tokens_in + conv.total_tokens_out,
      Cost: conv.total_cost,
      'API Cost': conv.actual_api_cost || 0,
      Profit: conv.profit_amount || 0,
      'Profit Margin %': conv.profit_margin || 0
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
            onClick={fetchAnalytics} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Comprehensive insights into your DuckCode IDE usage</p>
        </div>
        
        <div className="flex items-center space-x-3">
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

          {/* Refresh Button */}
          <button
            onClick={fetchAnalytics}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh data"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Sidebar - Compact Metrics */}
        <div className="lg:col-span-2 space-y-2">
          {/* Key Metrics - Clean Modern Style */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-600 text-xs font-medium uppercase tracking-wider">Total Revenue</span>
              <div className="p-1.5 bg-blue-50 rounded">
                <DollarSign className="h-3.5 w-3.5 text-blue-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5">${summary?.totalCost.toFixed(2)}</p>
            <p className="text-gray-500 text-xs">
              {summary?.totalConversations} conversations
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-600 text-xs font-medium uppercase tracking-wider">Net Profit</span>
              <div className="p-1.5 bg-green-50 rounded">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5">${summary?.totalProfit.toFixed(2)}</p>
            <div className="flex items-center space-x-1">
              <span className="text-green-600 text-xs font-semibold">{summary?.avgProfitMargin.toFixed(1)}%</span>
              <span className="text-gray-500 text-xs">margin</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-600 text-xs font-medium uppercase tracking-wider">Total Tokens</span>
              <div className="p-1.5 bg-purple-50 rounded">
                <Zap className="h-3.5 w-3.5 text-purple-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5">
              {summary?.totalTokens ? (summary.totalTokens / 1000000).toFixed(2) : 0}M
            </p>
            <p className="text-gray-500 text-xs">
              {summary?.totalConversations ? Math.round(summary.totalTokens / summary.totalConversations).toLocaleString() : 0} avg/conv
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-600 text-xs font-medium uppercase tracking-wider">Avg Cost/Conv</span>
              <div className="p-1.5 bg-orange-50 rounded">
                <BarChart3 className="h-3.5 w-3.5 text-orange-600" />
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-0.5">${summary?.avgCostPerConversation.toFixed(4)}</p>
            <p className="text-gray-500 text-xs">per conversation</p>
          </div>

          {/* Cost Breakdown - Compact */}
          {dailyStats.length > 0 && (
            <CostBreakdownCard
              totalCost={summary?.totalCost || 0}
              actualCost={dailyStats.reduce((sum, day) => sum + (day.actual_api_cost || 0), 0)}
              profitAmount={summary?.totalProfit || 0}
              profitMargin={summary?.avgProfitMargin || 0}
              inputCost={dailyStats.reduce((sum, day) => sum + (day.input_cost || 0), 0)}
              outputCost={dailyStats.reduce((sum, day) => sum + (day.output_cost || 0), 0)}
              cacheCost={dailyStats.reduce((sum, day) => sum + (day.cache_cost || 0), 0)}
            />
          )}
        </div>

        {/* Right Side - Charts taking more space */}
        <div className="lg:col-span-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <UsageTrendChart
              data={dailyStats}
              metric="cost"
              title="Daily Revenue Trend"
            />
            <UsageTrendChart
              data={dailyStats}
              metric="profit"
              title="Daily Profit Trend"
            />
            <UsageTrendChart
              data={dailyStats}
              metric="conversations"
              title="Daily Conversations"
            />
            <UsageTrendChart
              data={dailyStats}
              metric="tokens"
              title="Daily Token Usage"
            />
          </div>
        </div>
      </div>

      {/* Conversation History */}
      <ConversationHistoryTable
        conversations={conversations}
        onExport={handleExport}
      />

      {/* Export All Data */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Download className="h-5 w-5" />
          <span className="font-medium">Export All Data</span>
        </button>
      </div>
    </div>
  );
}
