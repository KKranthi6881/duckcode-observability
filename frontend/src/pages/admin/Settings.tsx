import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Building2, AlertTriangle, Save, Trash2, Users, CreditCard, Globe } from 'lucide-react';
import type { Organization } from '../../types/enterprise';
import { organizationService } from '../../services/enterpriseService';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

export const SettingsPage: React.FC = () => {
  const { selectedOrg, refreshOrganizations } = useOutletContext<AdminContext>();
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState<{
    display_name: string;
    domain: string;
    max_users: number;
    plan_type: 'trial' | 'starter' | 'professional' | 'enterprise';
  }>({
    display_name: '',
    domain: '',
    max_users: 10,
    plan_type: 'trial',
  });

  useEffect(() => {
    if (selectedOrg) {
      setFormData({
        display_name: selectedOrg.display_name,
        domain: selectedOrg.domain || '',
        max_users: selectedOrg.max_users,
        plan_type: selectedOrg.plan_type,
      });
    }
  }, [selectedOrg]);

  const handleSave = async () => {
    if (!selectedOrg) return;
    
    try {
      setLoading(true);
      await organizationService.updateOrganization(selectedOrg.id, formData);
      await refreshOrganizations();
      // Show success toast
    } catch (error) {
      console.error('Failed to update organization:', error);
      // Show error toast
    } finally {
      setLoading(false);
    }
  };

  const planFeatures = {
    trial: ['Up to 10 users', '100 API calls/day', 'Community support', '7-day retention'],
    starter: ['Up to 50 users', '10,000 API calls/day', 'Email support', '30-day retention'],
    professional: ['Up to 200 users', 'Unlimited API calls', 'Priority support', '90-day retention', 'SSO enabled'],
    enterprise: ['Unlimited users', 'Unlimited API calls', '24/7 support', 'Custom retention', 'SSO + SAML', 'Custom contracts'],
  };

  return (
    <div className="h-full bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organization Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization's configuration and preferences
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 max-w-4xl">

      {/* General Settings */}
      <div className="bg-card border border-border rounded-lg mb-6">
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-2 mb-4">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">General Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This is the display name shown to all members
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Organization ID
              </label>
              <div className="px-3 py-2 bg-muted border border-border rounded-lg">
                <code className="text-sm text-muted-foreground">{selectedOrg?.name}</code>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Read-only identifier for API integrations
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Email Domain
              </label>
              <div className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="example.com"
                  className="flex-1 px-3 py-2 bg-muted border border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Auto-verify users with this email domain
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 font-semibold"
          >
            <Save className="h-4 w-4" />
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Plan & Billing */}
      <div className="bg-card border border-border rounded-lg mb-6">
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-2 mb-4">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Plan & Billing</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-600/10 border border-blue-600/20 rounded-lg">
              <div>
                <p className="font-bold text-blue-300 capitalize">
                  {selectedOrg?.plan_type} Plan
                </p>
                <p className="text-sm text-blue-400/80 mt-1">
                  Status: <span className="font-semibold capitalize">{selectedOrg?.status}</span>
                </p>
              </div>
              <button className="px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-primary/90 font-semibold">
                Upgrade Plan
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Plan Features
              </label>
              <div className="space-y-2">
                {planFeatures[selectedOrg?.plan_type || 'trial'].map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm text-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                User Limit
              </label>
              <div className="flex items-center space-x-4">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <input
                    type="number"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                    min="1"
                    className="w-32 px-3 py-2 bg-muted border border-border text-foreground rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Maximum number of users allowed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card border-2 border-red-600/30 rounded-lg">
        <div className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <h2 className="text-lg font-bold text-red-400">Danger Zone</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-red-600/20 bg-red-600/5 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Delete Organization</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Permanently delete this organization and all associated data. This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-600 text-foreground rounded-lg hover:bg-red-700 font-semibold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-modal-overlay/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-600/20 border border-red-600/30 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Delete Organization
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-foreground mb-4">
                Are you absolutely sure you want to delete <strong className="text-red-400">{selectedOrg?.display_name}</strong>?
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 mb-4">
                <li>• All organization data</li>
                <li>• All team configurations</li>
                <li>• All API keys</li>
                <li>• All member access</li>
                <li>• All metadata and lineage</li>
              </ul>
              
              <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3">
                <p className="text-sm text-red-400 font-semibold">
                  ⚠️ This action is irreversible and cannot be undone!
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  Type <code className="bg-muted px-1 py-0.5 rounded text-primary">{selectedOrg?.name}</code> to confirm
                </label>
                <input
                  type="text"
                  placeholder={selectedOrg?.name}
                  className="w-full px-3 py-2 bg-muted border border-border text-foreground placeholder-muted-foreground rounded-lg focus:ring-2 focus:ring-red-500/50 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-foreground bg-muted border border-border rounded-lg hover:bg-accent font-medium"
              >
                Cancel
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-foreground rounded-lg hover:bg-red-700 font-semibold">
                <Trash2 className="h-4 w-4" />
                <span>Delete Organization</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default SettingsPage;
