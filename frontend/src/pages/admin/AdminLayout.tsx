import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Key,
  Users,
  Settings,
  Home,
  BarChart3,
  Database,
  Bell,
  Globe,
  MessageSquare,
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
    // { name: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard }, // Hidden - not needed currently
    { name: 'Cost Analytics', path: '/admin/analytics', icon: BarChart3 },
    { name: 'Metadata Extraction', path: '/admin/metadata', icon: Database },
    { name: 'Connectors', path: '/admin/connectors', icon: Database },
    // { name: 'AI Documentation', path: '/admin/ai-documentation', icon: Zap }, // Hidden - changed plan for document generation process
    // { name: 'Search', path: '/admin/search', icon: Search }, // Hidden - for future search tool intelligence
    { name: 'API Keys', path: '/admin/api-keys', icon: Key },
    { name: 'Members', path: '/admin/members', icon: Users },
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Organizations</h2>
          <p className="text-gray-600 mb-6">
            You don't belong to any organizations yet. Contact your administrator to get invited.
          </p>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
      <div className="w-16 bg-gray-900 flex flex-col items-center py-4 space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-lg">
          <img src="/icon-duck-obs.png" alt="DuckCode" className="h-6 w-6" />
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 flex flex-col items-center space-y-2 w-full px-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  w-10 h-10 flex items-center justify-center rounded-lg transition-colors
                  ${active
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }
                `}
                title={item.name}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>

        {/* Bottom Icons */}
        <div className="flex flex-col items-center space-y-2">
          <button className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <Globe className="h-5 w-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <Bell className="h-5 w-5" />
          </button>
          <button className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <MessageSquare className="h-5 w-5" />
          </button>
          <button
            onClick={handleSignOut}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-semibold"
            title={userEmail}
          >
            {userEmail.charAt(0).toUpperCase()}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-white">
        <Outlet context={{ selectedOrg, organizations, refreshOrganizations: loadOrganizations }} />
      </div>
    </div>
  );
};

export default AdminLayout;
