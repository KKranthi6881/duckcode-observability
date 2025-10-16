import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Key, Trash2, Star, AlertTriangle } from 'lucide-react';
import type { Organization, OrganizationApiKey, ProviderType } from '../../types/enterprise';
import { apiKeyService } from '../../services/enterpriseService';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

const PROVIDERS: { value: ProviderType; label: string; icon: string }[] = [
  { value: 'openai', label: 'OpenAI', icon: '🤖' },
  { value: 'anthropic', label: 'Anthropic (Claude)', icon: '🧠' },
  { value: 'azure', label: 'Azure OpenAI', icon: '☁️' },
  { value: 'gemini', label: 'Google Gemini', icon: '✨' },
  { value: 'bedrock', label: 'AWS Bedrock', icon: '🏗️' },
];

export const ApiKeys: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [apiKeys, setApiKeys] = useState<OrganizationApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'openai' as ProviderType,
    api_key: '',
    key_name: '',
    is_default: false,
  });

  useEffect(() => {
    if (selectedOrg) {
      loadApiKeys();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  const loadApiKeys = async () => {
    if (!selectedOrg) return;
    
    try {
      setLoading(true);
      const data = await apiKeyService.getApiKeys(selectedOrg.id);
      setApiKeys(data);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleAddApiKey = async () => {
    if (!selectedOrg || !formData.api_key) return;
    
    try {
      await apiKeyService.createApiKey({
        organization_id: selectedOrg.id,
        provider: formData.provider,
        api_key: formData.api_key,
        key_name: formData.key_name || `${getProviderInfo(formData.provider).label} Key`,
        is_default: formData.is_default,
      });
      
      setShowAddModal(false);
      setFormData({
        provider: 'openai',
        api_key: '',
        key_name: '',
        is_default: false,
      });
      await loadApiKeys();
      alert('API key added successfully!');
    } catch (error) {
      console.error('Failed to add API key:', error);
      alert(`Failed to add API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!selectedOrg) return;
    
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await apiKeyService.deleteApiKey(selectedOrg.id, keyId);
      await loadApiKeys();
      alert('API key revoked successfully');
    } catch (error) {
      console.error('Failed to delete API key:', error);
      alert(`Failed to revoke API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSetDefault = async (keyId: string) => {
    if (!selectedOrg) return;

    try {
      await apiKeyService.setDefaultApiKey(selectedOrg.id, keyId);
      await loadApiKeys();
      alert('Default key updated successfully');
    } catch (error) {
      console.error('Failed to set default key:', error);
      alert(`Failed to set default key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  const getProviderInfo = (provider: ProviderType) => {
    return PROVIDERS.find(p => p.value === provider) || PROVIDERS[0];
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      expired: 'bg-red-100 text-red-700',
      revoked: 'bg-yellow-100 text-yellow-700',
    };
    return colors[status] || colors.inactive;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
          <p className="mt-2 text-gray-600">
            Manage LLM provider API keys for your organization
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>Add API Key</span>
        </button>
      </div>

      {/* Security Notice */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Key className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Secure API Key Storage</h3>
            <p className="text-sm text-blue-700">
              All API keys are encrypted with AES-256-GCM before storage. Only organization admins can view and manage keys.
            </p>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Key className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No API keys configured
          </h3>
          <p className="text-gray-600 mb-6">
            Add your LLM provider API keys to enable AI-powered features
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            <span>Add API Key</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => {
            const providerInfo = getProviderInfo(apiKey.provider);

            return (
              <div key={apiKey.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="text-2xl">{providerInfo.icon}</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {apiKey.key_name || providerInfo.label}
                          </h3>
                          {apiKey.is_default && (
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{providerInfo.label}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider">API Key</label>
                        <div className="flex items-center space-x-2 mt-1">
                          <code className="text-sm font-mono text-gray-900">
                            {apiKey.masked_key}
                          </code>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Status</label>
                        <div className="mt-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(apiKey.status)}`}>
                            {apiKey.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Created</label>
                        <p className="text-sm text-gray-900 mt-1">
                          {new Date(apiKey.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Last Used</label>
                        <p className="text-sm text-gray-900 mt-1">
                          {apiKey.last_used_at 
                            ? new Date(apiKey.last_used_at).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {!apiKey.is_default && (
                        <button 
                          onClick={() => handleSetDefault(apiKey.id)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                        >
                          <Star className="h-4 w-4" />
                          <span>Set as Default</span>
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center space-x-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add API Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add API Key
            </h3>

            {/* Warning */}
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  API keys are encrypted and stored securely. Never share your keys publicly.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as ProviderType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {PROVIDERS.map(provider => (
                    <option key={provider.value} value={provider.value}>
                      {provider.icon} {provider.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.key_name}
                  onChange={(e) => setFormData({ ...formData, key_name: e.target.value })}
                  placeholder="e.g., Production Key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your API key will be encrypted before storage
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Set as default key for this provider
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddApiKey}
                disabled={!formData.api_key}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add API Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeys;
