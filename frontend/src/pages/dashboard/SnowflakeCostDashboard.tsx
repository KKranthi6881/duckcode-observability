import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { snowflakeCostService, DailyCreditRow, WarehouseCostRow, TagCostRow, TopQueryRow, ConnectorItem } from '../../services/snowflakeCostService';
import { snowflakeBudgetsService, SnowflakeBudget, BudgetAlert } from '../../services/snowflakeBudgetsService';
import enterpriseService from '../../services/enterpriseService';
import { format } from 'date-fns';
import { ChevronDown, TrendingUp, Layers, Tag, Search, Loader2 } from 'lucide-react';

function isoStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // Keep Snowflake-compatible timestamp format
  return d.toISOString().slice(0, 19);
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#a78bfa', '#f97316', '#14b8a6'];

export default function SnowflakeCostDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [connectorId, setConnectorId] = useState<string | null>(null);

  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [start, end] = useMemo(() => {
    if (range === 'custom') {
      const s = customStartDate ? `${customStartDate}T00:00:00` : undefined;
      const e = customEndDate ? `${customEndDate}T00:00:00` : undefined;
      return [s, e];
    }
    const s = range === '7d' ? isoStart(7) : range === '30d' ? isoStart(30) : isoStart(90);
    return [s, undefined];
  }, [range, customStartDate, customEndDate]);

  const [daily, setDaily] = useState<DailyCreditRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseCostRow[]>([]);
  const [tags, setTags] = useState<TagCostRow[]>([]);
  const [queries, setQueries] = useState<TopQueryRow[]>([]);
  const [filters, setFilters] = useState<{ warehouses: { WAREHOUSE_NAME: string }[]; tags: { TAG_NAME: string; TAG_VALUE: string }[]; users: { USER_NAME: string }[] }>({ warehouses: [], tags: [], users: [] });
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [selectedTagName, setSelectedTagName] = useState<string>('');
  const [selectedTagValue, setSelectedTagValue] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [showQueryText, setShowQueryText] = useState<boolean>(false);

  const [budgets, setBudgets] = useState<SnowflakeBudget[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [newBudget, setNewBudget] = useState<Partial<SnowflakeBudget>>({ level: 'overall', threshold_credits: 100 });

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        // Load organizations user belongs to
        const orgs = await enterpriseService.organization.getUserOrganizations();
        const simplified = orgs.map((o: { organization_id: string; organization_name?: string }) => ({ id: o.organization_id, name: o.organization_name || o.organization_id }));
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

  useEffect(() => {
    const loadConnectors = async () => {
      if (!organizationId) return;
      try {
        setLoading(true);
        const items = await snowflakeCostService.listSnowflakeConnectors(organizationId);
        setConnectors(items);
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

  useEffect(() => {
    const load = async () => {
      if (!connectorId) return;
      try {
        setLoading(true);
        const [d, w, t, q] = await Promise.all([
          snowflakeCostService.getDailyCredits(connectorId, start, end, { warehouse: selectedWarehouse || undefined, tagName: selectedTagName || undefined, tagValue: selectedTagValue || undefined }),
          snowflakeCostService.getWarehouseCosts(connectorId, start, end, { tagName: selectedTagName || undefined, tagValue: selectedTagValue || undefined }),
          snowflakeCostService.getCostByTags(connectorId, start, end),
          snowflakeCostService.getTopQueries(connectorId, start, end, { warehouse: selectedWarehouse || undefined, user: selectedUser || undefined, includeText: showQueryText }),
        ]);
        setDaily(Array.isArray(d) ? d : []);
        setWarehouses(Array.isArray(w) ? w : []);
        setTags(Array.isArray(t) ? t : []);
        setQueries(Array.isArray(q) ? q : []);
        setError(null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to load cost data';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [connectorId, start, end, selectedWarehouse, selectedTagName, selectedTagValue, selectedUser, showQueryText]);

  useEffect(() => {
    const loadFilters = async () => {
      if (!connectorId) return;
      try {
        const f = await snowflakeCostService.getFilters(connectorId, start, end);
        // Ensure filters always have array properties
        setFilters({
          warehouses: Array.isArray(f?.warehouses) ? f.warehouses : [],
          tags: Array.isArray(f?.tags) ? f.tags : [],
          users: Array.isArray(f?.users) ? f.users : []
        });
      } catch (e) {
        console.warn('Failed to load filters', e);
        // Set empty arrays on error
        setFilters({ warehouses: [], tags: [], users: [] });
      }
    };
    loadFilters();
  }, [connectorId, start, end]);

  useEffect(() => {
    const loadBudgets = async () => {
      if (!connectorId) return;
      try {
        const [b, a] = await Promise.all([
          snowflakeBudgetsService.list(connectorId),
          snowflakeBudgetsService.listAlerts(connectorId),
        ]);
        setBudgets(b);
        setAlerts(a);
      } catch (e) {
        console.warn('Failed to load budgets/alerts', e);
      }
    };
    loadBudgets();
  }, [connectorId]);

  const dailyData = useMemo(() => {
    if (!daily || !Array.isArray(daily)) return [];
    return daily
      .filter(r => r.DAY) // Filter out entries without DAY field
      .map(r => {
        try {
          const date = new Date(r.DAY);
          // Check if date is valid
          if (isNaN(date.getTime())) {
            console.warn('Invalid date value:', r.DAY);
            return null;
          }
          return {
            date: format(date, 'yyyy-MM-dd'),
            credits: Number(r.CREDITS || 0)
          };
        } catch (error) {
          console.warn('Error formatting date:', r.DAY, error);
          return null;
        }
      })
      .filter(Boolean) as { date: string; credits: number }[];
  }, [daily]);

  return (
    <div className="p-6 space-y-6 text-foreground">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Snowflake Cost Analytics</h1>
          <p className="text-sm text-muted-foreground">Visualize credits usage, warehouse costs, tagging, and high-cost queries</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-sm shadow-sm"
              value={range}
              onChange={(e) => setRange(e.target.value as '7d' | '30d' | '90d' | 'custom')}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="custom">Custom</option>
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-2.5" />
          </div>

          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" className="border border-border bg-background rounded-lg px-2 py-1 text-sm" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
              <span className="text-muted-foreground text-sm">to</span>
              <input type="date" className="border border-border bg-background rounded-lg px-2 py-1 text-sm" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
            </div>
          )}

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-sm shadow-sm"
              value={organizationId || ''}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-2.5" />
          </div>

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-sm shadow-sm"
              value={connectorId || ''}
              onChange={(e) => setConnectorId(e.target.value)}
            >
              {connectors.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-2.5" />
          </div>

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-sm shadow-sm"
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              <option value="">All Warehouses</option>
              {filters.warehouses.map(w => (
                <option key={w.WAREHOUSE_NAME} value={w.WAREHOUSE_NAME}>{w.WAREHOUSE_NAME}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-2.5" />
          </div>

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-sm shadow-sm"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">All Users</option>
              {filters.users.map(u => (
                <option key={u.USER_NAME} value={u.USER_NAME}>{u.USER_NAME}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-2.5" />
          </div>

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-sm shadow-sm"
              value={selectedTagName}
              onChange={(e) => setSelectedTagName(e.target.value)}
            >
              <option value="">Tag</option>
              {[...new Set(filters.tags.map(t => t.TAG_NAME))].map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-2.5" />
          </div>

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-background border border-border rounded-lg text-sm shadow-sm"
              value={selectedTagValue}
              onChange={(e) => setSelectedTagValue(e.target.value)}
            >
              <option value="">Value</option>
              {filters.tags.filter(t => !selectedTagName || t.TAG_NAME === selectedTagName).map(t => (
                <option key={`${t.TAG_NAME}:${t.TAG_VALUE}`} value={t.TAG_VALUE}>{t.TAG_VALUE}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-2 top-2.5" />
          </div>

          <button className="px-3 py-2 text-sm border rounded-lg" onClick={() => { setSelectedWarehouse(''); setSelectedUser(''); setSelectedTagName(''); setSelectedTagValue(''); }}>Reset Filters</button>

          <label className="flex items-center gap-2 text-sm ml-2">
            <input type="checkbox" checked={showQueryText} onChange={(e) => setShowQueryText(e.target.checked)} />
            Show Query Text
          </label>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin"/> Loading...</div>
      )}
      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground"><TrendingUp className="w-4 h-4"/> Daily Credits</div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={dailyData} margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" minTickGap={24} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="credits" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground"><Layers className="w-4 h-4"/> Warehouse Costs</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={warehouses} margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="WAREHOUSE_NAME" minTickGap={24} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="CREDITS" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tag Costs */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground"><Tag className="w-4 h-4"/> Cost by Tags (Warehouse Tags)</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={tags.slice(0, 8).map(t => ({ name: `${t.TAG_NAME}:${t.TAG_VALUE}`, value: Number(t.CREDITS || 0) }))}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                >
                  {tags.slice(0, 8).map((_t, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Tag</th>
                  <th className="py-2 pr-4">Value</th>
                  <th className="py-2">Credits</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <tr key={`${t.TAG_NAME}:${t.TAG_VALUE}`} className="border-t">
                    <td className="py-2 pr-4">{t.TAG_NAME}</td>
                    <td className="py-2 pr-4">{t.TAG_VALUE}</td>
                    <td className="py-2">{Number(t.CREDITS || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Top Queries */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground"><Search className="w-4 h-4"/> High Cost Queries (Top by bytes scanned)</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-4">Query ID</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Warehouse</th>
                <th className="py-2 pr-4">DB.Schema</th>
                <th className="py-2 pr-4">Bytes Scanned</th>
                <th className="py-2 pr-4">Exec (ms)</th>
                <th className="py-2">Start</th>
                {showQueryText && <th className="py-2">Query Text</th>}
                <th className="py-2 pr-4">Drilldown</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => (
                <tr key={q.QUERY_ID} className="border-t hover:bg-muted">
                  <td className="py-2 pr-4 font-mono text-indigo-600">{q.QUERY_ID}</td>
                  <td className="py-2 pr-4">{q.USER_NAME}</td>
                  <td className="py-2 pr-4">{q.WAREHOUSE_NAME}</td>
                  <td className="py-2 pr-4">
                    <Link className="text-blue-600 hover:underline" to={`/dashboard/lineage`}>{[q.DATABASE_NAME, q.SCHEMA_NAME].filter(Boolean).join('.')}</Link>
                  </td>
                  <td className="py-2 pr-4">{q.BYTES_SCANNED?.toLocaleString() || '-'}</td>
                  <td className="py-2 pr-4">{q.EXECUTION_TIME ?? q.TOTAL_ELAPSED_TIME ?? '-'}</td>
                  <td className="py-2">{(() => {
                    try {
                      const date = new Date(q.START_TIME);
                      return !isNaN(date.getTime()) ? format(date, 'yyyy-MM-dd HH:mm') : '-';
                    } catch {
                      return '-';
                    }
                  })()}</td>
                  {showQueryText && <td className="py-2 font-mono text-xs whitespace-pre-wrap max-w-xl">{q.QUERY_TEXT || ''}</td>}
                  <td className="py-2 pr-4">
                    <Link className="text-blue-600 hover:underline" to={`/dashboard/lineage`}>View Lineage</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budgets & Alerts */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-muted-foreground font-medium">Budgets & Alerts</div>
          <button
            onClick={async () => { if (!connectorId || !newBudget.level || !newBudget.threshold_credits) return; await snowflakeBudgetsService.save(connectorId, { ...newBudget, level: newBudget.level, threshold_credits: Number(newBudget.threshold_credits) }, !!newBudget.id); setNewBudget({ level: 'overall', threshold_credits: 100 }); const b = await snowflakeBudgetsService.list(connectorId); setBudgets(b); }}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg"
          >Save Budget</button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <select className="w-full border border-border bg-background rounded-lg px-2 py-1 text-sm" value={newBudget.level as string || 'overall'} onChange={(e) => setNewBudget(prev => ({ ...prev, level: e.target.value as SnowflakeBudget['level'] }))}>
              <option value="overall">Overall</option>
              <option value="warehouse">Warehouse</option>
              <option value="tag">Tag</option>
              <option value="user">User</option>
            </select>
            {(newBudget.level === 'warehouse') && (
              <select className="w-full border border-border bg-background rounded-lg px-2 py-1 text-sm" value={newBudget.warehouse_name || ''} onChange={(e) => setNewBudget(prev => ({ ...prev, warehouse_name: e.target.value }))}>
                <option value="">Select warehouse</option>
                {filters.warehouses.map(w => <option key={w.WAREHOUSE_NAME} value={w.WAREHOUSE_NAME}>{w.WAREHOUSE_NAME}</option>)}
              </select>
            )}
            {(newBudget.level === 'tag') && (
              <div className="flex gap-2">
                <select className="flex-1 border border-border bg-background rounded-lg px-2 py-1 text-sm" value={newBudget.tag_name || ''} onChange={(e) => setNewBudget(prev => ({ ...prev, tag_name: e.target.value }))}>
                  <option value="">Tag</option>
                  {[...new Set(filters.tags.map(t => t.TAG_NAME))].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <select className="flex-1 border border-border bg-background rounded-lg px-2 py-1 text-sm" value={newBudget.tag_value || ''} onChange={(e) => setNewBudget(prev => ({ ...prev, tag_value: e.target.value }))}>
                  <option value="">Value</option>
                  {filters.tags.filter(t => !newBudget.tag_name || t.TAG_NAME === newBudget.tag_name).map(t => <option key={`${t.TAG_NAME}:${t.TAG_VALUE}`} value={t.TAG_VALUE}>{t.TAG_VALUE}</option>)}
                </select>
              </div>
            )}
            {(newBudget.level === 'user') && (
              <select className="w-full border border-border bg-background rounded-lg px-2 py-1 text-sm" value={newBudget.user_name || ''} onChange={(e) => setNewBudget(prev => ({ ...prev, user_name: e.target.value }))}>
                <option value="">Select user</option>
                {filters.users.map(u => <option key={u.USER_NAME} value={u.USER_NAME}>{u.USER_NAME}</option>)}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <input className="w-full border border-border bg-background rounded-lg px-2 py-1 text-sm" type="number" placeholder="Threshold credits" value={String(newBudget.threshold_credits || '')} onChange={(e) => setNewBudget(prev => ({ ...prev, threshold_credits: Number(e.target.value) }))} />
            <select className="w-full border border-border bg-background rounded-lg px-2 py-1 text-sm" value={newBudget.period || '30d'} onChange={(e) => setNewBudget(prev => ({ ...prev, period: e.target.value as SnowflakeBudget['period'] }))}>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
              <option value="custom">custom</option>
            </select>
            {newBudget.period === 'custom' && (
              <div className="flex gap-2">
                <input type="date" className="flex-1 border border-border bg-background rounded-lg px-2 py-1 text-sm" onChange={(e) => setNewBudget(prev => ({ ...prev, start_time: e.target.value ? `${e.target.value}T00:00:00` : null }))} />
                <input type="date" className="flex-1 border border-border bg-background rounded-lg px-2 py-1 text-sm" onChange={(e) => setNewBudget(prev => ({ ...prev, end_time: e.target.value ? `${e.target.value}T00:00:00` : null }))} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input className="w-full border border-border bg-background rounded-lg px-2 py-1 text-sm" placeholder="Slack webhook (optional)" value={newBudget.notify_slack_webhook || ''} onChange={(e) => setNewBudget(prev => ({ ...prev, notify_slack_webhook: e.target.value }))} />
            <select className="w-full border border-border bg-background rounded-lg px-2 py-1 text-sm" value={newBudget.status || 'active'} onChange={(e) => setNewBudget(prev => ({ ...prev, status: e.target.value as SnowflakeBudget['status'] }))}>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="archived">archived</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Budgets</div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">Scope</th>
                  <th className="py-2 pr-4">Threshold</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map(b => (
                  <tr key={b.id} className="border-t">
                    <td className="py-2 pr-4">{b.level}{b.warehouse_name ? `:${b.warehouse_name}` : b.tag_name ? `:${b.tag_name}:${b.tag_value}` : b.user_name ? `:${b.user_name}` : ''}</td>
                    <td className="py-2 pr-4">{Number(b.threshold_credits).toFixed(2)} credits</td>
                    <td className="py-2 pr-4">{b.period}</td>
                    <td className="py-2">
                      <button className="text-blue-600 hover:underline mr-3" onClick={async () => { if (!connectorId) return; const res = await snowflakeBudgetsService.check(connectorId, b.id); alert(`Current: ${res.current.toFixed(2)} credits${res.fired ? ' — Threshold exceeded' : ''}`); }}>Check</button>
                      <button className="text-red-600 hover:underline" onClick={async () => { if (!connectorId) return; await snowflakeBudgetsService.remove(connectorId, b.id); const refreshed = await snowflakeBudgetsService.list(connectorId); setBudgets(refreshed); }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Recent Alerts</div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Credits</th>
                  <th className="py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="py-2 pr-4">{new Date(a.fired_at).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(a.current_credits).toFixed(2)}</td>
                    <td className="py-2">{a.message || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
