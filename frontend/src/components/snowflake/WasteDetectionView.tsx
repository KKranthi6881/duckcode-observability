import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Database, Server, Activity, TrendingDown, Loader2, Archive, Power, DollarSign, Calendar, User, Trash2, CheckCircle, XCircle } from 'lucide-react';
import snowflakeCostPhase1Service, { WasteDetectionData, UnusedTable, IdleWarehouse, WarehouseUtilization } from '../../services/snowflakeCostPhase1Service';

interface Props {
  connectorId: string;
}

export default function WasteDetectionView({ connectorId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wasteData, setWasteData] = useState<WasteDetectionData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'unused_tables' | 'idle_warehouses' | 'underutilized'>('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await snowflakeCostPhase1Service.getWasteDetection(connectorId);
      setWasteData(data);
    } catch (err) {
      console.error('Error loading waste detection:', err);
      setError(err instanceof Error ? err.message : 'Failed to load waste detection data');
      setWasteData(null);
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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleArchiveTable = async (tableName: string) => {
    setActionInProgress(tableName);
    // TODO: Implement actual archive logic
    setTimeout(() => {
      alert(`Archive action for ${tableName} - Implementation pending`);
      setActionInProgress(null);
    }, 1000);
  };

  const handleSuspendWarehouse = async (warehouseName: string) => {
    setActionInProgress(warehouseName);
    // TODO: Implement actual suspend logic
    setTimeout(() => {
      alert(`Suspend action for ${warehouseName} - Implementation pending`);
      setActionInProgress(null);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-card border border-border rounded-xl">
        <AlertTriangle className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Failed to Load Waste Detection</h3>
        <p className="text-muted-foreground text-sm mb-4">{error}</p>
        <button 
          onClick={loadData}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-foreground rounded-lg font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!wasteData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-card border border-border rounded-xl">
        <AlertTriangle className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Waste Detection Data</h3>
        <p className="text-muted-foreground text-sm">Run waste detection analysis to see opportunities</p>
      </div>
    );
  }

  const unusedTables = wasteData.unused_tables || [];
  const idleWarehouses = wasteData.idle_warehouses || [];
  const underutilizedWarehouses = wasteData.warehouse_utilization?.filter(w => w.STATUS === 'UNDERUTILIZED') || [];
  const totalSavings = wasteData.summary?.total_potential_savings || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-primary" />
          Waste Detection & Cost Optimization
        </h2>
        <p className="text-muted-foreground mt-1">Identify and eliminate wasteful spending</p>
      </div>

      {/* Total Savings Card */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-600/10 border-2 border-green-500/30 rounded-xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-muted-foreground text-sm uppercase mb-2">Total Potential Savings</div>
            <div className="text-5xl font-bold text-green-400 mb-2">{formatCurrency(totalSavings)}</div>
            <div className="text-foreground text-lg">per month</div>
          </div>
          <div className="text-right">
            <div className="text-muted-foreground text-sm uppercase mb-2">Annual Impact</div>
            <div className="text-3xl font-bold text-foreground">{formatCurrency(totalSavings * 12)}</div>
            <div className="text-green-400 text-sm mt-2">
              {(unusedTables.length + idleWarehouses.length + underutilizedWarehouses.length)} opportunities identified
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards - Professional Dark Theme */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Unused Tables - Critical */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'unused_tables' ? 'all' : 'unused_tables')}
          className={`bg-card border-2 ${
            selectedCategory === 'unused_tables' ? 'border-red-500/60' : 'border-muted'
          } rounded-xl p-6 text-left hover:border-red-500/40 transition-all`}
        >
          <div className="flex items-start justify-between mb-3">
            <Database className="w-8 h-8 text-red-400" />
            <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Critical</div>
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">{formatCurrency(wasteData.summary?.unused_table_savings || 0)}</div>
          <div className="text-foreground text-sm font-medium">{unusedTables.length} Unused Tables</div>
          <div className="text-muted-foreground text-xs mt-2">Not accessed in 90+ days</div>
        </button>

        {/* Idle Warehouses - Warning */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'idle_warehouses' ? 'all' : 'idle_warehouses')}
          className={`bg-card border-2 ${
            selectedCategory === 'idle_warehouses' ? 'border-orange-500/60' : 'border-muted'
          } rounded-xl p-6 text-left hover:border-orange-500/40 transition-all`}
        >
          <div className="flex items-start justify-between mb-3">
            <Server className="w-8 h-8 text-orange-400" />
            <div className="text-xs font-bold text-orange-400 uppercase tracking-wider">Warning</div>
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">{formatCurrency(wasteData.summary?.idle_warehouse_savings || 0)}</div>
          <div className="text-foreground text-sm font-medium">{idleWarehouses.length} Idle Warehouses</div>
          <div className="text-muted-foreground text-xs mt-2">Running but not used</div>
        </button>

        {/* Underutilized - Optimize */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'underutilized' ? 'all' : 'underutilized')}
          className={`bg-card border-2 ${
            selectedCategory === 'underutilized' ? 'border-yellow-500/60' : 'border-muted'
          } rounded-xl p-6 text-left hover:border-yellow-500/40 transition-all`}
        >
          <div className="flex items-start justify-between mb-3">
            <Activity className="w-8 h-8 text-yellow-400" />
            <div className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Optimize</div>
          </div>
          <div className="text-3xl font-bold text-foreground mb-2">{formatCurrency(wasteData.summary?.underutilized_warehouse_savings || 0)}</div>
          <div className="text-foreground text-sm font-medium">{underutilizedWarehouses.length} Underutilized</div>
          <div className="text-muted-foreground text-xs mt-2">Low utilization rate</div>
        </button>
      </div>

      {/* Unused Tables Details */}
      {(selectedCategory === 'all' || selectedCategory === 'unused_tables') && unusedTables.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-6 border-b border-border bg-gradient-to-r from-red-500/10 to-transparent">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Database className="w-5 h-5 text-red-400" />
              Unused Tables ({unusedTables.length})
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Tables not accessed in 90+ days - Archive or delete to save costs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-input">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Table</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Size</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Cost/Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Access</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Days Idle</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d2a27]">
                {unusedTables.map((table, idx) => (
                  <tr key={idx} className="hover:bg-input transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{table.DATABASE_NAME}.{table.SCHEMA_NAME}.{table.TABLE_NAME}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground text-right">{formatBytes(table.STORAGE_BYTES)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-400 text-right">
                      {formatCurrency((table.STORAGE_BYTES / (1024 * 1024 * 1024)) * 40)} {/* ~$40/TB/month */}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {table.LAST_ACCESS ? new Date(table.LAST_ACCESS).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-red-400">{table.DAYS_SINCE_ACCESS} days</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleArchiveTable(`${table.DATABASE_NAME}.${table.SCHEMA_NAME}.${table.TABLE_NAME}`)}
                          disabled={actionInProgress === `${table.DATABASE_NAME}.${table.SCHEMA_NAME}.${table.TABLE_NAME}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-foreground text-xs rounded-lg font-medium transition disabled:opacity-50"
                        >
                          {actionInProgress === `${table.DATABASE_NAME}.${table.SCHEMA_NAME}.${table.TABLE_NAME}` ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Archive className="w-3 h-3" />
                          )}
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Idle Warehouses Details */}
      {(selectedCategory === 'all' || selectedCategory === 'idle_warehouses') && idleWarehouses.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-6 border-b border-border bg-gradient-to-r from-orange-500/10 to-transparent">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Server className="w-5 h-5 text-orange-400" />
              Idle Warehouses ({idleWarehouses.length})
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Warehouses running with no queries - Suspend to save costs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-input">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Warehouse</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Query Count</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Monthly Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Query</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Days Idle</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d2a27]">
                {idleWarehouses.map((warehouse, idx) => (
                  <tr key={idx} className="hover:bg-input transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{warehouse.WAREHOUSE_NAME}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground text-right">{warehouse.QUERY_COUNT}</td>
                    <td className="px-6 py-4 text-sm font-bold text-orange-400 text-right">
                      {formatCurrency(warehouse.MONTHLY_CREDITS * 4)} {/* ~$4/credit */}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {warehouse.LAST_QUERY_TIME ? new Date(warehouse.LAST_QUERY_TIME).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-orange-400">{warehouse.DAYS_IDLE} days</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleSuspendWarehouse(warehouse.WAREHOUSE_NAME)}
                          disabled={actionInProgress === warehouse.WAREHOUSE_NAME}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary hover:bg-primary/90 text-foreground text-xs rounded-lg font-medium transition disabled:opacity-50"
                        >
                          {actionInProgress === warehouse.WAREHOUSE_NAME ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Power className="w-3 h-3" />
                          )}
                          Suspend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Underutilized Warehouses Details */}
      {(selectedCategory === 'all' || selectedCategory === 'underutilized') && underutilizedWarehouses.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-6 border-b border-border bg-gradient-to-r from-yellow-500/10 to-transparent">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-yellow-400" />
              Underutilized Warehouses ({underutilizedWarehouses.length})
            </h3>
            <p className="text-sm text-muted-foreground mt-1">Warehouses with low utilization - Downsize to save costs</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-input">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Warehouse</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Size</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Utilization</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Queue Load</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total Cost</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d2a27]">
                {underutilizedWarehouses.map((warehouse, idx) => (
                  <tr key={idx} className="hover:bg-input transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{warehouse.WAREHOUSE_NAME}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{warehouse.WAREHOUSE_SIZE}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-medium text-yellow-400">{warehouse.AVG_UTILIZATION}%</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground text-right">{warehouse.AVG_QUEUE_LOAD.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-yellow-400 text-right">
                      {formatCurrency(warehouse.TOTAL_CREDITS * 4)} {/* ~$4/credit */}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-center">
                        <span className="text-xs text-yellow-300 font-medium">Downsize recommended</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Wins Summary */}
      {totalSavings > 0 && (
        <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <TrendingDown className="w-8 h-8 text-purple-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-purple-400 mb-2">Quick Wins Available 🎯</h3>
              <p className="text-foreground mb-3">
                You can save <span className="text-purple-400 font-bold">{formatCurrency(totalSavings)}/month</span> ({formatCurrency(totalSavings * 12)}/year) by implementing these recommendations.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {unusedTables.length > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Archive {unusedTables.length} unused tables → Save {formatCurrency(wasteData.summary?.unused_table_savings || 0)}/month
                  </li>
                )}
                {idleWarehouses.length > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Suspend {idleWarehouses.length} idle warehouses → Save {formatCurrency(wasteData.summary?.idle_warehouse_savings || 0)}/month
                  </li>
                )}
                {underutilizedWarehouses.length > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Optimize {underutilizedWarehouses.length} underutilized warehouses → Save {formatCurrency(wasteData.summary?.underutilized_warehouse_savings || 0)}/month
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
