import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, BarChart3, Shield, Network, Bell, Globe, MessageSquare
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
  icon: BarChart3
}, {
  name: 'Settings',
  href: '/dashboard/settings',
  icon: SettingsIcon
}];

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
    <div className="w-16 bg-gray-900 flex flex-col items-center py-4 space-y-6 sidebar-container">
      {/* Logo */}
      <Link to="/" className="flex items-center justify-center w-10 h-10 bg-indigo-600 rounded-lg">
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

        {/* Admin Panel - Only for admins */}
        {!authLoading && user && isAdmin && (
          <Link
            to="/admin"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-purple-400 hover:bg-gray-800 hover:text-purple-300 transition-colors"
            title="Admin Panel"
          >
            <Shield className="h-5 w-5" />
          </Link>
        )}
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
        {!authLoading && user && (
          <button
            onClick={handleSignOut}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            title={user.email || 'User'}
          >
            {(user.email || 'U').charAt(0).toUpperCase()}
          </button>
        )}
      </div>
    </div>
  );
}