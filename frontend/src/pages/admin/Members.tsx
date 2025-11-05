import { useState, useEffect, useCallback } from 'react';
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
      console.log('🔄 Updating role for member:', memberId, 'to role:', newRoleId);
      
      // Update the role_id directly (now safe with one-role-per-user constraint)
      const { data, error } = await supabase
        .schema('enterprise')
        .from('user_organization_roles')
        .update({ role_id: newRoleId })
        .eq('user_id', memberId)
        .eq('organization_id', selectedOrg.id)
        .select();

      console.log('✅ Update result:', { data, error });
      if (error) {
        console.error('❌ Update error:', error);
        throw new Error(`Failed to update role: ${error.message}`);
      }

      await loadData();
      alert('Member role updated successfully');
      setShowEditModal(false);
    } catch (error: unknown) {
      const err = error as Error;
      console.error('❌ Failed to update member role:', err);
      alert(`Failed to update member role: ${err.message || 'Unknown error'}`);
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
      console.log('🗑️ Deleting member:', memberId, 'from org:', selectedOrg.id);
      
      // Remove from user_organization_roles
      const { data, error } = await supabase
        .schema('enterprise')
        .from('user_organization_roles')
        .delete()
        .eq('user_id', memberId)
        .eq('organization_id', selectedOrg.id);

      console.log('🗑️ Delete result:', { data, error });
      if (error) {
        console.error('❌ Delete error:', error);
        throw new Error(`Failed to delete member: ${error.message}`);
      }

      await loadData();
      alert('Member removed successfully');
    } catch (error: unknown) {
      const err = error as Error;
      console.error('❌ Failed to remove member:', err);
      alert(`Failed to remove member: ${err.message || 'Unknown error'}`);
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
      active: <CheckCircle className="h-5 w-5 text-green-400" />,
      pending: <Clock className="h-5 w-5 text-yellow-400" />,
      accepted: <CheckCircle className="h-5 w-5 text-green-400" />,
      expired: <XCircle className="h-5 w-5 text-red-400" />,
      cancelled: <XCircle className="h-5 w-5 text-[#8d857b]" />,
    };
    return icons[status] || icons.pending;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-600/20 border border-green-600/30 text-green-400',
      pending: 'bg-yellow-600/20 border border-yellow-600/30 text-yellow-400',
      accepted: 'bg-green-600/20 border border-green-600/30 text-green-400',
      expired: 'bg-red-600/20 border border-red-600/30 text-red-400',
      cancelled: 'bg-[#2d2a27] border border-[#2d2a27] text-[#8d857b]',
    };
    return colors[status] || colors.pending;
  };

  const viewCounts = {
    active: members.filter(m => m.status === 'active').length,
    pending: invitations.filter(i => i.status === 'pending').length,
    all: members.length + invitations.filter(i => i.status === 'pending' || i.status === 'expired').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0d0c0c]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6a3c]"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0d0c0c]">
      {/* Header */}
      <div className="bg-[#161413] border-b border-[#2d2a27] px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Team Members</h1>
            <p className="text-sm text-[#8d857b] mt-1">
              Manage organization members and invitations
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#ff8c66] transition-colors font-semibold text-sm"
          >
            <UserPlus className="h-4 w-4" />
            Invite Members
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-8">

      {/* View Tabs */}
      <div className="mb-6 flex items-center space-x-2 border-b border-[#2d2a27]">
        {[
          { value: 'active', label: 'Active Members' },
          { value: 'pending', label: 'Pending Invitations' },
          { value: 'all', label: 'All' },
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => setSelectedView(tab.value)}
            className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${
              selectedView === tab.value
                ? 'border-[#ff6a3c] text-[#ff6a3c]'
                : 'border-transparent text-[#8d857b] hover:text-white'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[#2d2a27] text-white">
              {viewCounts[tab.value as keyof typeof viewCounts]}
            </span>
          </button>
        ))}
      </div>

      {/* Members and Invitations List */}
      {(selectedView === 'active' || selectedView === 'all') && members.length > 0 && (
        <div className="bg-[#161413] border border-[#2d2a27] rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-4 bg-[#1f1d1b] border-b border-[#2d2a27]">
            <h3 className="text-sm font-bold text-white uppercase">Active Members</h3>
          </div>
          <table className="min-w-full divide-y divide-[#2d2a27]">
            <thead className="bg-[#1f1d1b]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#161413] divide-y divide-[#2d2a27]">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-[#1f1d1b]">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-[#8d857b] mr-3" />
                      <span className="text-sm font-semibold text-white">
                        {member.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-[#8d857b]" />
                      <span className="text-sm text-white">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#8d857b]">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => {
                          setSelectedMember(member);
                          setShowEditModal(true);
                        }}
                        className="text-blue-400 hover:text-blue-300"
                        title="Edit Role"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member.id)}
                        className="text-red-400 hover:text-red-300"
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
      {(selectedView === 'pending' || selectedView === 'all') && 
       invitations.filter(i => i.status === 'pending' || i.status === 'expired').length > 0 && (
        <div className="bg-[#161413] border border-[#2d2a27] rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-[#1f1d1b] border-b border-[#2d2a27]">
            <h3 className="text-sm font-bold text-white uppercase">Pending Invitations</h3>
          </div>
          <table className="min-w-full divide-y divide-[#2d2a27]">
            <thead className="bg-[#1f1d1b]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Invited By
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-[#8d857b] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#161413] divide-y divide-[#2d2a27]">
              {invitations.filter(i => {
                // Only show truly pending invitations (not accepted/cancelled)
                const isPending = i.status === 'pending' || i.status === 'expired';
                return selectedView === 'all' ? isPending : i.status === 'pending';
              }).map((invitation) => (
                <tr key={invitation.id} className="hover:bg-[#1f1d1b]">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-[#8d857b] mr-3" />
                      <span className="text-sm font-semibold text-white">
                        {invitation.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-white">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#8d857b]">
                    {invitation.invited_by_email || 'System'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {new Date(invitation.expires_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {invitation.status === 'pending' && (
                        <>
                          <button className="text-blue-400 hover:text-blue-300" title="Resend">
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="text-red-400 hover:text-red-300"
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
        <div className="bg-[#161413] border border-[#2d2a27] rounded-lg p-12 text-center">
          <Users className="h-16 w-16 text-[#8d857b] mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">
            No members yet
          </h3>
          <p className="text-[#8d857b] mb-6">
            Start building your team by adding members to your organization
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#ff8c66] font-semibold"
          >
            <UserPlus className="h-5 w-5" />
            <span>Add Member</span>
          </button>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#161413] border border-[#2d2a27] rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              Add New Member
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">
                  Email Addresses
                </label>
                <textarea
                  value={formData.emails}
                  onChange={(e) => setFormData({ ...formData, emails: e.target.value })}
                  placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com"
                  rows={5}
                  className="w-full px-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white placeholder-[#8d857b] rounded-lg focus:ring-2 focus:ring-[#ff6a3c]/50 focus:border-transparent font-mono text-sm"
                />
                <p className="mt-1 text-xs text-[#8d857b]">
                  Enter one email address per line
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-3">
                  Assign Role
                </label>
                {roles.length === 0 ? (
                  <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-4">
                    <p className="text-sm text-yellow-400">
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
                            ? 'border-[#ff6a3c] bg-[#ff6a3c]/10'
                            : 'border-[#2d2a27] hover:border-[#ff6a3c]/50 hover:bg-[#1f1d1b]'
                        }`}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mr-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected
                                ? 'border-[#ff6a3c] bg-[#ff6a3c]'
                                : 'border-[#2d2a27]'
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
                              <span className={`font-bold ${isSelected ? 'text-white' : 'text-white'}`}>
                                {role.display_name}
                              </span>
                            </div>
                            <p className={`text-sm mt-1 ${isSelected ? 'text-[#ff6a3c]/80' : 'text-[#8d857b]'}`}>
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
                <label className="block text-sm font-semibold text-white mb-2">
                  Welcome Message (Optional)
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Welcome to the team! Looking forward to working with you."
                  rows={3}
                  className="w-full px-3 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white placeholder-[#8d857b] rounded-lg focus:ring-2 focus:ring-[#ff6a3c]/50 focus:border-transparent"
                />
              </div>

              <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
                <p className="text-sm text-blue-400">
                  <strong>Note:</strong> Members will receive an email invitation with a link to join your organization. Invitations expire in 7 days.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-white bg-[#1f1d1b] border border-[#2d2a27] rounded-lg hover:bg-[#2d2a27] font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={loading}
                className="px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#ff8c66] disabled:bg-[#2d2a27] disabled:text-[#8d857b] disabled:cursor-not-allowed font-semibold"
              >
                {loading ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Role Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#161413] border border-[#2d2a27] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-white mb-4">
              Update Member Role
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-[#8d857b] mb-4">
                Change role for <strong className="text-white">{selectedMember.email}</strong>
              </p>
              
              <div className="space-y-2">
                {roles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => handleUpdateMemberRole(selectedMember.id, role.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      role.id === selectedMember.role_id
                        ? 'border-[#ff6a3c] bg-[#ff6a3c]/10'
                        : 'border-[#2d2a27] hover:border-[#ff6a3c]/50 hover:bg-[#1f1d1b]'
                    }`}
                  >
                    <div className="font-bold text-white">{role.display_name}</div>
                    <div className="text-xs text-[#8d857b]">
                      {role.id === selectedMember.role_id && '(Current Role)'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-white bg-[#1f1d1b] border border-[#2d2a27] rounded-lg hover:bg-[#2d2a27] font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Members;
