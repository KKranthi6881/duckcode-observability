import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowLeft, Plug2 } from 'lucide-react';
import { SiGithub, SiSnowflake } from 'react-icons/si';
import ConnectorsPage from '../dashboard/ConnectorsPage';
import { MetadataExtraction } from './MetadataExtraction';
import { connectorsService } from '../../services/connectorsService';
import type { Organization } from '../../types/enterprise';

// Import icons
const GitHubIcon = ({ className }: { className?: string }) => (
  <SiGithub className={className} />
);

const SnowflakeIcon = ({ className }: { className?: string }) => (
  <SiSnowflake className={className} />
);

const AirflowIcon = ({ className }: { className?: string }) => (
  <img
    src="/connectors/service-icon-airflow.png"
    alt="Apache Airflow logo"
    className={`object-contain ${className ?? ''}`}
  />
);

const TableauIcon = ({ className }: { className?: string }) => (
  <img
    src="/connectors/service-icon-tableau.png"
    alt="Tableau logo"
    className={`object-contain ${className ?? ''}`}
  />
);

const PowerBIIcon = ({ className }: { className?: string }) => (
  <img
    src="/connectors/service-icon-power-bi.png"
    alt="Power BI logo"
    className={`object-contain ${className ?? ''}`}
  />
);

interface AdminContext {
  selectedOrg: Organization | null;
}

interface ConnectorConfigPageProps {
  onBack: () => void;
}

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  gradient: string;
  stats?: {
    connections?: number;
    objects?: number;
  };
}

const CONNECTORS: Connector[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Extract metadata from GitHub repositories - tables, views, and columns',
    icon: GitHubIcon,
    iconColor: 'text-purple-400',
    gradient: 'from-purple-600 to-purple-700',
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    description: 'Connect to Snowflake data warehouse for cost intelligence and optimization',
    icon: SnowflakeIcon,
    iconColor: 'text-blue-400',
    gradient: 'from-blue-600 to-blue-700',
  },
  {
    id: 'airflow',
    name: 'Apache Airflow',
    description: 'Orchestrate and monitor your data pipelines using Airflow DAGs.',
    icon: AirflowIcon,
    iconColor: 'text-sky-400',
    gradient: 'from-sky-500 to-sky-600',
  },
  {
    id: 'tableau',
    name: 'Tableau',
    description: 'Power rich BI dashboards with governed, trusted datasets.',
    icon: TableauIcon,
    iconColor: 'text-indigo-400',
    gradient: 'from-indigo-500 to-indigo-600',
  },
  {
    id: 'power-bi',
    name: 'Power BI',
    description: 'Deliver self-service analytics to business users using Power BI.',
    icon: PowerBIIcon,
    iconColor: 'text-yellow-400',
    gradient: 'from-yellow-500 to-amber-500',
  },
];

const VISIBLE_CONNECTORS: Connector[] = CONNECTORS.filter(
  (connector) => !['airflow', 'tableau', 'power-bi'].includes(connector.id)
);

function AirflowConnectorConfig({ onBack }: ConnectorConfigPageProps) {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [name, setName] = useState('Apache Airflow - Production');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedOrg) {
      setError('No organization selected.');
      return;
    }
    if (!name.trim() || !baseUrl.trim()) {
      setError('Name and Base URL are required.');
      return;
    }
    if (!apiToken.trim() && (!username.trim() || !password)) {
      setError('Provide either an API token or username and password.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const config: Record<string, unknown> = {
        base_url: baseUrl.trim(),
      };

      if (apiToken.trim()) {
        config.api_token = apiToken.trim();
      } else {
        config.username = username.trim();
        config.password = password;
      }

      await connectorsService.createConnector({
        organizationId: selectedOrg.id,
        name: name.trim(),
        type: 'airflow',
        config,
      });

      setSuccess('Airflow connector configuration saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save connector');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Connectors
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/10 rounded-lg">
            <AirflowIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Apache Airflow Connector</h1>
            <p className="text-sm text-muted-foreground">Pipeline orchestration and monitoring</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-2xl bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Connector name</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Airflow - Production"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Airflow base URL</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://airflow.my-company.com"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Username</label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="airflow_admin"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">API token (optional)</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Use instead of username/password when available"
            />
            <p className="text-xs text-muted-foreground">
              If an API token is provided, it will be used instead of username and password.
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground text-[11px] tracking-wide uppercase">Snowflake lineage hints</div>
            <p>
              To link Airflow DAGs to Snowflake tables in the lineage graph, add tags of the form
              <span className="font-mono bg-background px-1 py-0.5 rounded border border-border mx-1">sf:DB.SCHEMA.TABLE</span>
              to your DAGs.
            </p>
            <p>
              Example tag:
              <span className="font-mono bg-background px-1 py-0.5 rounded border border-border ml-1">sf:ANALYTICS.PUBLIC.CUSTOMERS</span>
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onBack}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TableauConnectorConfig({ onBack }: ConnectorConfigPageProps) {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [name, setName] = useState('Tableau - Production');
  const [serverUrl, setServerUrl] = useState('');
  const [siteName, setSiteName] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSecret, setTokenSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedOrg) {
      setError('No organization selected.');
      return;
    }
    if (!name.trim() || !serverUrl.trim() || !tokenName.trim() || !tokenSecret) {
      setError('Name, server URL, token name, and token secret are required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const config: Record<string, unknown> = {
        server_url: serverUrl.trim(),
        token_name: tokenName.trim(),
        token_secret: tokenSecret,
      };

      if (siteName.trim()) {
        config.site_name = siteName.trim();
      }

      await connectorsService.createConnector({
        organizationId: selectedOrg.id,
        name: name.trim(),
        type: 'tableau',
        config,
      });

      setSuccess('Tableau connector configuration saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save connector');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Connectors
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <TableauIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tableau Connector</h1>
            <p className="text-sm text-muted-foreground">Business intelligence dashboards</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-2xl bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Connector name</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tableau - Executive Dashboards"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Server URL</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://tableau.my-company.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Site name (optional)</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Default"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Token name</label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="tableau-pat-name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Token secret</label>
              <input
                type="password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                value={tokenSecret}
                onChange={(e) => setTokenSecret(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onBack}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PowerBIConnectorConfig({ onBack }: ConnectorConfigPageProps) {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [name, setName] = useState('Power BI - Production');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async () => {
    if (!selectedOrg) {
      setError('No organization selected.');
      return;
    }
    if (!name.trim() || !tenantId.trim() || !clientId.trim() || !clientSecret) {
      setError('Name, tenant ID, client ID, and client secret are required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const config: Record<string, unknown> = {
        tenant_id: tenantId.trim(),
        client_id: clientId.trim(),
        client_secret: clientSecret,
      };

      if (workspaceId.trim()) {
        config.workspace_id = workspaceId.trim();
      }

      await connectorsService.createConnector({
        organizationId: selectedOrg.id,
        name: name.trim(),
        type: 'power_bi',
        config,
      });

      setSuccess('Power BI connector configuration saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save connector');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Connectors
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <PowerBIIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Power BI Connector</h1>
            <p className="text-sm text-muted-foreground">Self-service analytics for business users</p>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        <div className="max-w-2xl bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Connector name</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Power BI - Finance Workspace"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Tenant ID</label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Client ID</label>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Client secret</label>
            <input
              type="password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Workspace ID (optional)</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground text-[11px] tracking-wide uppercase">Snowflake lineage hints</div>
            <p>
              To connect Power BI datasets to Snowflake tables in lineage, include markers like
              <span className="font-mono bg-background px-1 py-0.5 rounded border border-border mx-1">sf:DB.SCHEMA.TABLE</span>
              in the dataset name or workspace description.
            </p>
            <p>
              Example dataset name:
              <span className="font-mono bg-background px-1 py-0.5 rounded border border-border ml-1">Sales Model (sf:ANALYTICS.PUBLIC.ORDERS)</span>
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onBack}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : 'Save configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectorsHub() {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);

  // Render individual connector page
  if (selectedConnector === 'github') {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card px-6 py-4">
          <button
            onClick={() => setSelectedConnector(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Connectors
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/10 rounded-lg">
              <GitHubIcon className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">GitHub Connector</h1>
              <p className="text-sm text-muted-foreground">Extract metadata from repositories</p>
            </div>
          </div>
        </div>
        <MetadataExtraction />
      </div>
    );
  }

  if (selectedConnector === 'snowflake') {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card px-6 py-4">
          <button
            onClick={() => setSelectedConnector(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Connectors
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 rounded-lg">
              <SnowflakeIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Snowflake Connector</h1>
              <p className="text-sm text-muted-foreground">Cost intelligence and optimization</p>
            </div>
          </div>
        </div>
        <ConnectorsPage />
      </div>
    );
  }

  if (selectedConnector === 'airflow') {
    return <AirflowConnectorConfig onBack={() => setSelectedConnector(null)} />;
  }

  if (selectedConnector === 'tableau') {
    return <TableauConnectorConfig onBack={() => setSelectedConnector(null)} />;
  }

  if (selectedConnector === 'power-bi') {
    return <PowerBIConnectorConfig onBack={() => setSelectedConnector(null)} />;
  }

  // Main hub view
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Plug2 className="w-8 h-8 text-primary" />
              Connectors Hub
            </h1>
            <p className="text-muted-foreground mt-1">Manage all your data source connections in one place</p>
          </div>
        </div>

        {/* Connectors Grid */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Available Connectors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {VISIBLE_CONNECTORS.map((connector) => {
              const Icon = connector.icon;
              return (
                <button
                  key={connector.id}
                  onClick={() => setSelectedConnector(connector.id)}
                  className="group bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all duration-200 text-left"
                >
                  <div className="relative">
                    {/* Icon and Title */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <Icon className={`w-7 h-7 ${connector.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                          {connector.name}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {connector.description}
                        </p>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Click to configure
                      </span>
                      <div className="flex items-center gap-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-sm font-medium">Open</span>
                        <ArrowLeft className="w-4 h-4 rotate-180" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-foreground mb-3">About Connectors</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Connectors</span> allow you to integrate external data sources
              with your platform. Each connector provides specialized functionality:
            </p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong className="text-foreground">GitHub:</strong> Extract database schemas, tables, views, and column metadata from dbt projects</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span><strong className="text-foreground">Snowflake:</strong> Analyze costs, monitor usage, and optimize your Snowflake data warehouse</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
