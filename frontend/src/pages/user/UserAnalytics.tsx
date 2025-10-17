import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  MessageSquare,
  Download,
  Loader2,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../../components/ui/card';
import { userAnalyticsService } from '../../services/userAnalyticsService';

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
};

// Helper to extract provider from model name
const getProviderFromModel = (modelName: string): string => {
  const lower = modelName.toLowerCase();
  if (lower.includes('gpt') || lower.includes('openai')) return 'OpenAI';
  if (lower.includes('claude') || lower.includes('anthropic')) return 'Anthropic';
  if (lower.includes('gemini') || lower.includes('google')) return 'Google';
  if (lower.includes('llama')) return 'Meta';
  return 'Other';
};

export const UserAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  
  // Raw data
  const [summary, setSummary] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [models, setModels] = useState<any>(null);
  const [recentConversations, setRecentConversations] = useState<any>(null);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [summaryData, trendsData, modelsData, conversationsData] = await Promise.all([
        userAnalyticsService.getUserSummary(timeRange),
        userAnalyticsService.getUserTrends(timeRange),
        userAnalyticsService.getUserModelBreakdown(timeRange),
        userAnalyticsService.getUserRecentConversations(10),
      ]);

      setSummary(summaryData);
      setTrends(trendsData);
      setModels(modelsData);
      setRecentConversations(conversationsData);

      console.log('[UserAnalytics] Data loaded successfully');
    } catch (error) {
      console.error('Failed to load user analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      await userAnalyticsService.exportUserAnalytics(timeRange);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Usage Analytics</h1>
            <p className="text-sm text-gray-600 mt-1">Track your AI model usage and costs</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Time Range */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>

            {/* Export */}
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
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Total Spend</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${(summary?.totals?.total_cost || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ${((summary?.totals?.total_cost || 0) / (summary?.totals?.conversations || 1)).toFixed(3)} per conversation
          </p>
        </Card>

        {/* Conversations */}
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Conversations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {(summary?.totals?.conversations || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            AI interactions
          </p>
        </Card>

        {/* Tokens */}
        <Card className="p-4 bg-gradient-to-br from-green-50 to-white border-green-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="h-4 w-4 text-green-600" />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Total Tokens</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {((summary?.totals?.total_tokens || 0) / 1000).toFixed(0)}K
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {((summary?.totals?.tokens_in || 0) / 1000).toFixed(0)}K in • {((summary?.totals?.tokens_out || 0) / 1000).toFixed(0)}K out
          </p>
        </Card>
      </div>

      {/* Cost Trend Chart - Full Width */}
      <div className="mb-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Cost Trend</h3>
              <p className="text-xs text-gray-500 mt-0.5">Daily spending over time</p>
            </div>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trends?.trends || []}>
              <defs>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
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
              <Area
                type="monotone"
                dataKey="total_cost"
                stroke={COLORS.primary}
                fillOpacity={1}
                fill="url(#colorCost)"
                name="Cost"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom Row - Recent Conversations & Model Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Conversations */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Recent Conversations</h3>
              <p className="text-xs text-gray-500 mt-0.5">Latest AI interactions</p>
            </div>
            <MessageSquare className="h-4 w-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            {recentConversations?.conversations?.slice(0, 6).map((conv: any) => {
              const provider = getProviderFromModel(conv.model_name);
              const displayTitle = conv.topic_title || 'Untitled Conversation';
              return (
                <div
                  key={conv.conversation_id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-xs truncate">{displayTitle}</p>
                      <p className="text-xs text-gray-500">
                        {conv.model_name} • {new Date(conv.created_at).toLocaleDateString()} • {provider}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900 text-sm">${conv.total_cost.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{((conv.total_tokens_in + conv.total_tokens_out) / 1000).toFixed(0)}K</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Model Breakdown */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Model Usage</h3>
              <p className="text-xs text-gray-500 mt-0.5">By cost & conversations</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600">#</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600">Model</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600">Provider</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-600">Convs</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-600">Cost</th>
                </tr>
              </thead>
              <tbody>
                {models?.models?.slice(0, 6).map((model: any, index: number) => {
                  const provider = getProviderFromModel(model.model);
                  return (
                    <tr
                      key={model.model}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 font-semibold text-xs">
                          {index + 1}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <p className="font-medium text-gray-900 text-xs truncate max-w-xs">{model.model}</p>
                      </td>
                      <td className="py-2 px-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {provider}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        <p className="text-xs text-gray-600">{model.conversations}</p>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <p className="font-semibold text-gray-900 text-sm">${model.cost.toFixed(2)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UserAnalytics;
