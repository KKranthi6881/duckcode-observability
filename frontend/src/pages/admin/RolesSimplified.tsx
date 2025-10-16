/**
 * Simplified Roles Page - Shows 3 Standard Roles
 * No custom role creation - just clear information about each role
 */

import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Shield, Eye, Wrench, Crown, Users, Check } from 'lucide-react';
import type { Organization, OrganizationRole } from '../../types/enterprise';
import { roleService } from '../../services/enterpriseService';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

const ROLE_INFO = {
  Admin: {
    icon: Crown,
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    description: 'Full administrative access to the organization',
    whoShouldUse: 'Organization administrators, IT managers',
    capabilities: [
      'Everything that Members can do',
      'Manage API keys (OpenAI, Anthropic, etc.)',
      'Invite and remove users',
      'Assign roles to team members',
      'Access organization settings',
      'View billing and manage subscription',
      'View audit logs',
      'Delete resources and teams',
    ],
  },
  Member: {
    icon: Wrench,
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    description: 'Can perform work and operations without admin privileges',
    whoShouldUse: 'Data engineers, developers, team leads',
    capabilities: [
      'Everything that Viewers can do',
      'Create and manage connectors',
      'Run metadata extraction jobs',
      'Create and edit teams',
      'Upload code for analysis',
      'Manage their own projects',
      'Cannot access API keys (admin provides)',
      'Cannot invite users or change settings',
    ],
  },
  Viewer: {
    icon: Eye,
    color: 'gray',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    description: 'Read-only access to view data and analytics',
    whoShouldUse: 'Architects, data analysts, business stakeholders',
    capabilities: [
      'View metadata and code architecture',
      'Access dashboards and analytics',
      'View data lineage diagrams',
      'Read documentation',
      'View team structure',
      'Cannot modify anything',
      'Cannot see API keys or sensitive settings',
      'Cannot invite users',
    ],
  },
};

export const RolesSimplified: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

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
      setRoles(data.filter(r => r.is_default)); // Only show default roles
      
      // TODO: Load member counts for each role
      setMemberCounts({
        Admin: 1, // Placeholder
        Member: 0,
        Viewer: 0,
      });
    } catch (error) {
      console.error('Failed to load roles:', error);
    } finally {
      setLoading(false);
    }
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Organization Roles</h1>
        <p className="mt-2 text-gray-600">
          Your organization has 3 standard roles with clearly defined permissions
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <div className="flex items-start">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900">Simple & Secure</h3>
            <p className="text-sm text-blue-700 mt-1">
              We use a standard 3-tier role system: <strong>Viewer</strong> (read-only), <strong>Member</strong> (can work), 
              and <strong>Admin</strong> (full access). This makes it easy to onboard users and maintain security.
            </p>
          </div>
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {['Viewer', 'Member', 'Admin'].map((roleName) => {
          const info = ROLE_INFO[roleName as keyof typeof ROLE_INFO];
          const Icon = info.icon;
          const roleData = roles.find(r => r.name === roleName);
          const memberCount = memberCounts[roleName] || 0;

          return (
            <div
              key={roleName}
              className={`${info.bgColor} ${info.borderColor} border-2 rounded-lg p-6 hover:shadow-lg transition-shadow`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`${info.iconBg} p-3 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${info.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{roleName}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Users className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-600">
                        {memberCount} {memberCount === 1 ? 'user' : 'users'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <p className={`text-sm ${info.textColor} font-medium mb-3`}>
                {info.description}
              </p>

              {/* Who Should Use */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Who Should Use
                </p>
                <p className="text-sm text-gray-700">{info.whoShouldUse}</p>
              </div>

              {/* Capabilities */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Capabilities
                </p>
                <ul className="space-y-1.5">
                  {info.capabilities.map((capability, idx) => (
                    <li key={idx} className="flex items-start text-xs text-gray-600">
                      <Check className={`h-3 w-3 ${info.iconColor} mt-0.5 mr-1.5 flex-shrink-0`} />
                      <span>{capability}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Permissions Count */}
              {roleData && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    {roleData.permissions.includes('*') 
                      ? 'All system permissions' 
                      : `${roleData.permissions.length} specific permissions`}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">How to Assign Roles</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            <strong>When inviting users:</strong> Select the appropriate role based on what they need to do. 
            You can always change a user's role later if needed.
          </p>
          <p>
            <strong>Best practice:</strong> Start with the <strong>Viewer</strong> role for new users. 
            They can request more access if needed, and you can upgrade them to <strong>Member</strong> or <strong>Admin</strong>.
          </p>
          <p>
            <strong>Security tip:</strong> Limit the number of <strong>Admin</strong> users. 
            Only organization owners and IT managers should have admin access.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RolesSimplified;
