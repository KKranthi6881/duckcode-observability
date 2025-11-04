import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface SnowflakeConfig extends Record<string, string | undefined> {
  account: string;
  username: string;
  password: string;
  role?: string;
  warehouse?: string;
  database?: string;
  schema?: string;
  passcode?: string;
}

interface EditConnectorModalProps {
  connectorName: string;
  currentConfig: Record<string, unknown>;
  onSave: (name: string, config: Record<string, string | undefined>) => Promise<void>;
  onCancel: () => void;
}

export default function EditConnectorModal({ connectorName, currentConfig, onSave, onCancel }: EditConnectorModalProps) {
  const [name, setName] = useState(connectorName);
  const [config, setConfig] = useState<SnowflakeConfig>({
    account: (currentConfig.account as string) || '',
    username: (currentConfig.username as string) || '',
    password: '', // Always empty for security
    role: (currentConfig.role as string) || '',
    warehouse: (currentConfig.warehouse as string) || '',
    database: (currentConfig.database as string) || '',
    schema: (currentConfig.schema as string) || '',
    passcode: '' // Always empty for security
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Connector name is required');
      return;
    }

    if (!config.account || !config.username || !config.password) {
      setError('Account, username, and password are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(name.trim(), config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update connector');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edit Snowflake Connector</h2>
            <p className="text-sm text-gray-500">Update all connection details</p>
          </div>
          <button 
            className="text-gray-400 hover:text-gray-600" 
            onClick={onCancel}
            disabled={saving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Connector Name *
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                value={name} 
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., Production Snowflake"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account *
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                value={config.account} 
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, account: e.target.value }));
                  setError(null);
                }}
                placeholder="BJUOPQF-ID86727"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                value={config.username} 
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, username: e.target.value }));
                  setError(null);
                }}
                disabled={saving}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <input 
                type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                value={config.password} 
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, password: e.target.value }));
                  setError(null);
                }}
                placeholder="Enter password"
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-500">
                You must re-enter the password to update the connector
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                value={config.role || ''} 
                onChange={(e) => setConfig(prev => ({ ...prev, role: e.target.value }))}
                placeholder="ACCOUNTADMIN"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Warehouse
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                value={config.warehouse || ''} 
                onChange={(e) => setConfig(prev => ({ ...prev, warehouse: e.target.value }))}
                placeholder="COMPUTE_WH"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                value={config.database || ''} 
                onChange={(e) => setConfig(prev => ({ ...prev, database: e.target.value }))}
                placeholder="SNOWFLAKE_SAMPLE_DATA"
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schema
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                value={config.schema || ''} 
                onChange={(e) => setConfig(prev => ({ ...prev, schema: e.target.value }))}
                placeholder="TPCH_SF1"
                disabled={saving}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                MFA Token (Optional)
              </label>
              <input 
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono" 
                value={config.passcode || ''} 
                onChange={(e) => setConfig(prev => ({ ...prev, passcode: e.target.value }))}
                placeholder="123456"
                maxLength={6}
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-500">
                If MFA is enabled, enter the 6-digit TOTP code from your authenticator app
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
            <button 
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button 
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
              onClick={handleSave}
              disabled={saving || !name.trim() || !config.account || !config.username || !config.password}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
