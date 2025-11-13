import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Shield, Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { Organization, OrganizationRole } from '../../types/enterprise';
import type { SsoConnection, SsoDomain } from '../../services/enterpriseService';
import { ssoService, roleService } from '../../services/enterpriseService';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

export const SSO: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [connections, setConnections] = useState<SsoConnection[]>([]);
  const [domains, setDomains] = useState<SsoDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [connectionForm, setConnectionForm] = useState({
    provider_type: 'okta',
    provider_label: '',
    issuer_url: '',
    authorization_url: '',
    token_url: '',
    jwks_url: '',
    client_id: '',
    client_secret: '',
    enforce_sso: false,
    allow_password_fallback: true,
    default_role_id: '',
  });

  const [domainForm, setDomainForm] = useState<{ domain_name: string; connection_id?: string | null }>({
    domain_name: '',
    connection_id: undefined,
  });

  const loadAll = async () => {
    if (!selectedOrg) return;
    try {
      setLoading(true);
      const [cfg, orgRoles] = await Promise.all([
        ssoService.getSsoConfig(selectedOrg.id),
        roleService.getOrganizationRoles(selectedOrg.id),
      ]);
      setConnections(cfg.connections || []);
      setDomains(cfg.domains || []);
      setRoles(orgRoles || []);
      if (!connectionForm.default_role_id && orgRoles.length > 0) {
        setConnectionForm(prev => ({ ...prev, default_role_id: orgRoles[0].id }));
      }
    } catch (e) {
      alert('Failed to load SSO configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (c: SsoConnection) => {
    if (!c.id) return;
    if (!confirm(`Delete SSO connection "${c.provider_label || c.provider_type}"? Domains linked to it will be detached.`)) return;
    try {
      setSaving(true);
      await ssoService.deleteSsoConnection(c.id);
      await loadAll();
      alert('SSO connection deleted');
    } catch (e) {
      alert('Failed to delete SSO connection');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg?.id]);

  const handleSaveConnection = async () => {
    if (!selectedOrg) return;
    if (!connectionForm.provider_type || !connectionForm.issuer_url || !connectionForm.client_id) {
      alert('Please fill provider type, issuer URL and client ID');
      return;
    }
    try {
      setSaving(true);
      const computedLabel = connectionForm.provider_label && connectionForm.provider_label.trim().length > 0
        ? connectionForm.provider_label
        : connectionForm.provider_type.charAt(0).toUpperCase() + connectionForm.provider_type.slice(1);
      const payload = {
        organization_id: selectedOrg.id,
        provider_type: connectionForm.provider_type,
        provider_label: computedLabel,
        issuer_url: connectionForm.issuer_url,
        authorization_url: connectionForm.authorization_url || undefined,
        token_url: connectionForm.token_url || undefined,
        jwks_url: connectionForm.jwks_url || undefined,
        client_id: connectionForm.client_id,
        client_secret: connectionForm.client_secret || undefined,
        default_role_id: connectionForm.default_role_id || undefined,
        enforce_sso: connectionForm.enforce_sso,
        allow_password_fallback: connectionForm.allow_password_fallback,
        metadata: undefined,
      };
      await ssoService.upsertSsoConnection(payload);
      setConnectionForm({
        provider_type: 'okta',
        provider_label: '',
        issuer_url: '',
        authorization_url: '',
        token_url: '',
        jwks_url: '',
        client_id: '',
        client_secret: '',
        enforce_sso: false,
        allow_password_fallback: true,
        default_role_id: roles[0]?.id || '',
      });
      await loadAll();
      alert('SSO connection saved');
    } catch (e) {
      alert('Failed to save SSO connection');
    } finally {
      setSaving(false);
    }
  };

  const handleEditConnection = (c: SsoConnection) => {
    setConnectionForm({
      provider_type: c.provider_type,
      provider_label: c.provider_label || '',
      issuer_url: c.issuer_url || '',
      authorization_url: c.authorization_url || '',
      token_url: c.token_url || '',
      jwks_url: c.jwks_url || '',
      client_id: c.client_id,
      client_secret: '',
      enforce_sso: Boolean(c.enforce_sso),
      allow_password_fallback: Boolean(c.allow_password_fallback ?? true),
      default_role_id: c.default_role_id || roles[0]?.id || '',
    });
  };

  const clearConnectionForm = () => {
    setConnectionForm({
      provider_type: 'okta',
      provider_label: '',
      issuer_url: '',
      authorization_url: '',
      token_url: '',
      jwks_url: '',
      client_id: '',
      client_secret: '',
      enforce_sso: false,
      allow_password_fallback: true,
      default_role_id: roles[0]?.id || '',
    });
  };

  const applyProviderPreset = () => {
    if (connectionForm.provider_type === 'okta') {
      setConnectionForm(prev => ({
        ...prev,
        authorization_url: prev.authorization_url || 'https://YOUR_OKTA_DOMAIN/oauth2/v1/authorize',
        token_url: prev.token_url || 'https://YOUR_OKTA_DOMAIN/oauth2/v1/token',
        jwks_url: prev.jwks_url || 'https://YOUR_OKTA_DOMAIN/oauth2/v1/keys',
      }));
    } else if (connectionForm.provider_type === 'azure') {
      setConnectionForm(prev => ({
        ...prev,
        issuer_url: prev.issuer_url || 'https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0',
        authorization_url: prev.authorization_url || 'https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/authorize',
        token_url: prev.token_url || 'https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token',
      }));
    }
  };

  const handleCreateDomain = async () => {
    if (!selectedOrg) return;
    if (!domainForm.domain_name) {
      alert('Enter domain name');
      return;
    }
    try {
      setSaving(true);
      await ssoService.createSsoDomain({
        organization_id: selectedOrg.id,
        domain_name: domainForm.domain_name,
        connection_id: domainForm.connection_id ?? null,
      });
      setDomainForm({ domain_name: '', connection_id: undefined });
      await loadAll();
      alert('Domain added');
    } catch (e) {
      alert('Failed to add domain');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDomain = async (domain: SsoDomain) => {
    const token = prompt('Enter domain verification token');
    if (!token) return;
    try {
      setSaving(true);
      await ssoService.verifySsoDomain(domain.id, token);
      await loadAll();
      alert('Domain verified');
    } catch (e) {
      alert('Failed to verify domain');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDomain = async (domain: SsoDomain) => {
    if (!confirm(`Delete domain ${domain.domain_name}?`)) return;
    try {
      setSaving(true);
      await ssoService.deleteSsoDomain(domain.id);
      await loadAll();
      alert('Domain deleted');
    } catch (e) {
      alert('Failed to delete domain');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full bg-background">
      <div className="bg-card border-b border-border px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">SSO Management</h1>
              <p className="text-sm text-muted-foreground mt-1">Configure enterprise SSO providers and email domains</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-muted border-b border-border">
            <h3 className="text-sm font-bold text-foreground uppercase">Domain Verification Help</h3>
          </div>
          <div className="p-6 space-y-3 text-sm text-foreground">
            <p>To verify a domain for SSO enforcement:</p>
            <ol className="list-decimal list-inside space-y-1 text-foreground">
              <li>Add your email domain in the Domains section above and assign an SSO connection if needed.</li>
              <li>Obtain the verification token issued for the domain by your administrator or support.</li>
              <li>Click Verify next to the domain and paste the token to complete verification.</li>
            </ol>
            <p className="text-muted-foreground">After verification, Enforce SSO can be enabled in the connection. Users with that domain will be required to sign in with SSO.</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-muted border-b border-border">
            <h3 className="text-sm font-bold text-foreground uppercase">Connections</h3>
          </div>
          <div className="p-6 grid md:grid-cols-2 gap-8">
            <div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Provider</label>
                  <select
                    value={connectionForm.provider_type}
                    onChange={(e) => setConnectionForm({ ...connectionForm, provider_type: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                  >
                    <option value="okta">Okta</option>
                    <option value="azure">Azure AD</option>
                    <option value="oidc">OIDC</option>
                    <option value="saml">SAML</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Label</label>
                  <input
                    value={connectionForm.provider_label}
                    onChange={(e) => setConnectionForm({ ...connectionForm, provider_label: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                    placeholder="e.g. Acme Okta"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Issuer URL</label>
                  <input
                    value={connectionForm.issuer_url}
                    onChange={(e) => setConnectionForm({ ...connectionForm, issuer_url: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                    placeholder="https://dev-123.okta.com"
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Authorization URL</label>
                    <input
                      value={connectionForm.authorization_url}
                      onChange={(e) => setConnectionForm({ ...connectionForm, authorization_url: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Token URL</label>
                    <input
                      value={connectionForm.token_url}
                      onChange={(e) => setConnectionForm({ ...connectionForm, token_url: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">JWKS URL</label>
                    <input
                      value={connectionForm.jwks_url}
                      onChange={(e) => setConnectionForm({ ...connectionForm, jwks_url: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Client ID</label>
                    <input
                      value={connectionForm.client_id}
                      onChange={(e) => setConnectionForm({ ...connectionForm, client_id: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Client Secret</label>
                    <input
                      type="password"
                      value={connectionForm.client_secret}
                      onChange={(e) => setConnectionForm({ ...connectionForm, client_secret: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={connectionForm.enforce_sso}
                      onChange={(e) => setConnectionForm({ ...connectionForm, enforce_sso: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-foreground">Enforce SSO</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={connectionForm.allow_password_fallback}
                      onChange={(e) => setConnectionForm({ ...connectionForm, allow_password_fallback: e.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-foreground">Allow Password Fallback</span>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Default Role</label>
                    <select
                      value={connectionForm.default_role_id}
                      onChange={(e) => setConnectionForm({ ...connectionForm, default_role_id: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                    >
                      {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.display_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={applyProviderPreset}
                    className="px-3 py-2 text-sm bg-muted border border-border text-foreground rounded-lg hover:bg-accent"
                  >
                    Apply provider preset
                  </button>
                  <button
                    onClick={handleSaveConnection}
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 disabled:bg-accent disabled:text-muted-foreground font-semibold"
                  >
                    {saving ? 'Saving...' : 'Save Connection'}
                  </button>
                  <button
                    type="button"
                    onClick={clearConnectionForm}
                    className="px-4 py-2 bg-muted border border-border text-foreground rounded-lg hover:bg-accent"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
            <div>
              <div className="space-y-4">
                {connections.length === 0 && (
                  <div className="p-4 bg-muted border border-border rounded-lg text-muted-foreground">No connections configured</div>
                )}
                {connections.map((c) => (
                  <div key={c.id} className="p-4 bg-muted border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-foreground font-semibold">{c.provider_label || c.provider_type}</div>
                        <div className="text-xs text-muted-foreground">{c.issuer_url}</div>
                      </div>
                      <div className="flex items-center space-x-3 text-xs">
                        <span className={`px-2 py-1 rounded-full ${c.enforce_sso ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-accent text-white'}`}>Enforced</span>
                        <span className={`px-2 py-1 rounded-full ${c.allow_password_fallback ? 'bg-accent text-white' : 'bg-accent text-muted-foreground'}`}>Password Fallback</span>
                        <span className={`px-2 py-1 rounded-full ${c.has_client_secret ? 'bg-accent text-green-400' : 'bg-accent text-muted-foreground'}`}>{c.has_client_secret ? 'Secret Set' : 'No Secret'}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">Default Role: {roles.find(r => r.id === c.default_role_id)?.display_name || '—'}</div>
                    <div className="mt-3 flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditConnection(c)}
                        className="px-3 py-1.5 text-sm bg-muted border border-border text-foreground rounded-lg hover:bg-accent"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteConnection(c)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 border border-transparent hover:border-red-900/50 rounded-lg"
                        disabled={saving}
                        title="Delete connection"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-muted border-b border-border">
            <h3 className="text-sm font-bold text-foreground uppercase">Domains</h3>
          </div>
          <div className="p-6 grid md:grid-cols-2 gap-8">
            <div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Email Domain</label>
                  <input
                    value={domainForm.domain_name}
                    onChange={(e) => setDomainForm({ ...domainForm, domain_name: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                    placeholder="example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">Connection</label>
                  <select
                    value={domainForm.connection_id || ''}
                    onChange={(e) => setDomainForm({ ...domainForm, connection_id: e.target.value || undefined })}
                    className="w-full px-3 py-2 bg-muted border border-border text-foreground rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {connections.map(c => (
                      <option key={c.id} value={c.id}>{c.provider_label || c.provider_type}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleCreateDomain}
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 disabled:bg-accent disabled:text-muted-foreground font-semibold"
                  >
                    {saving ? 'Saving...' : 'Add Domain'}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <div className="space-y-4">
                {domains.length === 0 && (
                  <div className="p-4 bg-muted border border-border rounded-lg text-muted-foreground">No domains configured</div>
                )}
                {domains.map((d) => (
                  <div key={d.id} className="p-4 bg-muted border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-foreground font-semibold">{d.domain_name}</div>
                        <div className="text-xs text-muted-foreground">{connections.find(c => c.id === d.connection_id)?.provider_label || 'Unassigned'}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {d.is_verified ? (
                          <span className="inline-flex items-center text-green-400 text-sm"><CheckCircle className="h-4 w-4 mr-1" />Verified</span>
                        ) : (
                          <span className="inline-flex items-center text-red-400 text-sm"><XCircle className="h-4 w-4 mr-1" />Unverified</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-end space-x-3">
                      {!d.is_verified && (
                        <button
                          onClick={() => handleVerifyDomain(d)}
                          className="px-3 py-1.5 text-sm bg-primary text-foreground rounded-lg hover:bg-primary/90"
                        >
                          Verify
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteDomain(d)}
                        className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 flex items-center"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-modal-overlay/40 flex items-center justify-center z-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
};

export default SSO;
