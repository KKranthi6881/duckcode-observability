import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Users, ChevronRight, MoreVertical, Edit, Trash2, UserPlus } from 'lucide-react';
import type { Organization, Team, TeamType } from '../../types/enterprise';
import { teamService } from '../../services/enterpriseService';

interface AdminContext {
  selectedOrg: Organization;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
}

export const Teams: React.FC = () => {
  const { selectedOrg } = useOutletContext<AdminContext>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (selectedOrg) {
      loadTeams();
    }
  }, [selectedOrg]);

  const loadTeams = async () => {
    if (!selectedOrg) return;
    
    try {
      setLoading(true);
      const data = await teamService.getTeams(selectedOrg.id);
      setTeams(data);
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTeamTypeColor = (type: TeamType) => {
    const colors = {
      organization: 'bg-purple-100 text-purple-700',
      division: 'bg-blue-100 text-blue-700',
      department: 'bg-green-100 text-green-700',
      business_unit: 'bg-yellow-100 text-yellow-700',
      group: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || colors.group;
  };

  const getTeamTypeLabel = (type: TeamType) => {
    const labels = {
      organization: 'Organization',
      division: 'Division',
      department: 'Department',
      business_unit: 'Business Unit',
      group: 'Group',
    };
    return labels[type] || 'Group';
  };

  const buildTeamHierarchy = (teams: Team[]): Team[] => {
    // Simple flat list for now, can be enhanced to show hierarchy
    return teams.sort((a, b) => {
      // Sort by team_type hierarchy, then by name
      const typeOrder: Record<TeamType, number> = {
        organization: 1,
        division: 2,
        department: 3,
        business_unit: 4,
        group: 5,
      };
      const typeCompare = typeOrder[a.team_type] - typeOrder[b.team_type];
      if (typeCompare !== 0) return typeCompare;
      return a.name.localeCompare(b.name);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hierarchicalTeams = buildTeamHierarchy(teams);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
          <p className="mt-2 text-gray-600">
            Organize members into hierarchical teams
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-5 w-5" />
          <span>Create Team</span>
        </button>
      </div>

      {/* Teams List */}
      {teams.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No teams yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first team to organize members and manage access
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-5 w-5" />
            <span>Create Team</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {hierarchicalTeams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {team.parent_team_id && (
                        <ChevronRight className="h-4 w-4 text-gray-400 mr-2" />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {team.display_name}
                        </div>
                        <div className="text-xs text-gray-500">{team.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTeamTypeColor(team.team_type)}`}>
                      {getTeamTypeLabel(team.team_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate">
                      {team.description || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      <span>0</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button className="text-gray-400 hover:text-blue-600">
                        <UserPlus className="h-4 w-4" />
                      </button>
                      <button className="text-gray-400 hover:text-blue-600">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button className="text-gray-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Team Modal - Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Create New Team
            </h3>
            <p className="text-gray-600 mb-4">
              Team creation form will be implemented here
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teams;
