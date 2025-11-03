import { useState, type ComponentType } from 'react';
import { Database, ServerCog } from 'lucide-react';
import ConnectorsPage from '../dashboard/ConnectorsPage';

interface ConnectorDef {
  key: 'snowflake';
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const CONNECTORS: ConnectorDef[] = [
  {
    key: 'snowflake',
    name: 'Snowflake',
    description: 'Create, test, and run extractions for Snowflake',
    icon: Database,
  },
];

export default function ConnectorsAdmin() {
  const [selected, setSelected] = useState<ConnectorDef | null>(null);

  if (selected?.key === 'snowflake') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <selected.icon className="w-6 h-6 text-indigo-600"/> {selected.name}
            </div>
            <div className="text-sm text-gray-500">{selected.description}</div>
          </div>
          <button className="px-3 py-2 text-sm border rounded-lg" onClick={() => setSelected(null)}>All connectors</button>
        </div>
        <ConnectorsPage />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Connectors</h1>
          <p className="text-sm text-gray-500">All connector setup lives here. Readers only elsewhere.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-gray-500"><ServerCog className="w-5 h-5"/> Admin Only</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CONNECTORS.map(c => {
          const Icon = c.icon;
          return (
            <button key={c.key} onClick={() => setSelected(c)} className="text-left p-4 bg-white rounded-xl shadow hover:shadow-md border border-gray-200 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
