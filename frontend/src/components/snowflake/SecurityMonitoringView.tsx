import { useState, useEffect, useCallback } from 'react';
import { Shield, Users, AlertTriangle, Lock, Loader2, TrendingUp, Activity, Eye, DollarSign } from 'lucide-react';
import securityService, { UserCost, AccessPattern, SecurityIssue, SecuritySummary } from '../../services/securityService';

interface Props {
  connectorId: string;
}

export default function SecurityMonitoringView({ connectorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [topUsers, setTopUsers] = useState<UserCost[]>([]);
  const [anomalies, setAnomalies] = useState<AccessPattern[]>([]);
  const [securityIssues, setSecurityIssues] = useState<SecurityIssue[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'anomalies' | 'permissions'>('users');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryData, usersData, anomaliesData, issuesData] = await Promise.all([
        securityService.getSecuritySummary(connectorId),
        securityService.getTopExpensiveUsers(connectorId, 10),
        securityService.getAnomalies(connectorId, 30),
        securityService.getSecurityIssues(connectorId),
      ]);

      setSummary(summaryData);
      setTopUsers(usersData);
      setAnomalies(anomaliesData);
      setSecurityIssues(issuesData);
    } catch (err) {
      console.error('Error loading security data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load security data');
    } finally {
      setLoading(false);
    }
  }, [connectorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getRiskColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-red-400';
    if (score >= 60) return 'text-orange-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-green-400';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6a3c]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-[#161413] border border-[#2d2a27] rounded-xl">
        <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Failed to Load Security Data</h3>
        <p className="text-[#8d857b] text-sm mb-4">{error}</p>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-[#ff6a3c] hover:bg-[#d94a1e] text-white rounded-lg font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Shield className="w-8 h-8 text-[#ff6a3c]" />
          Security & Access Monitoring
        </h2>
        <p className="text-[#8d857b] mt-1">Track user costs, access patterns, and security issues</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-purple-400" />
              <span className="text-[#8d857b] text-sm uppercase">Total Users</span>
            </div>
            <div className="text-3xl font-bold text-white">{summary.total_users}</div>
            <div className="text-sm text-purple-400 mt-1">Tracked users</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-blue-400" />
              <span className="text-[#8d857b] text-sm uppercase">Top Spender</span>
            </div>
            <div className="text-xl font-bold text-white truncate">{summary.top_spender}</div>
            <div className="text-sm text-blue-400 mt-1">{formatCurrency(summary.top_spender_cost)}</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
              <span className="text-[#8d857b] text-sm uppercase">Anomalies</span>
            </div>
            <div className="text-3xl font-bold text-white">{summary.anomalies_count}</div>
            <div className="text-sm text-orange-400 mt-1">Last 30 days</div>
          </div>

          <div className="bg-gradient-to-br from-red-500/10 to-red-600/10 border border-red-500/30 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="w-6 h-6 text-red-400" />
              <span className="text-[#8d857b] text-sm uppercase">Security Issues</span>
            </div>
            <div className="text-3xl font-bold text-white">{summary.security_issues_count}</div>
            <div className="text-sm text-red-400 mt-1">Requires attention</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-[#2d2a27]">
        <nav className="flex gap-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'users'
                ? 'text-[#ff6a3c] border-[#ff6a3c]'
                : 'text-[#8d857b] border-transparent hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              User Costs
            </span>
          </button>
          <button
            onClick={() => setActiveTab('anomalies')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'anomalies'
                ? 'text-[#ff6a3c] border-[#ff6a3c]'
                : 'text-[#8d857b] border-transparent hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Anomalies ({anomalies.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'permissions'
                ? 'text-[#ff6a3c] border-[#ff6a3c]'
                : 'text-[#8d857b] border-transparent hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Security Issues ({securityIssues.length})
            </span>
          </button>
        </nav>
      </div>

      {/* User Costs Tab */}
      {activeTab === 'users' && (
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[#2d2a27]">
            <h3 className="text-lg font-bold text-white">Top 10 Most Expensive Users</h3>
            <p className="text-sm text-[#8d857b] mt-1">Users ranked by total Snowflake spending</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0d0c0a]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">User</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Total Cost</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Queries</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Cost/Query</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Failed</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Top Warehouse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d2a27]">
                {topUsers.map((user, idx) => (
                  <tr key={idx} className="hover:bg-[#0d0c0a] transition-colors">
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        idx === 1 ? 'bg-gray-400/20 text-gray-400' :
                        idx === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-[#2d2a27] text-[#8d857b]'
                      }`}>
                        {idx + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-white">{user.user_name}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-bold text-[#ff6a3c]">{formatCurrency(user.total_cost_usd)}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#8d857b] text-right">{user.total_queries.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-[#8d857b] text-right">${(user.cost_per_query || 0).toFixed(4)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-medium ${
                        (user.failure_rate_pct || 0) > 5 ? 'text-red-400' : 'text-[#8d857b]'
                      }`}>
                        {user.failed_queries} ({(user.failure_rate_pct || 0).toFixed(1)}%)
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#8d857b]">{user.top_warehouse_name || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Anomalies Tab */}
      {activeTab === 'anomalies' && (
        <div className="space-y-4">
          {anomalies.length === 0 ? (
            <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-12 text-center">
              <Eye className="w-16 h-16 text-[#4a4745] mx-auto mb-4" />
              <h4 className="text-white font-medium mb-2">No Anomalies Detected</h4>
              <p className="text-sm text-[#8d857b]">No unusual access patterns found in the last 30 days</p>
            </div>
          ) : (
            anomalies.map((anomaly) => (
              <div
                key={anomaly.id}
                className="bg-[#161413] border-l-4 border-orange-500 rounded-r-xl p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertTriangle className="w-5 h-5 text-orange-400" />
                      <h4 className="text-white font-medium">{anomaly.user_name}</h4>
                      {anomaly.risk_score && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(anomaly.risk_score)} bg-current/10`}>
                          Risk: {anomaly.risk_score}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#8d857b]">{anomaly.anomaly_reason || 'Unusual access pattern detected'}</p>
                  </div>
                  <div className="text-right text-xs text-[#8d857b]">
                    {new Date(anomaly.event_timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#8d857b]">
                  {anomaly.source_ip && <span>IP: {anomaly.source_ip}</span>}
                  {anomaly.client_type && <span>Client: {anomaly.client_type}</span>}
                  <span>Type: {anomaly.event_type}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Security Issues Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          {securityIssues.length === 0 ? (
            <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-12 text-center">
              <Lock className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h4 className="text-white font-medium mb-2">No Security Issues</h4>
              <p className="text-sm text-[#8d857b]">All permissions are properly configured</p>
            </div>
          ) : (
            securityIssues.map((issue, idx) => (
              <div
                key={idx}
                className={`bg-[#161413] border rounded-xl p-6 ${getSeverityColor(issue.severity)}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Lock className="w-5 h-5" />
                      <h4 className="text-white font-medium">{issue.affected_entity}</h4>
                      <span className="px-2 py-1 rounded text-xs font-medium uppercase bg-current/20">
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-sm text-[#8d857b]">{issue.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{issue.issue_count}</div>
                    <div className="text-xs text-[#8d857b]">Issues</div>
                  </div>
                </div>
                <div className="text-xs uppercase tracking-wide text-[#8d857b]">
                  Type: {issue.issue_type.replace(/_/g, ' ')}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
