import { useEffect, useState } from 'react';
import enterpriseService from '../../services/enterpriseService';
import { connectorsService, ConnectorItem, ConnectorHistoryRow, CreateSnowflakeRequest } from '../../services/connectorsService';
import { ChevronDown, Plus, TestTube2, RefreshCw, History } from 'lucide-react';

export default function ConnectorsPage() {
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [creatingSnowflake, setCreatingSnowflake] = useState<CreateSnowflakeRequest>({
    organizationId: '',
    name: '',
    config: { account: '', username: '', password: '', role: '', warehouse: '', database: '', schema: '' },
  });

  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<Record<string, ConnectorHistoryRow[]>>({});

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const orgs = await enterpriseService.organization.getUserOrganizations();
        const simplified = orgs.map((o: { organization_id: string; organization_name?: string }) => ({ id: o.organization_id, name: o.organization_name || o.organization_id }));
        setOrganizations(simplified);
        const picked = simplified[0]?.id || null;
        setOrganizationId(prev => prev || picked);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load organizations');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!organizationId) return;
      try {
        setLoading(true);
        const list = await connectorsService.list(organizationId);
        setConnectors(list);
        setCreatingSnowflake(prev => ({ ...prev, organizationId }));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load connectors');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [organizationId]);

  const toggleHistory = async (id: string) => {
    setHistoryOpen(prev => ({ ...prev, [id]: !prev[id] }));
    if (!history[id]) {
      const rows = await connectorsService.history(id);
      setHistory(prev => ({ ...prev, [id]: rows }));
    }
  };

  const handleCreate = async () => {
    if (!creatingSnowflake.organizationId || !creatingSnowflake.name || !creatingSnowflake.config.account || !creatingSnowflake.config.username || !creatingSnowflake.config.password) {
      alert('Please fill required fields: organization, name, account, username, password');
      return;
    }
    try {
      setCreating(true);
      await connectorsService.createSnowflake(creatingSnowflake);
      setShowCreate(false);
      const list = await connectorsService.list(creatingSnowflake.organizationId);
      setConnectors(list);
      setCreatingSnowflake({ organizationId: creatingSnowflake.organizationId, name: '', config: { account: '', username: '', password: '', role: '', warehouse: '', database: '', schema: '' } });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to create connector');
    } finally {
      setCreating(false);
    }
  };

  const handleTest = async (id: string) => {
    try {
      await connectorsService.test(id);
      alert('Connection test succeeded');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Test failed');
    }
  };

  const handleExtract = async (id: string) => {
    try {
      await connectorsService.extract(id);
      alert('Extraction started');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Extraction failed');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Connectors</h1>
          <p className="text-sm text-gray-500">Manage Snowflake connectors for your organization</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-white border rounded-lg text-sm shadow-sm"
              value={organizationId || ''}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-2.5" />
          </div>
          <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4"/> New Snowflake
          </button>
        </div>
      </div>

      {/* Create Snowflake Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">Create Snowflake Connector</div>
              <button className="text-gray-600" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Name</label>
                <input className="w-full border rounded-lg px-2 py-1 text-sm" value={creatingSnowflake.name} onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Account</label>
                <input className="w-full border rounded-lg px-2 py-1 text-sm" value={creatingSnowflake.config.account} onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, account: e.target.value } }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Username</label>
                <input className="w-full border rounded-lg px-2 py-1 text-sm" value={creatingSnowflake.config.username} onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, username: e.target.value } }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Password</label>
                <input type="password" className="w-full border rounded-lg px-2 py-1 text-sm" value={creatingSnowflake.config.password} onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, password: e.target.value } }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Role</label>
                <input className="w-full border rounded-lg px-2 py-1 text-sm" value={creatingSnowflake.config.role || ''} onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, role: e.target.value } }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Warehouse</label>
                <input className="w-full border rounded-lg px-2 py-1 text-sm" value={creatingSnowflake.config.warehouse || ''} onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, warehouse: e.target.value } }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Database</label>
                <input className="w-full border rounded-lg px-2 py-1 text-sm" value={creatingSnowflake.config.database || ''} onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, database: e.target.value } }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Schema</label>
                <input className="w-full border rounded-lg px-2 py-1 text-sm" value={creatingSnowflake.config.schema || ''} onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, schema: e.target.value } }))} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button className="px-3 py-2 text-sm" onClick={() => setShowCreate(false)}>Cancel</button>
              <button disabled={creating} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg" onClick={handleCreate}>{creating ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Connectors List */}
      {loading && (
        <div className="p-3 text-sm text-gray-500">Loading connectors...</div>
      )}
      <div className="bg-white rounded-xl shadow divide-y">
        <div className="px-4 py-3 text-sm text-gray-600">{connectors.length} connector(s)</div>
        <div className="divide-y">
          {connectors.map(c => (
            <div key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{c.name} <span className="text-xs text-gray-500">({c.type})</span></div>
                  <div className="text-xs text-gray-500">Status: {c.last_sync_status || 'n/a'}{c.last_sync_at ? ` • Last sync: ${new Date(c.last_sync_at).toLocaleString()}` : ''}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Schedule: {c.sync_frequency || 'none'}{c.sync_next_run_at ? ` • Next: ${new Date(c.sync_next_run_at).toLocaleString()}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="px-2 py-1.5 text-sm border rounded-lg"
                    value={(c.sync_frequency as string) || 'none'}
                    onChange={async (e) => {
                      try {
                        await connectorsService.updateSchedule(c.id, e.target.value as 'none'|'daily'|'weekly');
                        const list = await connectorsService.list(organizationId!);
                        setConnectors(list);
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Failed to update schedule');
                      }
                    }}
                  >
                    <option value="none">No Schedule</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <button className="px-2 py-1.5 text-sm border rounded-lg flex items-center gap-1" onClick={() => handleTest(c.id)}><TestTube2 className="w-4 h-4"/> Test</button>
                  <button className="px-2 py-1.5 text-sm border rounded-lg flex items-center gap-1" onClick={() => handleExtract(c.id)}><RefreshCw className="w-4 h-4"/> Extract</button>
                  <button className="px-2 py-1.5 text-sm border rounded-lg flex items-center gap-1" onClick={() => toggleHistory(c.id)}><History className="w-4 h-4"/> History</button>
                </div>
              </div>
              {historyOpen[c.id] && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1 pr-3">Started</th>
                        <th className="py-1 pr-3">Completed</th>
                        <th className="py-1 pr-3">Status</th>
                        <th className="py-1 pr-3">Objects</th>
                        <th className="py-1">Columns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history[c.id] || []).map(h => (
                        <tr key={h.id} className="border-t">
                          <td className="py-1 pr-3">{h.started_at ? new Date(h.started_at).toLocaleString() : '-'}</td>
                          <td className="py-1 pr-3">{h.completed_at ? new Date(h.completed_at).toLocaleString() : '-'}</td>
                          <td className="py-1 pr-3">{h.status}</td>
                          <td className="py-1 pr-3">{h.objects_extracted ?? '-'}</td>
                          <td className="py-1">{h.columns_extracted ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
    </div>
  );
}
