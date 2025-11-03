import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, Database, Search, Table } from 'lucide-react';
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
    <div className="p-6 space-y-6">
      {loading && (
        <div className="text-sm text-gray-500">Loading...</div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Snowflake Metadata</h1>
          <p className="text-sm text-gray-500">Browse extracted schemas, tables/views, and columns</p>
        </div>
        <div className="flex gap-2 items-center">
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

          <div className="relative">
            <select
              className="appearance-none pl-3 pr-10 py-2 bg-white border rounded-lg text-sm shadow-sm"
              value={connectorId || ''}
              onChange={(e) => setConnectorId(e.target.value)}
            >
              {connectors.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-2 top-2.5" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Schemas list */}
        <div className="bg-white rounded-xl shadow p-4 lg:col-span-1">
          <div className="flex items-center gap-2 mb-2 text-gray-700"><Database className="w-4 h-4"/> Schemas</div>
          <div className="max-h-96 overflow-auto divide-y">
            {schemas.map(s => (
              <button
                key={s.schema_name}
                onClick={() => setSchema(s.schema_name)}
                className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-50 ${schema === s.schema_name ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.schema_name}</span>
                  <span className="text-xs text-gray-500">{s.object_count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Objects list */}
        <div className="bg-white rounded-xl shadow p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2 text-gray-700">
            <div className="flex items-center gap-2"><Table className="w-4 h-4"/> Objects</div>
            <div className="relative w-64">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search table/view..."
                className="w-full pl-9 pr-3 py-1.5 border rounded-lg text-sm"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2 top-2"/>
            </div>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Schema</th>
                  <th className="py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                {objects.map(o => (
                  <tr
                    key={o.id}
                    className={`border-t hover:bg-gray-50 cursor-pointer ${selected?.id === o.id ? 'bg-indigo-50' : ''}`}
                    onClick={() => setSelected(o)}
                  >
                    <td className="py-2 pr-4 font-medium">{o.name}</td>
                    <td className="py-2 pr-4">{o.schema_name}</td>
                    <td className="py-2 capitalize">{o.object_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columns */}
        <div className="bg-white rounded-xl shadow p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2 text-gray-700"><Table className="w-4 h-4"/> Columns {selected ? `— ${selected.name}` : ''}</div>
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Nullable</th>
                  <th className="py-2">Position</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((c, idx) => (
                  <tr key={`${c.name}:${idx}`} className="border-t">
                    <td className="py-2 pr-4 font-mono">{c.name}</td>
                    <td className="py-2 pr-4">{c.data_type || '-'}</td>
                    <td className="py-2 pr-4">{c.is_nullable ? 'YES' : 'NO'}</td>
                    <td className="py-2">{c.position ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
      )}
    </div>
  );
}
