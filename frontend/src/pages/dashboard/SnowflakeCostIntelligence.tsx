import { useEffect, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { 
  TrendingUp, 
  Database, 
  Server, 
  DollarSign, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Target,
  Activity,
  Lightbulb,
  BarChart3,
  Trash2
} from 'lucide-react';
import snowflakeCostPhase1Service, { 
  CostOverview, 
  StorageUsageRow, 
  WasteDetectionData 
} from '../../services/snowflakeCostPhase1Service';
import enterpriseService from '../../services/enterpriseService';
import { snowflakeCostService, ConnectorItem } from '../../services/snowflakeCostService';
import RecommendationsView from '../../components/snowflake/RecommendationsView';
import ROITrackerView from '../../components/snowflake/ROITrackerView';
import QueryPerformanceView from '../../components/snowflake/QueryPerformanceView';

interface ConnectorWithOrg extends ConnectorItem {
  organization_id: string;
}

type TabType = 'overview' | 'recommendations' | 'roi' | 'performance' | 'storage' | 'waste';

export default function SnowflakeCostIntelligence() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Organization and connector selection
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorWithOrg[]>([]);
  const [connectorId, setConnectorId] = useState<string | null>(null);

  // Data
  const [costOverview, setCostOverview] = useState<CostOverview | null>(null);
  const [storageData, setStorageData] = useState<StorageUsageRow[]>([]);
  const [wasteData, setWasteData] = useState<WasteDetectionData | null>(null);
  const [timePeriod, setTimePeriod] = useState<7 | 30 | 90>(30);

  // Load organizations
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const orgs = await enterpriseService.organization.getUserOrganizations();
        const simplified = orgs.map((o: { organization_id: string; organization_name?: string }) => ({ 
          id: o.organization_id, 
          name: o.organization_name || o.organization_id 
        }));
        setOrganizations(simplified);
        const pickedOrg = simplified[0]?.id || null;
        setOrganizationId(prev => prev || pickedOrg);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load organizations';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Load connectors when organization changes
  useEffect(() => {
    const loadConnectors = async () => {
      if (!organizationId) return;
      try {
        setLoading(true);
        const items = await snowflakeCostService.listSnowflakeConnectors(organizationId);
        setConnectors(items as ConnectorWithOrg[]);
        if (!connectorId && items.length > 0) setConnectorId(items[0].id);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load connectors';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    loadConnectors();
  }, [organizationId, connectorId]);

  // Load cost data
  useEffect(() => {
    const loadData = async () => {
      if (!connectorId) return;
      try {
        setLoading(true);
        setError(null);

        const [overview, storage, waste] = await Promise.all([
          snowflakeCostPhase1Service.getCostOverview(connectorId, timePeriod),
          snowflakeCostPhase1Service.getStorageUsage(connectorId),
          snowflakeCostPhase1Service.getWasteDetection(connectorId),
        ]);

        setCostOverview(overview);
        setStorageData(storage);
        setWasteData(waste);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load cost data';
        setError(msg);
        console.error('Cost data load error:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [connectorId, timePeriod]);

  const handleRefresh = async () => {
    if (!connectorId) return;
    setRefreshing(true);
    try {
      const [overview, storage, waste] = await Promise.all([
        snowflakeCostPhase1Service.getCostOverview(connectorId, timePeriod),
        snowflakeCostPhase1Service.getStorageUsage(connectorId),
        snowflakeCostPhase1Service.getWasteDetection(connectorId),
      ]);
      setCostOverview(overview);
      setStorageData(storage);
      setWasteData(waste);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to refresh data';
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading && !costOverview) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d0c0a]">
        <div className="flex items-center gap-3 text-[#d6d2c9]">
          <Loader2 className="w-8 h-8 animate-spin text-[#ff6a3c]" />
          <span className="text-lg">Loading Snowflake Intelligence...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0c0a] text-white">
      {/* Dark Header - Grafana Style */}
      <div className="border-b border-[#1f1d1b] bg-[#161413] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Database className="w-8 h-8 text-[#ff6a3c]" />
            <div>
              <h1 className="text-2xl font-bold text-white">Snowflake Intelligence</h1>
              <p className="text-sm text-[#8d857b] mt-1">
                Real-time cost analytics and AI-powered optimization
              </p>
            </div>
          </div>
        
          <div className="flex items-center gap-3">
            {/* Time Period Selector */}
            <div className="flex items-center gap-2 bg-[#1f1d1b] rounded-lg border border-[#2d2a27] px-3 py-2">
              <Calendar className="w-4 h-4 text-[#8d857b]" />
              <select
                value={timePeriod}
                onChange={(e) => setTimePeriod(Number(e.target.value) as 7 | 30 | 90)}
                className="text-sm bg-transparent border-none text-white focus:ring-0"
              >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          {/* Organization Selector */}
          {organizations.length > 1 && (
            <select
              value={organizationId || ''}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="px-4 py-2 bg-white border rounded-lg shadow-sm text-sm"
            >
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}

          {/* Connector Selector */}
          <select
            value={connectorId || ''}
            onChange={(e) => setConnectorId(e.target.value)}
            className="px-4 py-2 bg-white border rounded-lg shadow-sm text-sm"
          >
            {connectors.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-gray-50 disabled:opacity-50 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Cards */}
      {costOverview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Total Cost */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-indigo-400" />
              <span className="text-[#8d857b] text-xs font-bold uppercase">Total Cost</span>
            </div>
            <div className="text-3xl font-bold text-white">{formatCurrency(costOverview.total_cost)}</div>
            <div className="text-[#8d857b] text-sm mt-1">Last {timePeriod} days</div>
          </div>

          {/* Compute Cost */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <Server className="w-6 h-6 text-blue-400" />
              <span className="text-[#8d857b] text-xs font-bold uppercase">Compute</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(costOverview.compute_credits * 3)}
            </div>
            <div className="text-sm text-[#8d857b] mt-1">
              {costOverview.compute_credits.toFixed(1)} credits
            </div>
            <div className="mt-2 text-xs text-blue-400 font-medium">
              {((costOverview.compute_credits / costOverview.total_credits) * 100).toFixed(0)}% of total
            </div>
          </div>

          {/* Storage Cost */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-6 h-6 text-green-400" />
              <span className="text-[#8d857b] text-xs font-bold uppercase">Storage</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(costOverview.storage_credits * 3)}
            </div>
            <div className="text-sm text-[#8d857b] mt-1">
              {costOverview.storage_credits.toFixed(1)} credits
            </div>
            <div className="mt-2 text-xs text-green-400 font-medium">
              {((costOverview.storage_credits / costOverview.total_credits) * 100).toFixed(0)}% of total
            </div>
          </div>

          {/* Potential Savings */}
          {wasteData && (
            <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-orange-400" />
                <span className="text-[#8d857b] text-xs font-bold uppercase">Potential Savings</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {formatCurrency(wasteData.summary.total_potential_savings)}
              </div>
              <div className="text-[#8d857b] text-sm mt-1">
                {wasteData.summary.total_opportunities} opportunities
              </div>
            </div>
          )}

          {/* Total Queries */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-6 h-6 text-purple-400" />
              <span className="text-[#8d857b] text-xs font-bold uppercase">Queries</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {formatNumber(costOverview.total_queries)}
            </div>
            <div className="text-sm text-[#8d857b] mt-1">
              Total executed
            </div>
            <div className="mt-2 text-xs text-purple-400 font-medium">
              {(costOverview.total_queries / timePeriod).toFixed(0)}/day avg
            </div>
          </div>

          {/* Failed Queries */}
          <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              {Number(costOverview.failure_rate) > 5 ? (
                <AlertCircle className="w-6 h-6 text-red-400" />
              ) : (
                <CheckCircle className="w-6 h-6 text-green-400" />
              )}
              <span className="text-[#8d857b] text-xs font-bold uppercase">Failures</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {costOverview.failure_rate}%
            </div>
            <div className="text-sm text-[#8d857b] mt-1">
              {formatNumber(costOverview.failed_queries)} failed
            </div>
            <div className={`mt-2 text-xs font-medium ${Number(costOverview.failure_rate) > 5 ? 'text-red-400' : 'text-green-400'}`}>
              {Number(costOverview.failure_rate) > 5 ? '⚠️ High failure rate' : '✓ Healthy'}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="bg-[#161413] border border-[#2d2a27] rounded-xl overflow-hidden">
        <div className="border-b border-[#2d2a27] bg-[#0d0c0a]">
          <nav className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'text-[#ff6a3c] border-b-2 border-[#ff6a3c]'
                  : 'text-[#8d857b] hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'recommendations'
                  ? 'text-[#ff6a3c] border-b-2 border-[#ff6a3c]'
                  : 'text-[#8d857b] hover:text-white'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Recommendations
            </button>
            <button
              onClick={() => setActiveTab('roi')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'roi'
                  ? 'text-[#ff6a3c] border-b-2 border-[#ff6a3c]'
                  : 'text-[#8d857b] hover:text-white'
              }`}
            >
              <Target className="w-4 h-4" />
              ROI Tracker
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'performance'
                  ? 'text-[#ff6a3c] border-b-2 border-[#ff6a3c]'
                  : 'text-[#8d857b] hover:text-white'
              }`}
            >
              <Activity className="w-4 h-4" />
              Query Performance
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'storage'
                  ? 'text-[#ff6a3c] border-b-2 border-[#ff6a3c]'
                  : 'text-[#8d857b] hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" />
              Storage Analysis
            </button>
            <button
              onClick={() => setActiveTab('waste')}
              className={`px-6 py-4 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'waste'
                  ? 'text-[#ff6a3c] border-b-2 border-[#ff6a3c]'
                  : 'text-[#8d857b] hover:text-white'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Waste Detection
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Cost Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {costOverview && (
                    <>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="text-sm text-blue-600 font-medium mb-1">Compute</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {formatCurrency(costOverview.compute_credits * 3)}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {costOverview.compute_credits.toFixed(2)} credits
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-sm text-green-600 font-medium mb-1">Storage</div>
                        <div className="text-2xl font-bold text-green-900">
                          {formatCurrency(costOverview.storage_credits * 3)}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {costOverview.storage_credits.toFixed(2)} credits
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600 font-medium mb-1">Data Transfer</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {formatCurrency((costOverview.total_credits - costOverview.compute_credits - costOverview.storage_credits) * 3)}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {(costOverview.total_credits - costOverview.compute_credits - costOverview.storage_credits).toFixed(2)} credits
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

            {/* Top Tables by Cost */}
            {storageData.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Tables by Storage Cost</h3>
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Table
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Database.Schema
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rows
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monthly Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {storageData.slice(0, 10).map((table, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {table.TABLE_NAME}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {table.DATABASE_NAME}.{table.SCHEMA_NAME}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatBytes(table.STORAGE_BYTES)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                            {table.ROW_COUNT ? formatNumber(table.ROW_COUNT) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                            {formatCurrency((table.STORAGE_BYTES / 1099511627776) * 23)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Waste Summary */}
            {wasteData && wasteData.summary.total_opportunities > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Optimization Opportunities</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border-l-4 border-red-500 bg-red-50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-900">Unused Tables</span>
                      <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded-full">
                        {wasteData.unused_tables.length}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-red-900">
                      {formatCurrency(wasteData.summary.unused_table_savings)}
                    </div>
                    <div className="text-xs text-red-700 mt-1">Not accessed in 90+ days</div>
                  </div>
                  
                  <div className="p-4 border-l-4 border-orange-500 bg-orange-50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-orange-900">Idle Warehouses</span>
                      <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
                        {wasteData.idle_warehouses.length}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-orange-900">
                      {formatCurrency(wasteData.summary.idle_warehouse_savings)}
                    </div>
                    <div className="text-xs text-orange-700 mt-1">No queries in 30+ days</div>
                  </div>
                  
                  <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-yellow-900">Underutilized</span>
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                        {wasteData.warehouse_utilization.filter(w => w.STATUS === 'UNDERUTILIZED').length}
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-900">
                      {formatCurrency(wasteData.summary.underutilized_warehouse_savings)}
                    </div>
                    <div className="text-xs text-yellow-700 mt-1">{'<'}30% utilization</div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-900">
                        💰 Total Potential Savings
                      </div>
                      <div className="text-3xl font-bold text-green-900 mt-1">
                        {formatCurrency(wasteData.summary.total_potential_savings)}/month
                      </div>
                      <div className="text-sm text-green-700 mt-1">
                        = {formatCurrency(wasteData.summary.total_potential_savings * 12)}/year
                      </div>
                    </div>
                    <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-lg">
                      View All Opportunities →
                    </button>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && connectorId && (
            <RecommendationsView connectorId={connectorId} />
          )}

          {/* ROI Tracker Tab */}
          {activeTab === 'roi' && connectorId && (
            <ROITrackerView connectorId={connectorId} />
          )}

          {/* Query Performance Tab */}
          {activeTab === 'performance' && connectorId && (
            <QueryPerformanceView connectorId={connectorId} />
          )}

          {/* Storage Analysis Tab */}
          {activeTab === 'storage' && storageData.length > 0 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Storage Usage by Table</h3>
                <div className="bg-[#161413] border border-[#2d2a27] rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[#0d0c0a]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                          Table
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                          Database.Schema
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                          Size
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                          Rows
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase tracking-wider">
                          Monthly Cost
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d2a27]">
                      {storageData.map((table, idx) => (
                        <tr key={idx} className="hover:bg-[#0d0c0a] transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-white">
                            {table.table_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-[#8d857b]">
                            {table.database_name}.{table.schema_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-white">
                            {formatBytes(table.storage_bytes)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-[#8d857b]">
                            {table.row_count ? formatNumber(table.row_count) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-medium text-green-400">
                            {formatCurrency((table.storage_bytes / 1099511627776) * 23)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Waste Detection Tab */}
          {activeTab === 'waste' && wasteData && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Cost Optimization Opportunities</h3>
                
                {/* Unused Tables */}
                {wasteData.unused_tables.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-red-400 mb-3">Unused Tables</h4>
                    <div className="bg-[#161413] border border-[#2d2a27] rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-[#0d0c0a]">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-[#8d857b] uppercase">Table</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Size</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Days Idle</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-[#8d857b] uppercase">Cost/Month</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2d2a27]">
                          {wasteData.unused_tables.slice(0, 20).map((table, idx) => (
                            <tr key={idx} className="hover:bg-[#0d0c0a]">
                              <td className="px-6 py-4 text-sm text-white">
                                {table.TABLE_NAME}
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-[#8d857b]">
                                {formatBytes(table.STORAGE_BYTES)}
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-red-400 font-medium">
                                {table.DAYS_SINCE_ACCESS}
                              </td>
                              <td className="px-6 py-4 text-sm text-right text-red-400 font-bold">
                                {formatCurrency((table.STORAGE_BYTES / 1099511627776) * 23)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
