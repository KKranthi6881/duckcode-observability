import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Key,
  Mail,
  Settings,
  LayoutDashboard,
  ChevronDown,
  LogOut,
  Home,
} from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import type { Organization } from '../../types/enterprise';
import { organizationService } from '../../services/enterpriseService';

export const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    loadOrganizations();
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      
      const userOrgs = await organizationService.getUserOrganizations();
      console.log('getUserOrganizations returned:', userOrgs);
      
      // Map the RPC result to Organization objects
      const orgs = userOrgs.map(uo => ({
        id: uo.organization_id,
        name: uo.organization_name,
        display_name: uo.organization_display_name,
        status: 'trial' as const, // We know it's trial from registration
        plan_type: 'trial' as const,
        max_users: 10,
        settings: {},
        created_at: uo.created_at,
        updated_at: uo.created_at,
      }));
      
      console.log('Mapped organizations:', orgs);
      setOrganizations(orgs);
      
      // Auto-select first organization
      if (orgs.length > 0 && !selectedOrg) {
        setSelectedOrg(orgs[0]);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navigationItems = [
    { name: 'Main Dashboard', path: '/dashboard', icon: Home, highlight: true },
    { name: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'API Keys', path: '/admin/api-keys', icon: Key },
    { name: 'Invitations', path: '/admin/invitations', icon: Mail },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin portal...</p>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow">
          <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Organizations</h2>
          <p className="text-gray-600 mb-6">
            You don't belong to any organizations yet. Contact your administrator to get invited.
          </p>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg flex flex-col">
        {/* Organization Selector */}
        <div className="p-4 border-b">
          <div className="relative">
            <button className="w-full flex items-center justify-between px-3 py-2 text-left bg-gray-50 rounded-lg hover:bg-gray-100">
              <div className="flex items-center space-x-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-sm truncate">
                  {selectedOrg?.display_name || 'Select Organization'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
            
            {/* Organization dropdown (implement later) */}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const isHighlight = 'highlight' in item && item.highlight;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-colors
                  ${active
                    ? 'bg-blue-50 text-blue-700'
                    : isHighlight
                    ? 'text-gray-700 hover:bg-green-50 border border-green-200'
                    : 'text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-blue-700' : isHighlight ? 'text-green-600' : 'text-gray-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                  {userEmail.split('@')[0]}
                </p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet context={{ selectedOrg, organizations, refreshOrganizations: loadOrganizations }} />
      </div>
    </div>
  );
};

export default AdminLayout;
