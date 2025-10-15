import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, Shield, Key, Mail, TrendingUp, Activity } from 'lucide-react';
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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      name: 'Total Members',
      value: stats?.member_count || 0,
      icon: Users,
      color: 'blue',
      change: '+12%',
      changeType: 'increase' as const,
    },
    {
      name: 'Teams',
      value: stats?.team_count || 0,
      icon: Shield,
      color: 'green',
      change: '+3',
      changeType: 'increase' as const,
    },
    {
      name: 'API Keys',
      value: stats?.api_key_count || 0,
      icon: Key,
      color: 'purple',
      change: '2 active',
      changeType: 'neutral' as const,
    },
    {
      name: 'Pending Invites',
      value: 0,
      icon: Mail,
      color: 'orange',
      change: 'None',
      changeType: 'neutral' as const,
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {stats?.display_name || 'Organization Dashboard'}
        </h1>
        <p className="mt-2 text-gray-600">
          Overview of your organization's activity and resources
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'bg-blue-50 text-blue-600',
            green: 'bg-green-50 text-green-600',
            purple: 'bg-purple-50 text-purple-600',
            orange: 'bg-orange-50 text-orange-600',
          };

          return (
            <div key={stat.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-lg ${colorClasses[stat.color as keyof typeof colorClasses]}`}>
                  <Icon className="h-6 w-6" />
                </div>
                {stat.changeType === 'increase' && (
                  <div className="flex items-center text-green-600 text-sm">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    {stat.change}
                  </div>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Organization Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organization Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Organization Details
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Name</span>
              <span className="text-sm font-medium text-gray-900">{stats?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Plan Type</span>
              <span className="text-sm font-medium text-gray-900 capitalize">
                {stats?.plan_type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`text-sm font-medium capitalize ${
                stats?.status === 'active' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {stats?.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Max Users</span>
              <span className="text-sm font-medium text-gray-900">
                {stats?.member_count} / {stats?.max_users}
              </span>
            </div>
            {stats?.domain && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Domain</span>
                <span className="text-sm font-medium text-gray-900">{stats.domain}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-600" />
            Recent Activity
          </h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="h-2 w-2 rounded-full bg-blue-600 mt-2"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Organization created</p>
                <p className="text-xs text-gray-500">
                  {new Date(stats?.created_at || '').toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-center py-8 text-gray-400 text-sm">
              No recent activity
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center">
            <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Invite Members</p>
            <p className="text-xs text-gray-500 mt-1">Add users to your organization</p>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center">
            <Shield className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Create Team</p>
            <p className="text-xs text-gray-500 mt-1">Organize members into teams</p>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center">
            <Key className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Add API Key</p>
            <p className="text-xs text-gray-500 mt-1">Configure LLM provider keys</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
