import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Mail, UserPlus, X, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { Organization, OrganizationInvitationWithDetails, OrganizationRole } from '../../types/enterprise';
import { invitationService, roleService } from '../../services/enterpriseService';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

export const Invitations: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [invitations, setInvitations] = useState<OrganizationInvitationWithDetails[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [formData, setFormData] = useState({
    emails: '',
    role_id: '',
    message: '',
  });

  useEffect(() => {
    if (selectedOrg) {
      loadData();
    }
  }, [selectedOrg]);

  const loadData = async () => {
    if (!selectedOrg) return;
    
    try {
      setLoading(true);
      const [invitationsData, rolesData] = await Promise.all([
        invitationService.getInvitations(selectedOrg.id),
        roleService.getOrganizationRoles(selectedOrg.id),
      ]);
      setInvitations(invitationsData);
      setRoles(rolesData);
      if (rolesData.length > 0) {
        setFormData(prev => ({ ...prev, role_id: rolesData[0].id }));
      }
    } catch (error) {
      console.error('Failed to load invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvitations = invitations.filter(inv => 
    selectedStatus === 'all' || inv.status === selectedStatus
  );

  const getStatusIcon = (status: string) => {
    const icons: Record<string, JSX.Element> = {
      pending: <Clock className="h-5 w-5 text-yellow-500" />,
      accepted: <CheckCircle className="h-5 w-5 text-green-500" />,
      expired: <XCircle className="h-5 w-5 text-red-500" />,
      cancelled: <XCircle className="h-5 w-5 text-gray-500" />,
    };
    return icons[status] || icons.pending;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      accepted: 'bg-green-100 text-green-700',
      expired: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
    };
    return colors[status] || colors.pending;
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const statusCounts = {
    all: invitations.length,
    pending: invitations.filter(i => i.status === 'pending').length,
    accepted: invitations.filter(i => i.status === 'accepted').length,
    expired: invitations.filter(i => i.status === 'expired').length,
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
          <h1 className="text-3xl font-bold text-gray-900">Invitations</h1>
          <p className="mt-2 text-gray-600">
            Manage user invitations to your organization
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus className="h-5 w-5" />
          <span>Send Invitation</span>
        </button>
      </div>

      {/* Status Tabs */}
      <div className="mb-6 flex items-center space-x-2 border-b border-gray-200">
        {[
          { value: 'all', label: 'All' },
          { value: 'pending', label: 'Pending' },
          { value: 'accepted', label: 'Accepted' },
          { value: 'expired', label: 'Expired' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setSelectedStatus(tab.value)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              selectedStatus === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
              {statusCounts[tab.value as keyof typeof statusCounts]}
            </span>
          </button>
        ))}
      </div>

      {/* Invitations List */}
      {filteredInvitations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {selectedStatus === 'all' ? 'No invitations sent' : `No ${selectedStatus} invitations`}
          </h3>
          <p className="text-gray-600 mb-6">
            {selectedStatus === 'all' 
              ? 'Start inviting team members to join your organization'
              : `There are no ${selectedStatus} invitations at this time`
            }
          </p>
          {selectedStatus === 'all' && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <UserPlus className="h-5 w-5" />
              <span>Send Invitation</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invited By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvitations.map((invitation) => {
                const daysUntilExpiry = getDaysUntilExpiry(invitation.expires_at);
                const isExpiringSoon = daysUntilExpiry <= 3 && daysUntilExpiry > 0;

                return (
                  <tr key={invitation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Mail className="h-5 w-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900">
                          {invitation.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {invitation.role_name || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(invitation.status)}
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(invitation.status)}`}>
                          {invitation.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invitation.invited_by_email || 'System'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {invitation.status === 'pending' ? (
                          <div>
                            <div>{new Date(invitation.expires_at).toLocaleDateString()}</div>
                            {isExpiringSoon && (
                              <div className="text-xs text-orange-600">
                                Expires in {daysUntilExpiry} days
                              </div>
                            )}
                          </div>
                        ) : invitation.accepted_at ? (
                          new Date(invitation.accepted_at).toLocaleDateString()
                        ) : (
                          '—'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {invitation.status === 'pending' && (
                          <>
                            <button className="text-blue-600 hover:text-blue-700" title="Resend">
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button className="text-red-600 hover:text-red-700" title="Cancel">
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {invitation.status === 'expired' && (
                          <button className="text-blue-600 hover:text-blue-700 text-sm">
                            Resend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Send Invitation Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Send Invitations
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Addresses
                </label>
                <textarea
                  value={formData.emails}
                  onChange={(e) => setFormData({ ...formData, emails: e.target.value })}
                  placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter one email address per line
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Role
                </label>
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.display_name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  This role will be assigned when they accept the invitation
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Message (Optional)
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Welcome to the team! Looking forward to working with you."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Invitations will expire in 7 days. Recipients will receive an email with a link to join your organization.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Send Invitations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invitations;
