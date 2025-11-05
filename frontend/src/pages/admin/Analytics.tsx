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
  ResponsiveContainer,
} from 'recharts';
import { analyticsService } from '../../services/analyticsService';
import type { Organization } from '../../types/enterprise';

interface AdminContext {
  selectedOrg: Organization | null;
}

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
      <div className="min-h-screen bg-[#0d0c0c] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff6a3c]" />
          <span className="text-white text-lg">Loading analytics...</span>
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
              <TrendingUp className="w-8 h-8 text-[#ff6a3c]" />
              Admin Cost Analytics
            </h1>
            <p className="text-[#8d857b] mt-1">{selectedOrg?.display_name} - Team insights & performance</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="flex bg-[#161413] border border-[#1f1d1b] rounded-lg p-1">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setTimeRange(days)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    timeRange === days
                      ? 'bg-[#ff6a3c] text-white shadow-lg'
                      : 'text-[#8d857b] hover:text-white hover:bg-[#1f1d1b]'
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
              className="px-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50 hover:border-[#ff6a3c]/30 transition"
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
              className="px-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50 hover:border-[#ff6a3c]/30 transition"
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
                className="flex items-center gap-1 px-3 py-2 text-sm bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg hover:bg-[#2d2a27] transition font-medium"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#d94a1e] transition-colors font-medium text-sm shadow-lg"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards - Clean Bordered Style */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Cost */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-10 h-10 text-orange-400" />
              <span className="text-xs font-bold text-[#8d857b] uppercase">Total Cost</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              ${(filteredTotals.total_cost || 0).toFixed(2)}
            </div>
            <div className="text-sm text-[#8d857b]">
              ${((filteredTotals.total_cost || 0) / (filteredTotals.conversations || 1)).toFixed(4)} per conversation
            </div>
          </div>

          {/* Conversations */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="w-10 h-10 text-blue-400" />
              <span className="text-xs font-bold text-[#8d857b] uppercase">Sessions</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {(filteredTotals.conversations || 0).toLocaleString()}
            </div>
            <div className="text-sm text-[#8d857b]">
              ${((filteredTotals.total_cost || 0) / (filteredTotals.conversations || 1)).toFixed(3)} avg cost
            </div>
          </div>

          {/* Active Users */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-10 h-10 text-green-400" />
              <span className="text-xs font-bold text-[#8d857b] uppercase">Team Members</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              {(users?.users?.length || 0).toLocaleString()}
            </div>
            <div className="text-sm text-[#8d857b]">
              ${((filteredTotals.total_cost || 0) / (users?.users?.length || 1)).toFixed(2)} per user
            </div>
          </div>
        </div>

        {/* Cost Trend Chart - Enhanced Grafana Style */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#ff6a3c]/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-[#ff6a3c]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Team Cost Trend</h3>
                <p className="text-xs text-[#8d857b] mt-0.5">Historical team spending analysis</p>
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
              <BarChart data={filteredData.trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
              Showing {filteredData.trends?.length || 0} days of team activity
            </div>
            <div className="text-[#8d857b]">
              Total: <span className="text-[#ff6a3c] font-semibold">${(filteredData.trends?.reduce((sum: number, day: any) => sum + (day.total_cost || 0), 0) || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Row - User Leaderboard & Models Table */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Leaderboard */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-600/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Top Users</h3>
                <p className="text-xs text-[#8d857b] mt-0.5">Ranked by spending</p>
              </div>
            </div>
            <div className="space-y-2">
              {filteredData.users.slice(0, 8).map((user: any, index: number) => {
                const displayName = user.email || user.full_name || user.display_name || (user.user_id ? user.user_id.substring(0, 12) + '...' : 'Unknown User');
                return (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-3 bg-[#1f1d1b] rounded-lg hover:bg-[#2d2a27] transition-colors border border-[#2d2a27]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600/20 border border-blue-600/30 text-blue-400 font-bold text-xs flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white text-sm truncate">{displayName}</p>
                        <p className="text-xs text-[#8d857b]">{user.conversations} sessions · {(user.tokens / 1000).toFixed(0)}K tokens</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-orange-400 text-base">${user.total_cost.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Models Table */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-600/10 rounded-lg">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Top Models</h3>
                <p className="text-xs text-[#8d857b] mt-0.5">By usage & cost</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-[#2d2a27]">
                    <th className="text-left py-3 px-2 text-xs font-bold text-[#8d857b] uppercase">#</th>
                    <th className="text-left py-3 px-2 text-xs font-bold text-[#8d857b] uppercase">Model</th>
                    <th className="text-left py-3 px-2 text-xs font-bold text-[#8d857b] uppercase">Provider</th>
                    <th className="text-center py-3 px-2 text-xs font-bold text-[#8d857b] uppercase">Sessions</th>
                    <th className="text-right py-3 px-2 text-xs font-bold text-[#8d857b] uppercase">Cost</th>
                    <th className="text-right py-3 px-2 text-xs font-bold text-[#8d857b] uppercase">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d2a27]">
                  {filteredData.models?.slice(0, 8).map((model: any, index: number) => {
                    const provider = getProviderFromModel(model.model);
                    return (
                      <tr
                        key={model.model}
                        className="hover:bg-[#1f1d1b] transition-colors"
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-purple-600/20 border border-purple-600/30 text-purple-400 font-bold text-xs">
                            {index + 1}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <p className="font-semibold text-white text-sm truncate max-w-xs">{model.model}</p>
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-600/20 text-blue-400 border border-blue-600/30">
                            {provider}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <p className="text-sm text-white font-medium">{model.conversations}</p>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <p className="font-bold text-orange-400 text-sm">${model.cost.toFixed(2)}</p>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <p className="text-xs text-[#8d857b]">{(model.tokens / 1000).toFixed(0)}K</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
