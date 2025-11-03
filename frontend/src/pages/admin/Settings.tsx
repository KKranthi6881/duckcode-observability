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
    <div className="h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Organization Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your organization's configuration and preferences
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8 max-w-4xl">

      {/* General Settings */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <Building2 className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">General Information</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                This is the display name shown to all members
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organization ID
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                <code className="text-sm text-gray-600">{selectedOrg?.name}</code>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Read-only identifier for API integrations
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Domain
              </label>
              <div className="flex items-center space-x-2">
                <Globe className="h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                  placeholder="example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Auto-verify users with this email domain
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {/* Plan & Billing */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <CreditCard className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Plan & Billing</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <p className="font-medium text-blue-900 capitalize">
                  {selectedOrg?.plan_type} Plan
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Status: <span className="font-medium capitalize">{selectedOrg?.status}</span>
                </p>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Upgrade Plan
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Plan Features
              </label>
              <div className="space-y-2">
                {planFeatures[selectedOrg?.plan_type || 'trial'].map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 text-sm text-gray-700">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Limit
              </label>
              <div className="flex items-center space-x-4">
                <Users className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                  <input
                    type="number"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                    min="1"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum number of users allowed
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow border-2 border-red-200">
        <div className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Delete Organization</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Permanently delete this organization and all associated data. This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Organization
              </h3>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                Are you absolutely sure you want to delete <strong>{selectedOrg?.display_name}</strong>?
              </p>
              <p className="text-sm text-gray-600 mb-4">
                This will permanently delete:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                <li>• All organization data</li>
                <li>• All team configurations</li>
                <li>• All API keys</li>
                <li>• All member access</li>
                <li>• All metadata and lineage</li>
              </ul>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ This action is irreversible and cannot be undone!
                </p>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <code className="bg-gray-100 px-1 py-0.5 rounded">{selectedOrg?.name}</code> to confirm
                </label>
                <input
                  type="text"
                  placeholder={selectedOrg?.name}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
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
