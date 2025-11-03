import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Users,
  MessageSquare,
  Download,
  Loader2,
  X,
} from 'lucide-react';
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
import { Card } from '../../components/ui/card';
import { analyticsService } from '../../services/analyticsService';
import type { Organization } from '../../types/enterprise';

interface AdminContext {
  selectedOrg: Organization | null;
}

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

export const Analytics: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  
  // Raw data
  const [data, setData] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [users, setUsers] = useState<any>(null);
  const [models, setModels] = useState<any>(null);
  
  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');

  useEffect(() => {
    if (selectedOrg) {
      loadAnalytics();
    }
  }, [selectedOrg, timeRange]);

  const loadAnalytics = async () => {
    if (!selectedOrg) return;
    
    try {
      setLoading(true);
      const [summaryData, trendsData, usersData, modelsData] = await Promise.all([
        analyticsService.getOrganizationSummary(selectedOrg.id, timeRange),
        analyticsService.getOrganizationTrends(selectedOrg.id, timeRange),
        analyticsService.getOrganizationUserBreakdown(selectedOrg.id, timeRange),
        analyticsService.getOrganizationModelBreakdown(selectedOrg.id, timeRange),
      ]);

      setData(summaryData);
      setTrends(trendsData);
      setUsers(usersData);
      setModels(modelsData);

      console.log('[Analytics] Data loaded successfully');
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on selections
  const filteredData = useMemo(() => {
    if (!users?.users || !models?.models || !trends?.trends) {
      return { users: [], models: [], trends: [] };
    }

    let filteredUsers = users.users;
    let filteredModels = models.models;
    const filteredTrends = trends.trends;

    // Apply user filter
    if (selectedUser) {
      filteredUsers = filteredUsers.filter((u: any) => 
        u.user_id === selectedUser
      );
    }

    // Apply model filter
    if (selectedModel) {
      filteredModels = filteredModels.filter((m: any) =>
        m.model === selectedModel
      );
    }

    return {
      users: filteredUsers,
      models: filteredModels,
      trends: filteredTrends,
    };
  }, [users, models, trends, selectedUser, selectedModel]);

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    const userTotal = filteredData.users.reduce((sum: number, u: any) => sum + u.total_cost, 0);
    const conversationCount = filteredData.users.reduce((sum: number, u: any) => sum + u.conversations, 0);
    const tokenCount = filteredData.users.reduce((sum: number, u: any) => sum + u.tokens, 0);

    return {
      total_cost: userTotal || data?.totals?.total_cost || 0,
      conversations: conversationCount || data?.totals?.conversations || 0,
      tokens: tokenCount || data?.totals?.tokens || 0,
      active_users: filteredData.users.length || data?.totals?.active_users || 0,
    };
  }, [filteredData, data]);

  const handleExport = async () => {
    if (!selectedOrg) return;
    try {
      await analyticsService.exportOrganizationAnalytics(selectedOrg.id);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    }
  };

  const clearFilters = () => {
    setSelectedUser('');
    setSelectedModel('');
  };

  const hasActiveFilters = selectedUser !== '' || selectedModel !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Cost Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">{selectedOrg?.display_name}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    timeRange === days
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {days} days
                </button>
              ))}
            </div>

            {/* Filter by User */}
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="">All Users</option>
              {users?.users?.map((user: any) => {
                const displayName = user.email || user.full_name || user.display_name || user.user_id.substring(0, 12) + '...';
                return (
                  <option key={user.user_id} value={user.user_id}>
                    {displayName}
                  </option>
                );
              })}
            </select>

            {/* Filter by Model */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            >
              <option value="">All Models</option>
              {models?.models?.map((model: any) => (
                <option key={model.model} value={model.model}>
                  {model.model}
                </option>
              ))}
            </select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {/* Summary Cards - Clean Enterprise Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Total Cost */}
          <Card className="p-6 bg-white border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Cost</p>
          <p className="text-3xl font-bold text-gray-900">
            ${(filteredTotals.total_cost || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            ${((filteredTotals.total_cost || 0) / (filteredTotals.conversations || 1)).toFixed(3)} per conversation
          </p>
          </Card>

          {/* Conversations */}
          <Card className="p-6 bg-white border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <MessageSquare className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Conversations</p>
          <p className="text-3xl font-bold text-gray-900">
            {(filteredTotals.conversations || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            ${((filteredTotals.total_cost || 0) / (filteredTotals.conversations || 1)).toFixed(3)} avg
          </p>
          </Card>

          {/* Active Users */}
          <Card className="p-6 bg-white border border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <Users className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Active Users</p>
          <p className="text-3xl font-bold text-gray-900">
            {(users?.users?.length || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            ${((filteredTotals.total_cost || 0) / (users?.users?.length || 1)).toFixed(2)} per user
          </p>
          </Card>
        </div>

        {/* Cost Trend Chart - Full Width */}
        <div className="mb-6">
          <Card className="p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Cost Trend</h3>
              <p className="text-xs text-gray-500 mt-0.5">Daily spending over time</p>
            </div>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={filteredData.trends} barSize={20}>
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
                fill={COLORS.primary}
                name="Cost"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          </Card>
        </div>

        {/* Bottom Row - User Leaderboard & Provider Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Leaderboard */}
          <Card className="p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Top Users</h3>
              <p className="text-xs text-gray-500 mt-0.5">By spending</p>
            </div>
            <Users className="h-4 w-4 text-gray-400" />
          </div>
          <div className="space-y-2">
            {filteredData.users.slice(0, 6).map((user: any, index: number) => {
              // Debug: Log user data
              if (index === 0) {
                console.log('[Analytics] User data sample:', user);
              }
              // Show complete email address, fallback to full name or user ID
              const displayName = user.email || user.full_name || user.display_name || (user.user_id ? user.user_id.substring(0, 12) + '...' : 'Unknown User');
              return (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 font-semibold text-xs flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-xs truncate">{displayName}</p>
                      <p className="text-xs text-gray-500">{user.conversations} convs</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900 text-sm">${user.total_cost.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{(user.tokens / 1000).toFixed(0)}K</p>
                  </div>
                </div>
              );
            })}
          </div>
          </Card>

          {/* Top Models */}
          <Card className="p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Top Models</h3>
              <p className="text-xs text-gray-500 mt-0.5">By usage & cost</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600">#</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600">Model</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600">Provider</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-gray-600">Conversations</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-600">Cost</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-gray-600">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.models?.slice(0, 10).map((model: any, index: number) => {
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
                      <td className="py-2 px-2 text-right">
                        <p className="text-xs text-gray-500">{(model.tokens / 1000).toFixed(0)}K</p>
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
    </div>
  );
};

export default Analytics;
