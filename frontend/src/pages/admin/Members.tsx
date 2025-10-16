import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, UserPlus, X, RefreshCw, Clock, CheckCircle, XCircle, Edit2, Trash2, Shield } from 'lucide-react';
import type { Organization, OrganizationInvitationWithDetails, OrganizationRole } from '../../types/enterprise';
import { invitationService, roleService } from '../../services/enterpriseService';
import { supabase } from '../../config/supabaseClient';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

interface Member {
  id: string;
  email: string;
  role_id: string;
  role_name: string;
  status: 'active' | 'inactive';
  joined_at: string;
  last_active?: string;
}

export const Members: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitationWithDetails[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedView, setSelectedView] = useState<string>('active');
  const [formData, setFormData] = useState({
    emails: '',
    role_id: '',
    message: '',
  });

  const loadData = useCallback(async () => {
    if (!selectedOrg) {
      console.error('No organization selected!');
      return;
    }
    
    try {
      setLoading(true);
      
      // Load roles
      const rolesData = await roleService.getOrganizationRoles(selectedOrg.id);
      setRoles(rolesData);
      
      // Set default role
      if (rolesData.length > 0) {
        const memberRole = rolesData.find(r => r.name === 'Member');
        const defaultRole = memberRole || rolesData[0];
        setFormData(prev => ({ ...prev, role_id: defaultRole.id }));
      }
      
      // Load existing members using the RPC function
      const { data: membersData, error: membersError } = await supabase
        .schema('enterprise')
        .rpc('get_organization_members', { 
          p_organization_id: selectedOrg.id 
        });

      if (membersError) {
        console.error('❌ Failed to load members:', membersError);
      } else {
        console.log('📊 Raw members data from RPC:', membersData);
        // Get role IDs by matching role names
        const formattedMembers: Member[] = (membersData || []).map((m: {
          user_id: string;
          user_email: string;
          role_name: string;
          assigned_at: string;
        }) => {
          const role = rolesData.find(r => r.display_name === m.role_name || r.name === m.role_name);
          return {
            id: m.user_id,
            email: m.user_email,
            role_id: role?.id || '',
            role_name: m.role_name,
            status: 'active' as const,
            joined_at: m.assigned_at,
          };
        });
        console.log('👥 Formatted members:', formattedMembers);
        console.log('📈 Members count:', formattedMembers.length);
        setMembers(formattedMembers);
      }
      
      // Load pending invitations
      const invitationsData = await invitationService.getInvitations(selectedOrg.id);
      setInvitations(invitationsData);
      
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => {
    if (selectedOrg) {
      loadData();
    }
  }, [selectedOrg, loadData]);

  const handleAddMember = async () => {
    if (!selectedOrg) return;

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

      setFormData({
        emails: '',
        role_id: roles.length > 0 ? roles[0].id : '',
        message: '',
      });

      setShowAddModal(false);
      await loadData();
      alert(`Successfully invited ${emailList.length} member(s)!`);
    } catch (error) {
      console.error('Failed to add members:', error);
      alert('Failed to send invitations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRoleId: string) => {
    try {
      setLoading(true);
      
      // First, delete the old role assignment
      const { error: deleteError } = await supabase
        .schema('enterprise')
        .from('user_organization_roles')
        .delete()
        .eq('user_id', memberId)
        .eq('organization_id', selectedOrg.id);

      if (deleteError) throw deleteError;

      // Then, insert the new role assignment
      const { error: insertError } = await supabase
        .schema('enterprise')
        .from('user_organization_roles')
        .insert({
          user_id: memberId,
          organization_id: selectedOrg.id,
          role_id: newRoleId,
        });

      if (insertError) throw insertError;

      await loadData();
      alert('Member role updated successfully');
      setShowEditModal(false);
    } catch (error) {
      console.error('Failed to update member role:', error);
      alert('Failed to update member role');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) {
      return;
    }

    try {
      setLoading(true);
      
      // Remove from user_organization_roles
      const { error } = await supabase
        .schema('enterprise')
        .from('user_organization_roles')
        .delete()
        .eq('user_id', memberId)
        .eq('organization_id', selectedOrg.id);

      if (error) throw error;

      await loadData();
      alert('Member removed successfully');
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .schema('enterprise')
        .from('organization_invitations')
        .update({ status: 'cancelled' })
        .eq('id', invitationId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Failed to cancel invitation:', error);
      alert('Failed to cancel invitation');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, JSX.Element> = {
      active: <CheckCircle className="h-5 w-5 text-green-500" />,
      pending: <Clock className="h-5 w-5 text-yellow-500" />,
      accepted: <CheckCircle className="h-5 w-5 text-green-500" />,
      expired: <XCircle className="h-5 w-5 text-red-500" />,
      cancelled: <XCircle className="h-5 w-5 text-gray-500" />,
    };
    return icons[status] || icons.pending;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      accepted: 'bg-green-100 text-green-700',
      expired: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
    };
    return colors[status] || colors.pending;
  };

  const viewCounts = {
    active: members.filter(m => m.status === 'active').length,
    pending: invitations.filter(i => i.status === 'pending').length,
    all: members.length + invitations.length,
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
          <h1 className="text-3xl font-bold text-gray-900">Members</h1>
          <p className="mt-2 text-gray-600">
            Manage organization members and invitations
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus className="h-5 w-5" />
          <span>Add Member</span>
        </button>
      </div>

      {/* View Tabs */}
      <div className="mb-6 flex items-center space-x-2 border-b border-gray-200">
        {[
          { value: 'active', label: 'Active Members' },
          { value: 'pending', label: 'Pending Invitations' },
          { value: 'all', label: 'All' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setSelectedView(tab.value)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              selectedView === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
              {viewCounts[tab.value as keyof typeof viewCounts]}
            </span>
          </button>
        ))}
      </div>

      {/* Members and Invitations List */}
      {(selectedView === 'active' || selectedView === 'all') && members.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase">Active Members</h3>
          </div>
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
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-sm font-medium text-gray-900">
                        {member.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {member.role_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(member.status)}
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full capitalize ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setShowEditModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700"
                        title="Edit Role"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-red-600 hover:text-red-700"
                        title="Remove Member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending Invitations */}
      {(selectedView === 'pending' || selectedView === 'all') && invitations.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 uppercase">Pending Invitations</h3>
          </div>
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
              {invitations.filter(i => selectedView === 'all' || i.status === 'pending').map((invitation) => (
                <tr key={invitation.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-gray-400 mr-3" />
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(invitation.expires_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {invitation.status === 'pending' && (
                        <>
                          <button className="text-blue-600 hover:text-blue-700" title="Resend">
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {members.length === 0 && invitations.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No members yet
          </h3>
          <p className="text-gray-600 mb-6">
            Start building your team by adding members to your organization
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <UserPlus className="h-5 w-5" />
            <span>Add Member</span>
          </button>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add New Member
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
                    {roles.map(role => {
                    const isSelected = formData.role_id === role.id;
                    const roleDescriptions: Record<string, string> = {
                      'Admin': 'Full administrative access and control',
                      'Member': 'Can work with data and run operations',
                    };
                    const roleIcons: Record<string, string> = {
                      'Admin': '👑',
                      'Member': '🔧',
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
                              {roleDescriptions[role.name] || 'Team member'}
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
                  Welcome Message (Optional)
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
                  <strong>Note:</strong> Members will receive an email invitation with a link to join your organization. Invitations expire in 7 days.
                </p>
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
                onClick={handleAddMember}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Role Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Update Member Role
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                Change role for <strong>{selectedMember.email}</strong>
              </p>
              
              <div className="space-y-2">
                {roles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => handleUpdateMemberRole(selectedMember.id, role.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      role.id === selectedMember.role_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-semibold">{role.display_name}</div>
                    <div className="text-xs text-gray-600">
                      {role.id === selectedMember.role_id && '(Current Role)'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
