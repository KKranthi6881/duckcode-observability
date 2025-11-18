import { useState, useEffect } from 'react';
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
      active: 'bg-green-600/20 border border-green-600/30 text-green-400',
      inactive: 'bg-accent border border-border text-muted-foreground',
      expired: 'bg-red-600/20 border border-red-600/30 text-red-400',
      revoked: 'bg-yellow-600/20 border border-yellow-600/30 text-yellow-400',
    };
    return colors[status] || colors.inactive;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage LLM provider API keys for your organization</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold text-sm"
          >
            <Plus className="h-4 w-4" />
            Add API Key
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">
        {/* Security Notice */}
        <div className="mb-6 bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Key className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Secure API Key Storage</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                All API keys are encrypted with <span className="font-mono font-medium">AES-256-GCM</span> before storage.
                Only organization admins can view and manage keys.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Key className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">
            No API keys configured
          </h3>
          <p className="text-muted-foreground mb-6">
            Add your LLM provider API keys to enable AI-powered features
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 font-semibold"
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
              <div key={apiKey.id} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="text-2xl">{providerInfo.icon}</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-bold text-foreground">
                            {apiKey.key_name || providerInfo.label}
                          </h3>
                          {apiKey.is_default && (
                            <Star className="h-4 w-4 text-primary fill-current" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{providerInfo.label}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">API Key</label>
                        <div className="flex items-center space-x-2 mt-1">
                          <code className="text-sm font-mono text-foreground">
                            {apiKey.masked_key}
                          </code>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</label>
                        <div className="mt-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(apiKey.status)}`}>
                            {apiKey.status}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Created</label>
                        <p className="text-sm text-foreground mt-1">
                          {new Date(apiKey.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Last Used</label>
                        <p className="text-sm text-foreground mt-1">
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
                          className="text-sm text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
                        >
                          <Star className="h-4 w-4" />
                          <span>Set as Default</span>
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteApiKey(apiKey.id)}
                        className="text-sm text-red-400 hover:text-red-300 font-semibold flex items-center space-x-1"
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
        <div className="fixed inset-0 bg-modal-overlay/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-bold text-foreground mb-4">
              Add API Key
            </h3>

            {/* Warning */}
            <div className="mb-4 bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                <p className="text-sm text-yellow-400/80">
                  API keys are encrypted and stored securely. Never share your keys publicly.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Provider
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as ProviderType })}
                  className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                >
                  {PROVIDERS.map(provider => (
                    <option key={provider.value} value={provider.value}>
                      {provider.icon} {provider.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Key Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.key_name}
                  onChange={(e) => setFormData({ ...formData, key_name: e.target.value })}
                  placeholder="e.g., Production Key"
                  className="w-full px-3 py-2 bg-muted border border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-muted border border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Your API key will be encrypted before storage
                </p>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="h-4 w-4 text-primary bg-muted border-border rounded focus:ring-primary"
                />
                <label className="ml-2 text-sm text-foreground">
                  Set as default key for this provider
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-foreground bg-muted border border-border rounded-lg hover:bg-accent font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddApiKey}
                disabled={!formData.api_key}
                className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 disabled:bg-accent disabled:text-muted-foreground disabled:cursor-not-allowed font-semibold"
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
