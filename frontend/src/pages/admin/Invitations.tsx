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
    if (!selectedOrg) {
      console.error('No organization selected!');
      return;
    }
    
    console.log('Loading data for organization:', selectedOrg);
    
    try {
      setLoading(true);
      
      // Load roles and invitations independently (don't let invitations error break roles)
      let rolesData: OrganizationRole[] = [];
      let invitationsData: OrganizationInvitationWithDetails[] = [];
      
      // Load roles first (critical for Send Invitation button)
      try {
        rolesData = await roleService.getOrganizationRoles(selectedOrg.id);
        console.log('✅ Loaded roles:', rolesData);
        console.log('Role count:', rolesData.length);
        
        if (rolesData.length === 0) {
          console.error('⚠️ No roles found for organization:', selectedOrg.id);
          console.error('Organization name:', selectedOrg.name);
        }
      } catch (rolesError) {
        console.error('Failed to load roles:', rolesError);
      }
      
      // Load invitations (non-critical, can fail gracefully)
      try {
        invitationsData = await invitationService.getInvitations(selectedOrg.id);
      } catch (invError) {
        console.error('❌ Failed to load invitations:', invError);
        // Don't fail the whole page if invitations don't load
      }
      
      setInvitations(invitationsData);
      setRoles(rolesData);
      
      // Set default role to first available role
      if (rolesData.length > 0) {
        // Try to default to Member, then Viewer, then first role
        const memberRole = rolesData.find(r => r.name === 'Member');
        const viewerRole = rolesData.find(r => r.name === 'Viewer');
        const defaultRole = memberRole || viewerRole || rolesData[0];
        console.log('Setting default role to:', defaultRole.name);
        setFormData(prev => ({ ...prev, role_id: defaultRole.id }));
      }
    } catch (error) {
      console.error('❌ Failed to load invitations:', error);
      alert('Error loading roles: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitations = async () => {
    if (!selectedOrg) return;

    // Parse emails (one per line, comma-separated, or space-separated)
    const emailList = formData.emails
      .split(/[\n,\s]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emailList.length === 0) {
      alert('Please enter at least one email address');
      return;
    }

    if (!formData.role_id) {
      alert('Please select a role');
      return;
    }

    try {
      setLoading(true);
      await invitationService.inviteUser({
        organization_id: selectedOrg.id,
        emails: emailList,
        role_id: formData.role_id,
        message: formData.message || undefined,
      });

      // Reset form
      setFormData({
        emails: '',
        role_id: roles.length > 0 ? roles[0].id : '',
        message: '',
      });

      // Close modal
      setShowInviteModal(false);

      // Reload invitations
      await loadData();

      alert(`Successfully sent ${emailList.length} invitation(s)!`);
    } catch (error) {
      console.error('Failed to send invitations:', error);
      alert('Failed to send invitations. Please try again.');
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
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Assign Role
                </label>
                {roles.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      No roles found. Please refresh the page or contact support.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {roles.sort((a, b) => {
                      // Sort: Viewer, Member, Admin
                      const order = { 'Viewer': 1, 'Member': 2, 'Admin': 3 };
                      return (order[a.name as keyof typeof order] || 99) - (order[b.name as keyof typeof order] || 99);
                    }).map(role => {
                    const isSelected = formData.role_id === role.id;
                    const roleDescriptions: Record<string, string> = {
                      'Viewer': 'Can view data and analytics (read-only access)',
                      'Member': 'Can work with data and run operations',
                      'Admin': 'Full administrative access and control',
                    };
                    const roleIcons: Record<string, string> = {
                      'Viewer': '👁️',
                      'Member': '🔧',
                      'Admin': '👑',
                    };
                    
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, role_id: role.id })}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mr-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{roleIcons[role.name]}</span>
                              <span className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                {role.display_name}
                              </span>
                            </div>
                            <p className={`text-sm mt-1 ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                              {roleDescriptions[role.name] || 'Custom role'}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
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
              <button
                onClick={handleSendInvitations}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Invitations'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invitations;
