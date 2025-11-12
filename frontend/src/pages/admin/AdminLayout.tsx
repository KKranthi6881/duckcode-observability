import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Building2,
  Key,
  Users,
  Settings,
  Home,
  TrendingUp,
  Plug,
  LogOut,
  Shield,
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
    { name: 'Cost Analytics', path: '/admin/analytics', icon: TrendingUp },
    { name: 'Connectors Hub', path: '/admin/connectors', icon: Plug },
    { name: 'API Keys', path: '/admin/api-keys', icon: Key },
    { name: 'Members', path: '/admin/members', icon: Users },
    { name: 'SSO', path: '/admin/sso', icon: Shield },
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
      <div className="flex items-center justify-center h-screen bg-[#0d0c0c]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6a3c] mx-auto"></div>
          <p className="mt-4 text-[#8d857b]">Loading...</p>
        </div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d0c0c]">
        <div className="text-center max-w-md p-8 bg-[#161413] rounded-xl border border-[#2d2a27]">
          <Building2 className="h-16 w-16 text-[#8d857b] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Organizations</h2>
          <p className="text-[#8d857b] mb-6">
            You don't belong to any organizations yet. Contact your administrator to get invited.
          </p>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#ff8c66] transition-colors font-semibold"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0d0c0c]">
      {/* Sidebar */}
      <div className="w-16 bg-[#0d0c0c] border-r border-[#2d2a27] flex flex-col items-center py-4 space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center w-10 h-10 bg-[#ff6a3c] rounded-lg hover:bg-[#ff8c66] transition-colors">
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
                  w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200
                  ${active
                    ? 'bg-[#ff6a3c] text-white shadow-lg shadow-[#ff6a3c]/50'
                    : 'text-[#8d857b] hover:bg-[#161413] hover:text-white'
                  }
                `}
                title={item.name}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section - User & Sign Out */}
        <div className="flex flex-col items-center space-y-3 pb-2">
          {/* User Avatar */}
          <div
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#161413] border border-[#2d2a27] text-white font-semibold text-sm"
            title={userEmail}
          >
            {userEmail.charAt(0).toUpperCase()}
          </div>
          
          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-[#8d857b] hover:bg-red-600/20 hover:text-red-400 transition-all duration-200 group"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-[#0d0c0c]">
        <Outlet context={{ selectedOrg, organizations, refreshOrganizations: loadOrganizations }} />
      </div>
    </div>
  );
};

export default AdminLayout;
