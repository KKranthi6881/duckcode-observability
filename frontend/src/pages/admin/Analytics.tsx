import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Users,
  MessageSquare,
  Download,
  ArrowUp,
  ArrowDown,
  Loader2,
  Filter,
  X,
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
  PieChart,
  Pie,
  Cell,
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

const PROVIDER_COLORS: Record<string, string> = {
  'openai': COLORS.primary,
  'anthropic': COLORS.purple,
  'google': COLORS.success,
  'gpt': COLORS.primary,
  'claude': COLORS.purple,
  'gemini': COLORS.success,
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
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

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

  // Group models by provider
  const providerData = useMemo(() => {
    if (!models?.models) return [];
    
    const providerMap: Record<string, { provider: string; conversations: number; cost: number; tokens: number }> = {};
    
    models.models.forEach((m: any) => {
      const provider = getProviderFromModel(m.model);
      if (!providerMap[provider]) {
        providerMap[provider] = { provider, conversations: 0, cost: 0, tokens: 0 };
      }
      providerMap[provider].conversations += m.conversations || 0;
      providerMap[provider].cost += m.cost || 0;
      providerMap[provider].tokens += m.tokens || 0;
    });

    return Object.values(providerMap).sort((a, b) => b.cost - a.cost);
  }, [models]);

  // Available providers for filter
  const availableProviders = useMemo(() => {
    return providerData.map(p => p.provider);
  }, [providerData]);

  // Filter data based on selections
  const filteredData = useMemo(() => {
    if (!users?.users || !providerData.length || !trends?.trends) {
      return { users: [], providers: [], trends: [] };
    }

    let filteredUsers = users.users;
    let filteredProviders = providerData;
    const filteredTrends = trends.trends;

    // Apply user filter
    if (selectedUsers.length > 0) {
      filteredUsers = filteredUsers.filter((u: any) => 
        selectedUsers.includes(u.user_id)
      );
    }

    // Apply provider filter
    if (selectedProviders.length > 0) {
      filteredProviders = filteredProviders.filter((p: any) =>
        selectedProviders.includes(p.provider)
      );
    }

    return {
      users: filteredUsers,
      providers: filteredProviders,
      trends: filteredTrends,
    };
  }, [users, providerData, trends, selectedUsers, selectedProviders]);

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
      profit: (userTotal * 0.5) || data?.totals?.profit || 0,
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
    setSelectedUsers([]);
    setSelectedProviders([]);
  };

  const hasActiveFilters = selectedUsers.length > 0 || selectedProviders.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      {/* Header with Filters */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">{selectedOrg?.display_name}</p>
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

            {/* Filter Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                hasActiveFilters
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-700 text-xs rounded-full">
                  {selectedUsers.length + selectedProviders.length}
                </span>
              )}
            </button>

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

        {/* Filter Panel */}
        {showFilters && (
          <Card className="p-4 mb-4 bg-white border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Active Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Users Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Users</label>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
                  {filteredData.users.slice(0, 10).map((user: any) => {
                    // Show complete email address
                    const displayName = user.email || user.full_name || user.display_name || user.user_id.substring(0, 16) + '...';
                    return (
                      <label key={user.user_id} className="flex items-center gap-2 text-sm hover:bg-white p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.user_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user.user_id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user.user_id));
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-700 truncate">{displayName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Providers Filter */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">AI Providers</label>
                <div className="space-y-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
                  {availableProviders.map((provider) => (
                    <label key={provider} className="flex items-center gap-2 text-sm hover:bg-white p-1 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProviders.includes(provider)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProviders([...selectedProviders, provider]);
                          } else {
                            setSelectedProviders(selectedProviders.filter(p => p !== provider));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700">{provider}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Summary Cards - Compact */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total Cost */}
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <ArrowUp className="h-3 w-3" />
              12%
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${(filteredTotals.total_cost || 0).toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ${((filteredTotals.total_cost || 0) / (filteredTotals.conversations || 1)).toFixed(3)} per conversation
          </p>
        </Card>

        {/* Conversations */}
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MessageSquare className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <ArrowUp className="h-3 w-3" />
              8%
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Conversations</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {(filteredTotals.conversations || 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ${((filteredTotals.total_cost || 0) / (filteredTotals.conversations || 1)).toFixed(3)} avg
          </p>
        </Card>

        {/* Active Users */}
        <Card className="p-4 bg-gradient-to-br from-green-50 to-white border-green-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <ArrowDown className="h-3 w-3" />
              3%
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600">Active Users</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {filteredTotals.active_users || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ${((filteredTotals.total_cost || 0) / (filteredTotals.active_users || 1)).toFixed(2)} per user
          </p>
        </Card>

      </div>

      {/* Charts Row - Cost Trend (Area Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Cost Trend */}
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Cost Trend</h3>
              <p className="text-xs text-gray-500 mt-0.5">Daily spending over time</p>
            </div>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={filteredData.trends}>
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

        {/* Provider Distribution - Pie */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">AI Providers</h3>
              <p className="text-xs text-gray-500 mt-0.5">By cost</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={filteredData.providers}
                dataKey="cost"
                nameKey="provider"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry: any) => entry.provider}
                labelLine={false}
              >
                {filteredData.providers.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={PROVIDER_COLORS[entry.provider.toLowerCase()] || Object.values(COLORS)[index % Object.values(COLORS).length]} 
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bottom Row - User Leaderboard & Provider Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Leaderboard */}
        <Card className="p-4">
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
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Top Models</h3>
              <p className="text-xs text-gray-500 mt-0.5">By usage & cost</p>
            </div>
          </div>
          <div className="space-y-2">
            {models?.models?.slice(0, 6).map((model: any, index: number) => {
              const provider = getProviderFromModel(model.model);
              return (
                <div
                  key={model.model}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600 font-semibold text-xs flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-xs truncate">{model.model}</p>
                      <p className="text-xs text-gray-500">{provider} • {model.conversations} convs</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900 text-sm">${model.cost.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{(model.tokens / 1000).toFixed(0)}K</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;
