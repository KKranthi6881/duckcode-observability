import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Database, Search, Table, Columns, Loader2 } from 'lucide-react';
import enterpriseService from '../../services/enterpriseService';
import { snowflakeCostService } from '../../services/snowflakeCostService';
import { snowflakeMetadataService, SchemaItem, ObjectItem, ColumnItem } from '../../services/snowflakeMetadataService';

export default function SnowflakeMetadataView() {
  const location = useLocation();
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [connectors, setConnectors] = useState<{ id: string; name: string }[]>([]);
  const [connectorId, setConnectorId] = useState<string | null>(null);

  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [schema, setSchema] = useState<string | null>(null);

  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ObjectItem | null>(null);
  const [columns, setColumns] = useState<ColumnItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const orgs = await enterpriseService.organization.getUserOrganizations();
        const simplified = orgs.map((o: { organization_id: string; organization_name?: string }) => ({ id: o.organization_id, name: o.organization_name || o.organization_id }));
        setOrganizations(simplified);
        const pickedOrg = simplified[0]?.id || null;
        setOrganizationId(prev => prev || pickedOrg);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load organizations');
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
        setError(e instanceof Error ? e.message : 'Failed to load connectors');
      } finally {
        setLoading(false);
      }
    };
    loadConnectors();
  }, [organizationId, connectorId]);

  useEffect(() => {
    const loadSchemas = async () => {
      if (!connectorId) return;
      try {
        setLoading(true);
        const s = await snowflakeMetadataService.listSchemas(connectorId);
        setSchemas(s);
        const params = new URLSearchParams(location.search);
        const schemaParam = params.get('schema');
        const picked = (schemaParam && s.find(x => x.schema_name === schemaParam)) ? schemaParam : s[0]?.schema_name || null;
        setSchema(prev => prev || picked);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load schemas');
      } finally {
        setLoading(false);
      }
    };
    loadSchemas();
  }, [connectorId, location.search]);

  useEffect(() => {
    const loadObjects = async () => {
      if (!connectorId) return;
      try {
        setLoading(true);
        const o = await snowflakeMetadataService.listObjects(connectorId, schema || undefined, search || undefined);
        setObjects(o);
        setSelected(null);
        setColumns([]);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load objects');
      } finally {
        setLoading(false);
      }
    };
    loadObjects();
  }, [connectorId, schema, search]);

  useEffect(() => {
    const loadColumns = async () => {
      if (!selected) return;
      try {
        setLoading(true);
        const c = await snowflakeMetadataService.listColumns(selected.id);
        setColumns(c);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load columns');
      } finally {
        setLoading(false);
      }
    };
    loadColumns();
  }, [selected]);

  return (
    <div className="min-h-screen bg-[#0d0c0c] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Snowflake Metadata</h1>
          <p className="text-sm text-[#8d857b]">Browse extracted schemas, tables/views, and columns</p>
        </div>
        <div className="flex gap-3 items-center">
          {loading && (
            <div className="flex items-center gap-2 text-[#ff6a3c]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-[#161413] border border-[#2d2a27] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50"
              value={organizationId || ''}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {organizations.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#8d857b] absolute right-2 top-2.5 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-[#161413] border border-[#2d2a27] rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50"
              value={connectorId || ''}
              onChange={(e) => setConnectorId(e.target.value)}
            >
              {connectors.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#8d857b] absolute right-2 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Schemas list */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5 lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-blue-400"/>
            <span className="font-bold text-white">Schemas</span>
            <span className="ml-auto text-xs text-[#8d857b]">{schemas.length}</span>
          </div>
          <div className="max-h-96 overflow-auto space-y-1">
            {schemas.map(s => (
              <button
                key={s.schema_name}
                onClick={() => setSchema(s.schema_name)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                  schema === s.schema_name 
                    ? 'bg-[#ff6a3c] text-white' 
                    : 'text-[#8d857b] hover:bg-[#1f1d1b] hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.schema_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    schema === s.schema_name
                      ? 'bg-white/20'
                      : 'bg-[#1f1d1b]'
                  }`}>{s.object_count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Objects list */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-green-400"/>
              <span className="font-bold text-white">Tables & Views</span>
              <span className="text-xs text-[#8d857b]">{objects.length}</span>
            </div>
            <div className="relative w-64">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search table/view..."
                className="w-full pl-9 pr-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg text-sm text-white placeholder-[#8d857b] focus:outline-none focus:ring-2 focus:ring-[#ff6a3c]/50"
              />
              <Search className="w-4 h-4 text-[#8d857b] absolute left-2.5 top-2.5"/>
            </div>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-[#161413]">
                <tr className="text-left text-[#8d857b] border-b border-[#2d2a27]">
                  <th className="py-3 pr-4 font-semibold">Name</th>
                  <th className="py-3 pr-4 font-semibold">Schema</th>
                  <th className="py-3 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody>
                {objects.map(o => (
                  <tr
                    key={o.id}
                    className={`border-b border-[#2d2a27] cursor-pointer transition-all ${
                      selected?.id === o.id 
                        ? 'bg-[#ff6a3c]/20 hover:bg-[#ff6a3c]/30' 
                        : 'hover:bg-[#1f1d1b]'
                    }`}
                    onClick={() => setSelected(o)}
                  >
                    <td className="py-3 pr-4 font-medium text-white">{o.name}</td>
                    <td className="py-3 pr-4 text-[#8d857b]">{o.schema_name}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        o.object_type === 'table' 
                          ? 'bg-blue-600/20 border border-blue-600/30 text-blue-400'
                          : 'bg-purple-600/20 border border-purple-600/30 text-purple-400'
                      }`}>
                        {o.object_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columns */}
        <div className="bg-[#161413] border border-[#2d2a27] rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Columns className="w-5 h-5 text-purple-400"/>
            <span className="font-bold text-white">Columns</span>
            {selected && (
              <>
                <span className="text-[#8d857b]">—</span>
                <span className="text-[#ff6a3c] font-semibold">{selected.name}</span>
                <span className="ml-auto text-xs text-[#8d857b]">{columns.length} columns</span>
              </>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-64 text-[#8d857b]">
                <Columns className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">Select a table or view to see its columns</p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-[#161413]">
                  <tr className="text-left text-[#8d857b] border-b border-[#2d2a27]">
                    <th className="py-3 pr-4 font-semibold">Name</th>
                    <th className="py-3 pr-4 font-semibold">Data Type</th>
                    <th className="py-3 pr-4 font-semibold">Nullable</th>
                    <th className="py-3 font-semibold">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((c, idx) => (
                    <tr key={`${c.name}:${idx}`} className="border-b border-[#2d2a27] hover:bg-[#1f1d1b] transition-all">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">🔑</span>
                          <span className="font-mono text-white">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-1 bg-[#1f1d1b] border border-[#2d2a27] rounded text-cyan-400 font-mono text-xs">
                          {c.data_type || '-'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          c.is_nullable
                            ? 'bg-yellow-600/20 border border-yellow-600/30 text-yellow-400'
                            : 'bg-green-600/20 border border-green-600/30 text-green-400'
                        }`}>
                          {c.is_nullable ? 'NULL' : 'NOT NULL'}
                        </span>
                      </td>
                      <td className="py-3 text-[#8d857b]">{c.position ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-600/20 border border-red-600/30 text-red-400 text-sm flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
