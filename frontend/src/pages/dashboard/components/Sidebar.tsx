import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, Shield, Network, Snowflake, TrendingUp, LogOut
} from 'lucide-react';
import { useAuth } from '../../../features/auth/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';

const navigation = [
  {
    name: 'Code Intelligence',
    href: '/dashboard/lineage',
    icon: Network
  }, {
    name: 'Cost Analytics',
    href: '/dashboard/analytics',
    icon: TrendingUp
  },  {
    name: 'Snowflake Intelligence',
    href: '/dashboard/snowflake-intelligence',
    icon: Snowflake
  }, {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: SettingsIcon
  }
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (user?.id) {
        try {
          console.log('[Sidebar] Checking admin role for user:', user.id, 'email:', user.email);
          
          // Check user role from Supabase directly
          // Note: Using limit(1) instead of single() to avoid errors if user has multiple roles
          const { data: roleData, error } = await supabase
            .schema('enterprise')
            .from('user_organization_roles')
            .select(`
              role_id,
              organization_roles!inner (
                name
              )
            `)
            .eq('user_id', user.id)
            .limit(1);

          console.log('[Sidebar] Role query result:', { roleData, error, count: roleData?.length });

          if (!error && roleData && roleData.length > 0) {
            const firstRole = roleData[0];
            const orgRoles = firstRole.organization_roles as unknown as { name: string };
            const roleName = orgRoles?.name;
            console.log('[Sidebar] User role:', roleName);
            const adminStatus = roleName === 'Admin';
            console.log('[Sidebar] Setting isAdmin to:', adminStatus);
            setIsAdmin(adminStatus);
          } else {
            console.log('[Sidebar] No role found or error, defaulting to non-admin', { error });
            setIsAdmin(false);
          }
        } catch (error) {
          console.error('[Sidebar] Failed to check admin role:', error);
          setIsAdmin(false);
        }
      }
    };
    checkAdminRole();
  }, [user]); 

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login'); 
    } catch (error) {
      console.error('Error signing out from sidebar:', error);
    }
  };

  return (
    <div className="w-16 bg-[#0d0c0c] border-r border-[#2d2a27] flex flex-col items-center py-4 space-y-6 sidebar-container">
      {/* Logo */}
      <Link to="/" className="flex items-center justify-center w-10 h-10 bg-[#ff6a3c] rounded-lg hover:bg-[#ff8c66] transition-colors">
        <img src="/icon-duck-obs.png" alt="DuckCode" className="h-6 w-6" />
      </Link>

      {/* Navigation Icons */}
      <nav className="flex-1 flex flex-col items-center space-y-2 w-full px-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.href);
          
          return (
            <Link
              key={item.name}
              to={item.href}
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

        {/* Admin Panel - Only for admins */}
        {!authLoading && user && isAdmin && (
          <Link
            to="/admin"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-purple-400 hover:bg-[#161413] hover:text-purple-300 transition-all"
            title="Admin Panel"
          >
            <Shield className="h-5 w-5" />
          </Link>
        )}
      </nav>

      {/* Bottom Section - User & Sign Out */}
      <div className="flex flex-col items-center space-y-3 pb-2">
        {!authLoading && user && (
          <>
            {/* User Avatar */}
            <div
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#161413] border border-[#2d2a27] text-white font-semibold text-sm"
              title={user.email || 'User'}
            >
              {(user.email || 'U').charAt(0).toUpperCase()}
            </div>
            
            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[#8d857b] hover:bg-red-600/20 hover:text-red-400 transition-all duration-200 group"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}