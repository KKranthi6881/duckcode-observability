import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Building2, AlertTriangle, Save, Trash2, Globe } from 'lucide-react';
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
  }>({
    display_name: '',
    domain: '',
  });

  useEffect(() => {
    if (selectedOrg) {
      setFormData({
        display_name: selectedOrg.display_name,
        domain: selectedOrg.domain || '',
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
