import { useEffect, useState } from 'react';
import enterpriseService from '../../services/enterpriseService';
import { connectorsService, ConnectorItem, ConnectorHistoryRow, CreateSnowflakeRequest } from '../../services/connectorsService';
import { 
  ChevronDown, Plus, TestTube2, RefreshCw, History, 
  Trash2, Edit2, X, Loader2, Play, Database
} from 'lucide-react';
import StatusBadge from '../../components/connectors/StatusBadge';
import DeleteConfirmModal from '../../components/connectors/DeleteConfirmModal';
import EditConnectorModal from '../../components/connectors/EditConnectorModal';
import ExtractionProgress from '../../components/connectors/ExtractionProgress';

export default function ConnectorsPageNew() {
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [creatingSnowflake, setCreatingSnowflake] = useState<CreateSnowflakeRequest>({
    organizationId: '',
    name: '',
    config: { account: '', username: '', password: '', role: '', warehouse: '', database: '', schema: '', passcode: '' },
  });

  // Edit modal
  const [editingConnector, setEditingConnector] = useState<ConnectorItem | null>(null);

  // Delete modal
  const [deletingConnector, setDeletingConnector] = useState<ConnectorItem | null>(null);

  // History
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [history, setHistory] = useState<Record<string, ConnectorHistoryRow[]>>({});

  // Real-time status
  const [extractingIds, setExtractingIds] = useState<Set<string>>(new Set());
  const [jobStatuses, setJobStatuses] = useState<Record<string, { status: string; job: ConnectorHistoryRow | null }>>({});

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

  // Poll status for extracting connectors
  useEffect(() => {
    if (extractingIds.size === 0) return;

    const interval = setInterval(async () => {
      for (const id of extractingIds) {
        try {
          const status = await connectorsService.getStatus(id);
          setJobStatuses(prev => ({ ...prev, [id]: status }));
          
          if (status.status === 'completed' || status.status === 'failed') {
            setExtractingIds(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
            
            if (organizationId) {
              const list = await connectorsService.list(organizationId);
              setConnectors(list);
            }
          }
        } catch (err) {
          console.error(`Failed to get status for ${id}:`, err);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [extractingIds, organizationId]);

  const toggleHistory = async (id: string) => {
    setHistoryOpen(prev => ({ ...prev, [id]: !prev[id] }));
    if (!history[id]) {
      const rows = await connectorsService.history(id);
      setHistory(prev => ({ ...prev, [id]: rows }));
    }
  };

  const handleCreate = async () => {
    if (!creatingSnowflake.organizationId || !creatingSnowflake.name || 
        !creatingSnowflake.config.account || !creatingSnowflake.config.username || 
        !creatingSnowflake.config.password) {
      alert('Please fill required fields: name, account, username, password');
      return;
    }
    try {
      setCreating(true);
      await connectorsService.createSnowflake(creatingSnowflake);
      setShowCreate(false);
      if (organizationId) {
        const list = await connectorsService.list(organizationId);
        setConnectors(list);
      }
      setCreatingSnowflake({ 
        organizationId: creatingSnowflake.organizationId, 
        name: '', 
        config: { account: '', username: '', password: '', role: '', warehouse: '', database: '', schema: '', passcode: '' } 
      });
    } catch (e: unknown) {
      alert('❌ ' + (e instanceof Error ? e.message : 'Failed to create connector'));
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async (name: string, config: Record<string, string | undefined>) => {
    if (!editingConnector) return;
    await connectorsService.update(editingConnector.id, { name, config });
    setEditingConnector(null);
    if (organizationId) {
      const list = await connectorsService.list(organizationId);
      setConnectors(list);
    }
  };

  const handleDelete = async () => {
    if (!deletingConnector) return;
    try {
      await connectorsService.delete(deletingConnector.id);
      setDeletingConnector(null);
      if (organizationId) {
        const list = await connectorsService.list(organizationId);
        setConnectors(list);
      }
    } catch (e: unknown) {
      alert('❌ ' + (e instanceof Error ? e.message : 'Failed to delete connector'));
    }
  };

  const handleTest = async (id: string) => {
    try {
      await connectorsService.test(id);
      alert('✅ Connection test succeeded');
    } catch (e: unknown) {
      alert('❌ ' + (e instanceof Error ? e.message : 'Test failed'));
    }
  };

  const handleExtract = async (id: string) => {
    try {
      await connectorsService.extract(id);
      setExtractingIds(prev => new Set(prev).add(id));
    } catch (e: unknown) {
      alert('❌ ' + (e instanceof Error ? e.message : 'Extraction failed'));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Snowflake Connectors</h1>
          <p className="text-sm text-gray-500">Manage data warehouse connections and metadata extraction</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-white border rounded-lg text-sm shadow-sm focus:ring-2 focus:ring-indigo-500"
              value={organizationId || ''}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-2.5 pointer-events-none" />
          </div>
          <button 
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-indigo-700 transition-colors" 
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4"/> New Connector
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create Snowflake Connector</h2>
                <p className="text-sm text-gray-500">Connect to your Snowflake data warehouse</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Connector Name *</label>
                  <input 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    placeholder="e.g., Production Snowflake"
                    value={creatingSnowflake.name} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, name: e.target.value }))} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
                  <input 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    placeholder="abc123.us-east-1"
                    value={creatingSnowflake.config.account} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, account: e.target.value } }))} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                  <input 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    value={creatingSnowflake.config.username} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, username: e.target.value } }))} 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input 
                    type="password" 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    value={creatingSnowflake.config.password} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, password: e.target.value } }))} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <input 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    placeholder="ACCOUNTADMIN"
                    value={creatingSnowflake.config.role || ''} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, role: e.target.value } }))} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                  <input 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    placeholder="COMPUTE_WH"
                    value={creatingSnowflake.config.warehouse || ''} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, warehouse: e.target.value } }))} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Database</label>
                  <input 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    placeholder="ANALYTICS"
                    value={creatingSnowflake.config.database || ''} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, database: e.target.value } }))} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Schema</label>
                  <input 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" 
                    placeholder="PUBLIC"
                    value={creatingSnowflake.config.schema || ''} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, schema: e.target.value } }))} 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    MFA Token (Optional)
                  </label>
                  <input 
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-mono" 
                    placeholder="123456"
                    maxLength={6}
                    value={creatingSnowflake.config.passcode || ''} 
                    onChange={(e) => setCreatingSnowflake(prev => ({ ...prev, config: { ...prev.config, passcode: e.target.value } }))} 
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    If MFA is enabled on your Snowflake account, enter the 6-digit TOTP code from your authenticator app
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
                <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button 
                  disabled={creating} 
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2" 
                  onClick={handleCreate}
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating ? 'Creating...' : 'Create Connector'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingConnector && (
        <EditConnectorModal
          connectorName={editingConnector.name}
          currentConfig={editingConnector.config || {}}
          onSave={handleEdit}
          onCancel={() => setEditingConnector(null)}
        />
      )}

      {/* Delete Modal */}
      {deletingConnector && (
        <DeleteConfirmModal
          connectorName={deletingConnector.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingConnector(null)}
        />
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      )}

      {/* Empty State */}
      {!loading && connectors.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No connectors yet</h3>
          <p className="text-sm text-gray-500 mb-6">Create your first Snowflake connector to start extracting metadata</p>
          <button 
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-indigo-700" 
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4"/> New Connector
          </button>
        </div>
      )}

      {/* Connectors List */}
      {!loading && connectors.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border divide-y">
          {connectors.map(c => (
            <div key={c.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg">{c.name}</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{c.type}</span>
                    <StatusBadge 
                      status={c.last_sync_status} 
                      isExtracting={extractingIds.has(c.id)} 
                    />
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {c.last_sync_at && (
                      <div>Last sync: {new Date(c.last_sync_at).toLocaleString()}</div>
                    )}
                    {c.sync_frequency && c.sync_frequency !== 'none' && (
                      <div>
                        Schedule: {c.sync_frequency}
                        {c.sync_next_run_at && ` • Next: ${new Date(c.sync_next_run_at).toLocaleString()}`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    value={(c.sync_frequency as string) || 'none'}
                    onChange={async (e) => {
                      try {
                        await connectorsService.updateSchedule(c.id, e.target.value as 'none'|'daily'|'weekly');
                        if (organizationId) {
                          const list = await connectorsService.list(organizationId);
                          setConnectors(list);
                        }
                      } catch (err) {
                        alert(err instanceof Error ? err.message : 'Failed to update schedule');
                      }
                    }}
                  >
                    <option value="none">Manual</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                  <button 
                    className="px-3 py-1.5 text-sm border rounded-lg flex items-center gap-1.5 hover:bg-gray-50" 
                    onClick={() => handleTest(c.id)}
                    title="Test connection"
                  >
                    <TestTube2 className="w-4 h-4"/> Test
                  </button>
                  <button 
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg flex items-center gap-1.5 hover:bg-indigo-700 disabled:opacity-50" 
                    onClick={() => handleExtract(c.id)}
                    disabled={extractingIds.has(c.id)}
                    title="Extract metadata"
                  >
                    {extractingIds.has(c.id) ? <Loader2 className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4"/>}
                    Extract
                  </button>
                  <button 
                    className="px-3 py-1.5 text-sm border rounded-lg flex items-center gap-1.5 hover:bg-gray-50" 
                    onClick={() => toggleHistory(c.id)}
                    title="View history"
                  >
                    <History className="w-4 h-4"/> History
                  </button>
                  <button 
                    className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" 
                    onClick={() => setEditingConnector(c)}
                    title="Edit connector"
                  >
                    <Edit2 className="w-4 h-4"/>
                  </button>
                  <button 
                    className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg" 
                    onClick={() => setDeletingConnector(c)}
                    title="Delete connector"
                  >
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>

              {/* Extraction Progress */}
              {extractingIds.has(c.id) && (
                <ExtractionProgress job={jobStatuses[c.id]?.job || null} />
              )}

              {/* History Table */}
              {historyOpen[c.id] && (
                <div className="mt-4 bg-gray-50 rounded-lg p-4 border">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Extraction History</h4>
                  {history[c.id]?.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No extraction history yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600 border-b">
                            <th className="py-2 pr-4 font-medium">Started</th>
                            <th className="py-2 pr-4 font-medium">Completed</th>
                            <th className="py-2 pr-4 font-medium">Status</th>
                            <th className="py-2 pr-4 font-medium">Objects</th>
                            <th className="py-2 font-medium">Columns</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(history[c.id] || []).map(h => (
                            <tr key={h.id}>
                              <td className="py-2 pr-4">{h.started_at ? new Date(h.started_at).toLocaleString() : '-'}</td>
                              <td className="py-2 pr-4">{h.completed_at ? new Date(h.completed_at).toLocaleString() : '-'}</td>
                              <td className="py-2 pr-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  h.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  h.status === 'failed' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {h.status}
                                </span>
                              </td>
                              <td className="py-2 pr-4">{h.objects_extracted ?? '-'}</td>
                              <td className="py-2">{h.columns_extracted ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
    </div>
  );
}
