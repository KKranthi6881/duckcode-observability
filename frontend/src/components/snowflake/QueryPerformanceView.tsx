import { useEffect, useState, useCallback } from 'react';
import { Activity, TrendingDown, Clock, AlertTriangle, Loader2, Code, X } from 'lucide-react';
import { supabase } from '../../config/supabaseClient';

interface Props {
  connectorId: string;
}

interface ExpensiveQuery {
  query_hash: string;
  query_text: string;
  warehouse_name: string;
  execution_count: number;
  total_cost: number;
  avg_execution_time_ms: number;
  total_bytes_scanned: number;
}

export default function QueryPerformanceView({ connectorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expensiveQueries, setExpensiveQueries] = useState<ExpensiveQuery[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<ExpensiveQuery | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState<'cost' | 'time' | 'count'>('cost');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Query the snowflake_query_patterns table for expensive queries
      const { data, error: queryError } = await supabase
        .schema('enterprise')
        .from('snowflake_query_patterns')
        .select('*')
        .eq('connector_id', connectorId)
        .order('total_execution_time_ms', { ascending: false })
        .limit(100);

      if (queryError) throw queryError;

      // Transform data and calculate costs
      const queries: ExpensiveQuery[] = (data || []).map((row) => ({
        query_hash: row.query_hash,
        query_text: row.query_text || '',
        warehouse_name: row.warehouse_name || 'Unknown',
        execution_count: row.execution_count || 0,
        total_cost: ((row.total_execution_time_ms || 0) / 1000 / 3600) * 2, // Rough cost estimate
        avg_execution_time_ms: row.avg_execution_time_ms || 0,
        total_bytes_scanned: row.total_bytes_scanned || 0,
      }));

      setExpensiveQueries(queries);
    } catch (err) {
      console.error('Error loading query performance:', err);
      setError(err instanceof Error ? err.message : 'Failed to load query performance data');
      setExpensiveQueries([]);
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const getSortedQueries = () => {
    const sorted = [...expensiveQueries];
    if (sortBy === 'cost') {
      return sorted.sort((a, b) => b.total_cost - a.total_cost);
    } else if (sortBy === 'time') {
      return sorted.sort((a, b) => b.avg_execution_time_ms - a.avg_execution_time_ms);
    } else {
      return sorted.sort((a, b) => b.execution_count - a.execution_count);
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
        <h3 className="text-xl font-bold text-white mb-2">Failed to Load Query Performance</h3>
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

  const sortedQueries = getSortedQueries();
  const topQueries = sortedQueries.slice(0, 50);

  // Calculate summary stats
  const totalCost = expensiveQueries.reduce((sum, q) => sum + q.total_cost, 0);
  const totalExecutions = expensiveQueries.reduce((sum, q) => sum + q.execution_count, 0);
  const avgExecutionTime = expensiveQueries.reduce((sum, q) => sum + q.avg_execution_time_ms, 0) / (expensiveQueries.length || 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Activity className="w-8 h-8 text-[#ff6a3c]" />
          Query Performance Analysis
        </h2>
        <p className="text-[#8d857b] mt-1">Identify expensive and slow queries</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-6 h-6 text-purple-400" />
            <span className="text-[#8d857b] text-xs font-bold uppercase">Total Queries</span>
          </div>
          <div className="text-3xl font-bold text-white">{expensiveQueries.length}</div>
          <div className="text-[#8d857b] text-sm mt-1">Analyzed patterns</div>
        </div>

        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <TrendingDown className="w-6 h-6 text-red-400" />
            <span className="text-[#8d857b] text-xs font-bold uppercase">Total Cost</span>
          </div>
          <div className="text-3xl font-bold text-red-400">{formatCurrency(totalCost)}</div>
          <div className="text-[#8d857b] text-sm mt-1">Last 30 days</div>
        </div>

        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-6 h-6 text-blue-400" />
            <span className="text-[#8d857b] text-xs font-bold uppercase">Avg Time</span>
          </div>
          <div className="text-3xl font-bold text-blue-400">{formatTime(avgExecutionTime)}</div>
          <div className="text-[#8d857b] text-sm mt-1">Per execution</div>
        </div>

        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            <span className="text-[#8d857b] text-xs font-bold uppercase">Executions</span>
          </div>
          <div className="text-3xl font-bold text-white">{totalExecutions.toLocaleString()}</div>
          <div className="text-[#8d857b] text-sm mt-1">Total runs</div>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex gap-3">
        <button
          onClick={() => setSortBy('cost')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            sortBy === 'cost'
              ? 'bg-[#ff6a3c] text-white'
              : 'bg-[#161413] border border-[#2d2a27] text-[#8d857b] hover:text-white'
          }`}
        >
          Sort by Cost
        </button>
        <button
          onClick={() => setSortBy('time')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            sortBy === 'time'
              ? 'bg-[#ff6a3c] text-white'
              : 'bg-[#161413] border border-[#2d2a27] text-[#8d857b] hover:text-white'
          }`}
        >
          Sort by Time
        </button>
        <button
          onClick={() => setSortBy('count')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            sortBy === 'count'
              ? 'bg-[#ff6a3c] text-white'
              : 'bg-[#161413] border border-[#2d2a27] text-[#8d857b] hover:text-white'
          }`}
        >
          Sort by Frequency
        </button>
      </div>

      {/* Top Queries Table */}
      <div className="bg-[#161413] border border-[#2d2a27] rounded-xl overflow-hidden">
        <div className="p-6 border-b border-[#2d2a27]">
          <h3 className="text-lg font-bold text-white">Top 50 Queries</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0d0c0a]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                  Query Preview
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                  Executions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                  Avg Time
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                  Data Scanned
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                  Total Cost
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d2a27]">
              {topQueries.map((query) => (
                <tr key={query.query_hash} className="hover:bg-[#0d0c0a] transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm text-white font-mono max-w-md truncate">
                      {query.query_text.substring(0, 100)}...
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#8d857b]">
                    {query.warehouse_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-white">
                    {query.execution_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={`${
                      query.avg_execution_time_ms > 60000 ? 'text-red-400' :
                      query.avg_execution_time_ms > 10000 ? 'text-orange-400' :
                      'text-green-400'
                    } font-medium`}>
                      {formatTime(query.avg_execution_time_ms)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-[#8d857b]">
                    {formatBytes(query.total_bytes_scanned)}
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    <span className={`${
                      query.total_cost > 50 ? 'text-red-400' :
                      query.total_cost > 10 ? 'text-orange-400' :
                      'text-green-400'
                    } font-bold`}>
                      {formatCurrency(query.total_cost)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => {
                        setSelectedQuery(query);
                        setShowModal(true);
                      }}
                      className="p-2 hover:bg-[#2d2a27] rounded-lg transition-colors"
                    >
                      <Code className="w-4 h-4 text-[#ff6a3c]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Query Detail Modal */}
      {showModal && selectedQuery && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-[#161413] border-b border-[#2d2a27] p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Query Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-[#2d2a27] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-[#8d857b] text-xs uppercase mb-1">Warehouse</div>
                  <div className="text-white font-medium">{selectedQuery.warehouse_name}</div>
                </div>
                <div>
                  <div className="text-[#8d857b] text-xs uppercase mb-1">Executions</div>
                  <div className="text-white font-medium">{selectedQuery.execution_count.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[#8d857b] text-xs uppercase mb-1">Avg Time</div>
                  <div className="text-blue-400 font-medium">{formatTime(selectedQuery.avg_execution_time_ms)}</div>
                </div>
                <div>
                  <div className="text-[#8d857b] text-xs uppercase mb-1">Total Cost</div>
                  <div className="text-red-400 font-bold">{formatCurrency(selectedQuery.total_cost)}</div>
                </div>
              </div>

              {/* Query Text */}
              <div>
                <div className="text-[#8d857b] text-sm font-medium mb-2">Query Text</div>
                <div className="bg-[#0d0c0a] border border-[#2d2a27] rounded-lg p-4">
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap overflow-x-auto">
                    {selectedQuery.query_text}
                  </pre>
                </div>
              </div>

              {/* Optimization Suggestions */}
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-yellow-400 font-medium mb-2">Optimization Suggestions</div>
                    <ul className="text-[#8d857b] text-sm space-y-1 list-disc list-inside">
                      {selectedQuery.execution_count > 10 && (
                        <li>Query runs {selectedQuery.execution_count}x - consider result caching</li>
                      )}
                      {selectedQuery.avg_execution_time_ms > 60000 && (
                        <li>Query is slow (&gt;1 min) - review query plan and add indexes</li>
                      )}
                      {selectedQuery.total_bytes_scanned > 1073741824 && (
                        <li>Large data scan - consider partitioning or clustering</li>
                      )}
                      {selectedQuery.query_text.includes('SELECT *') && (
                        <li>SELECT * detected - specify only needed columns</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
