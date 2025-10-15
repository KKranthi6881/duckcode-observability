import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Shield, Edit, Trash2, Users, Check } from 'lucide-react';
import type { Organization, OrganizationRole } from '../../types/enterprise';
import { roleService } from '../../services/enterpriseService';
import { PERMISSIONS } from '../../types/enterprise';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

const PERMISSION_GROUPS = {
  'Metadata': [
    PERMISSIONS.METADATA_READ,
    PERMISSIONS.METADATA_WRITE,
    PERMISSIONS.METADATA_DELETE,
  ],
  'Teams': [
    PERMISSIONS.TEAMS_READ,
    PERMISSIONS.TEAMS_CREATE,
    PERMISSIONS.TEAMS_UPDATE,
    PERMISSIONS.TEAMS_DELETE,
  ],
  'Connectors': [
    PERMISSIONS.CONNECTORS_READ,
    PERMISSIONS.CONNECTORS_CREATE,
    PERMISSIONS.CONNECTORS_UPDATE,
    PERMISSIONS.CONNECTORS_DELETE,
  ],
  'Users': [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_INVITE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
  ],
  'Roles': [
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.ROLES_CREATE,
    PERMISSIONS.ROLES_UPDATE,
    PERMISSIONS.ROLES_DELETE,
  ],
  'API Keys': [
    PERMISSIONS.API_KEYS_READ,
    PERMISSIONS.API_KEYS_CREATE,
    PERMISSIONS.API_KEYS_UPDATE,
    PERMISSIONS.API_KEYS_DELETE,
  ],
  'Organization': [
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_UPDATE,
    PERMISSIONS.ORGANIZATION_DELETE,
  ],
};

export const Roles: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<OrganizationRole | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    permissions: [] as string[],
  });

  useEffect(() => {
    if (selectedOrg) {
      loadRoles();
    }
  }, [selectedOrg]);

  const loadRoles = async () => {
    if (!selectedOrg) return;
    
    try {
      setLoading(true);
      const data = await roleService.getOrganizationRoles(selectedOrg.id);
      setRoles(data);
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleSelectAllInGroup = (groupPermissions: string[]) => {
    const allSelected = groupPermissions.every(p => formData.permissions.includes(p));
    
    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !groupPermissions.includes(p))
        : [...new Set([...prev.permissions, ...groupPermissions])],
    }));
  };

  const openCreateModal = () => {
    setFormData({ name: '', display_name: '', permissions: [] });
    setEditingRole(null);
    setShowCreateModal(true);
  };

  const openEditModal = (role: OrganizationRole) => {
    setFormData({
      name: role.name,
      display_name: role.display_name,
      permissions: role.permissions,
    });
    setEditingRole(role);
    setShowCreateModal(true);
  };

  const getPermissionLabel = (permission: string) => {
    return permission.split(':')[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
          <h1 className="text-3xl font-bold text-gray-900">Roles & Permissions</h1>
          <p className="mt-2 text-gray-600">
            Define custom roles with granular permissions
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>Create Role</span>
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <div key={role.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${role.name === 'Admin' ? 'bg-red-100' : role.name === 'Member' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Shield className={`h-5 w-5 ${role.name === 'Admin' ? 'text-red-600' : role.name === 'Member' ? 'text-blue-600' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {role.display_name}
                  </h3>
                  <p className="text-xs text-gray-500">{role.name}</p>
                </div>
              </div>
              {!role.is_default && (
                <div className="flex space-x-1">
                  <button
                    onClick={() => openEditModal(role)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {role.is_default && (
              <span className="inline-block px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full mb-3">
                Default Role
              </span>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Permissions</span>
                <span className="font-medium text-gray-900">
                  {role.permissions.includes('*') ? 'All' : role.permissions.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Users</span>
                <span className="font-medium text-gray-900 flex items-center">
                  <Users className="h-4 w-4 mr-1" />
                  0
                </span>
              </div>
            </div>

            {role.permissions.includes('*') ? (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800 font-medium">
                  Full access to all features
                </p>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-2">Key permissions:</p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 3).map(perm => (
                    <span key={perm} className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {getPermissionLabel(perm)}
                    </span>
                  ))}
                  {role.permissions.length > 3 && (
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      +{role.permissions.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create/Edit Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full my-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingRole ? 'Edit Role' : 'Create New Role'}
            </h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., data_analyst"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Lowercase, no spaces (use underscores)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g., Data Analyst"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {Object.entries(PERMISSION_GROUPS).map(([groupName, groupPermissions]) => {
                    const allSelected = groupPermissions.every(p => formData.permissions.includes(p));
                    const someSelected = groupPermissions.some(p => formData.permissions.includes(p));

                    return (
                      <div key={groupName} className="border-b border-gray-200 pb-4 last:border-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{groupName}</h4>
                          <button
                            onClick={() => handleSelectAllInGroup(groupPermissions)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {groupPermissions.map(permission => (
                            <label
                              key={permission}
                              className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.includes(permission)}
                                  onChange={() => handlePermissionToggle(permission)}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                              </div>
                              <span className="text-sm text-gray-700">
                                {getPermissionLabel(permission)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Selected {formData.permissions.length} permissions
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roles;
