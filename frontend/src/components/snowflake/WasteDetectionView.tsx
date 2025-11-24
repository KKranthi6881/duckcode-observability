import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Database, Server, Activity, TrendingDown, Loader2, Archive, Power, CheckCircle } from 'lucide-react';
import snowflakeCostPhase1Service, { WasteDetectionData } from '../../services/snowflakeCostPhase1Service';

interface Props {
  connectorId: string;
  initialData?: WasteDetectionData;
}

export default function WasteDetectionView({ connectorId, initialData }: Props) {
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [wasteData, setWasteData] = useState<WasteDetectionData | null>(initialData || null);
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
    if (!initialData) {
      loadData();
    }
  }, [loadData, initialData]);

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

  if (loading && !wasteData) {
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
      {/* Header with Key Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Title Card */}
        <div className="lg:col-span-1 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Waste Detection</h2>
          </div>
          <p className="text-xs text-muted-foreground">Optimize spending</p>
        </div>

        {/* Monthly Savings */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase mb-1">Monthly Savings</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalSavings)}</div>
          <div className="text-xs text-muted-foreground mt-1">Potential</div>
        </div>

        {/* Annual Impact */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase mb-1">Annual Impact</div>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(totalSavings * 12)}</div>
          <div className="text-xs text-green-600 dark:text-green-400 mt-1">Per year</div>
        </div>

        {/* Opportunities */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs text-muted-foreground uppercase mb-1">Opportunities</div>
          <div className="text-2xl font-bold text-primary">
            {unusedTables.length + idleWarehouses.length + underutilizedWarehouses.length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Issues found</div>
        </div>
      </div>

      {/* Summary Cards - Compact & Professional */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Unused Tables - Critical */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'unused_tables' ? 'all' : 'unused_tables')}
          className={`bg-card border ${
            selectedCategory === 'unused_tables' ? 'border-red-500 shadow-lg shadow-red-500/20' : 'border-border'
          } rounded-lg p-4 text-left hover:border-red-500/50 transition-all group`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-lg">
                <Database className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase">Critical</div>
                <div className="text-xs text-muted-foreground">{unusedTables.length} Tables</div>
              </div>
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">{formatCurrency(wasteData.summary?.unused_table_savings || 0)}</div>
          <div className="text-xs text-muted-foreground">Not accessed in 90+ days</div>
        </button>

        {/* Idle Warehouses - Warning */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'idle_warehouses' ? 'all' : 'idle_warehouses')}
          className={`bg-card border ${
            selectedCategory === 'idle_warehouses' ? 'border-orange-500 shadow-lg shadow-orange-500/20' : 'border-border'
          } rounded-lg p-4 text-left hover:border-orange-500/50 transition-all group`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-lg">
                <Server className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase">Warning</div>
                <div className="text-xs text-muted-foreground">{idleWarehouses.length} Warehouses</div>
              </div>
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">{formatCurrency(wasteData.summary?.idle_warehouse_savings || 0)}</div>
          <div className="text-xs text-muted-foreground">Running but not used</div>
        </button>

        {/* Underutilized - Optimize */}
        <button
          onClick={() => setSelectedCategory(selectedCategory === 'underutilized' ? 'all' : 'underutilized')}
          className={`bg-card border ${
            selectedCategory === 'underutilized' ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' : 'border-border'
          } rounded-lg p-4 text-left hover:border-yellow-500/50 transition-all group`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-muted rounded-lg">
                <Activity className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <div className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase">Optimize</div>
                <div className="text-xs text-muted-foreground">{underutilizedWarehouses.length} Warehouses</div>
              </div>
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground mb-1">{formatCurrency(wasteData.summary?.underutilized_warehouse_savings || 0)}</div>
          <div className="text-xs text-muted-foreground">Low utilization rate</div>
        </button>
      </div>

      {/* Unused Tables Details */}
      {(selectedCategory === 'all' || selectedCategory === 'unused_tables') && unusedTables.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-red-400" />
                Unused Tables ({unusedTables.length})
              </h3>
              <p className="text-xs text-muted-foreground">90+ days idle</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Table</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Size</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Cost/Month</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Last Access</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Days Idle</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unusedTables.map((table, idx) => (
                  <tr key={idx} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-foreground">{table.DATABASE_NAME}.{table.SCHEMA_NAME}.{table.TABLE_NAME}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground text-right">{formatBytes(table.STORAGE_BYTES)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400 text-right">
                      {formatCurrency((table.STORAGE_BYTES / (1024 * 1024 * 1024)) * 40)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {table.LAST_ACCESS ? new Date(table.LAST_ACCESS).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">{table.DAYS_SINCE_ACCESS} days</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleArchiveTable(`${table.DATABASE_NAME}.${table.SCHEMA_NAME}.${table.TABLE_NAME}`)}
                          disabled={actionInProgress === `${table.DATABASE_NAME}.${table.SCHEMA_NAME}.${table.TABLE_NAME}`}
                          className="flex items-center gap-1 px-2 py-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs rounded font-medium transition disabled:opacity-50"
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
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-orange-400" />
                Idle Warehouses ({idleWarehouses.length})
              </h3>
              <p className="text-xs text-muted-foreground">Running but unused</p>
            </div>
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
                    <td className="px-6 py-4 text-sm font-bold text-orange-600 dark:text-orange-400 text-right">
                      {formatCurrency(warehouse.MONTHLY_CREDITS * 4)} {/* ~$4/credit */}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {warehouse.LAST_QUERY_TIME ? new Date(warehouse.LAST_QUERY_TIME).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-orange-600 dark:text-orange-400">{warehouse.DAYS_IDLE} days</span>
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
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-yellow-400" />
                Underutilized Warehouses ({underutilizedWarehouses.length})
              </h3>
              <p className="text-xs text-muted-foreground">Low utilization</p>
            </div>
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
                      <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">{warehouse.AVG_UTILIZATION}%</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground text-right">{warehouse.AVG_QUEUE_LOAD.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-yellow-600 dark:text-yellow-400 text-right">
                      {formatCurrency(warehouse.TOTAL_CREDITS * 4)} {/* ~$4/credit */}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-center">
                        <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">Downsize recommended</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick Wins Summary - Compact */}
      {totalSavings > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <TrendingDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-2">Quick Wins Available 🎯</h3>
              <p className="text-xs text-foreground mb-3">
                Save <span className="text-purple-700 dark:text-purple-400 font-semibold">{formatCurrency(totalSavings)}/mo</span> ({formatCurrency(totalSavings * 12)}/yr) by implementing these:
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {unusedTables.length > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span>Archive {unusedTables.length} tables → {formatCurrency(wasteData.summary?.unused_table_savings || 0)}/mo</span>
                  </li>
                )}
                {idleWarehouses.length > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span>Suspend {idleWarehouses.length} warehouses → {formatCurrency(wasteData.summary?.idle_warehouse_savings || 0)}/mo</span>
                  </li>
                )}
                {underutilizedWarehouses.length > 0 && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    <span>Optimize {underutilizedWarehouses.length} warehouses → {formatCurrency(wasteData.summary?.underutilized_warehouse_savings || 0)}/mo</span>
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
