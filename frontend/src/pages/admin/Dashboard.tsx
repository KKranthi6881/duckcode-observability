import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { TrendingUp, ExternalLink } from 'lucide-react';
import type { Organization, OrganizationWithStats } from '../../types/enterprise';
import { organizationService } from '../../services/enterpriseService';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

export const Dashboard: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [stats, setStats] = useState<OrganizationWithStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedOrg) {
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg]);

  const loadStats = async () => {
    if (!selectedOrg) return;
    
    try {
      setLoading(true);
      const data = await organizationService.getOrganizationWithStats(selectedOrg.id);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  const orgName = stats?.display_name || selectedOrg?.display_name || selectedOrg?.name;

  return (
    <div className="h-full bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
            <p className="text-sm text-muted-foreground">
              Organization: {orgName}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open Member Dashboard
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 space-y-6 max-w-6xl mx-auto">
        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div className="bg-card border-2 border-muted rounded-xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Members</span>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.member_count ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">Total users in this organization</div>
          </div>

          <div className="bg-card border-2 border-muted rounded-xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Teams</span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.team_count ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">Active teams / projects</div>
          </div>

          <div className="bg-card border-2 border-muted rounded-xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">API Keys</span>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-3xl font-bold text-foreground">{stats?.api_key_count ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-1">Organization-level API keys</div>
          </div>

          <div className="bg-card border-2 border-muted rounded-xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Plan</span>
            </div>
            <div className="text-lg font-semibold text-foreground">
              {selectedOrg.plan_type.toUpperCase()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Status: {selectedOrg.status}
            </div>
          </div>
        </div>

        {/* Org Details & Admin Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Organization Details */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-foreground">Organization details</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Key information about this organization.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="text-foreground font-medium">{selectedOrg.display_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="text-foreground font-medium">{selectedOrg.plan_type}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-foreground font-medium">{selectedOrg.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Max users</dt>
                <dd className="text-foreground font-medium">{selectedOrg.max_users}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Domain</dt>
                <dd className="text-foreground font-medium">{selectedOrg.domain || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-foreground font-medium">
                  {new Date(selectedOrg.created_at).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {/* Admin Areas */}
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">Admin areas</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Quick links to the key administration sections.
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <Link
                to="/admin/members"
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                <div>
                  <div className="font-medium text-foreground">Members</div>
                  <div className="text-xs text-muted-foreground">Invite and manage users for this organization.</div>
                </div>
                <span className="text-xs text-muted-foreground">Manage →</span>
              </Link>

              <Link
                to="/admin/connectors"
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                <div>
                  <div className="font-medium text-foreground">Connectors</div>
                  <div className="text-xs text-muted-foreground">Configure Snowflake and other data sources.</div>
                </div>
                <span className="text-xs text-muted-foreground">Open →</span>
              </Link>

              <Link
                to="/admin/api-keys"
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                <div>
                  <div className="font-medium text-foreground">API Keys</div>
                  <div className="text-xs text-muted-foreground">Manage organization-level API access.</div>
                </div>
                <span className="text-xs text-muted-foreground">Configure →</span>
              </Link>

              <Link
                to="/admin/sso"
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                <div>
                  <div className="font-medium text-foreground">SSO</div>
                  <div className="text-xs text-muted-foreground">Connect your identity provider (SAML, OIDC).</div>
                </div>
                <span className="text-xs text-muted-foreground">Configure →</span>
              </Link>

              <Link
                to="/admin/settings"
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                <div>
                  <div className="font-medium text-foreground">Settings</div>
                  <div className="text-xs text-muted-foreground">Plan, billing, and organization settings.</div>
                </div>
                <span className="text-xs text-muted-foreground">Open →</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
;

export default Dashboard;
