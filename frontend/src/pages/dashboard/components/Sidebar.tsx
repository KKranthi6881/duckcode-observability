import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, Code, UserCircle, LogOut, BarChart3, Shield 
} from 'lucide-react';
import { useAuth } from '../../../features/auth/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';

const navigation = [{
  name: 'Code Base',
  href: '/dashboard/code',
  icon: Code
}, {
  name: 'Analytics',
  href: '/dashboard/analytics',
  icon: BarChart3
}];

const bottomNavigation = [{
  name: 'Settings',
  href: '/dashboard/settings',
  icon: SettingsIcon
}];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const logoColor = "#2AB7A9";

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

  const getLinkClasses = (isActive: boolean) => 
    `group flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors duration-150 \
    ${
      isActive 
        ? `bg-[${logoColor}]/10 text-[${logoColor}]` 
        : `text-gray-700 hover:text-[${logoColor}] hover:bg-[${logoColor}]/10`
    }`;

  const getIconClasses = (isActive: boolean) => 
    `mr-3 h-5 w-5 flex-shrink-0 ${
      isActive ? `text-[${logoColor}]` : `text-gray-500 group-hover:text-[${logoColor}]`
    }`;

  return <div className="hidden lg:flex lg:flex-shrink-0 sidebar-container">
      <div className="flex flex-col w-64">
        <div className="flex flex-col flex-1 min-h-0 bg-gray-50 border-r border-gray-200">
          <div className="flex-1 flex flex-col pt-6 pb-4 overflow-y-auto">
            <div className="flex items-center justify-center flex-shrink-0 px-4 mb-4">
              <Link to="/" className="flex flex-col items-center">
                <div className=" rounded-lg shadow-md">
                  <img src="/icon.png" alt="Duckcode Logo" className="h-12 w-auto" />
                </div>
                <span className="mt-2 text-xl font-bold text-gray-900">
                  Duckcode<span style={{ color: logoColor }}></span>
                </span>
              </Link>
            </div>
            <nav className="mt-10 flex-1 px-2 space-y-8"> 
              {navigation.map(item => {
                const isActive = location.pathname === item.href;
                return (
                  <Link 
                    key={item.name} 
                    to={item.href} 
                    className={getLinkClasses(isActive)}
                  >
                    <item.icon className={getIconClasses(isActive)} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
            <div className="flex-shrink-0 w-full space-y-2">
              {bottomNavigation.map(item => {
                const isActive = location.pathname === item.href;
                return (
                  <Link 
                    key={item.name} 
                    to={item.href} 
                    className={getLinkClasses(isActive)}
                  >
                    <item.icon className={getIconClasses(isActive)} />
                    {item.name}
                  </Link>
                );
              })}

              {/* Admin Panel Button - Only for admins */}
              {(() => {
                console.log('[Sidebar Render] authLoading:', authLoading, 'user:', !!user, 'isAdmin:', isAdmin);
                return null;
              })()}
              {!authLoading && user && isAdmin && (
                <Link 
                  key="admin-panel"
                  to="/admin"
                  className="group flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors duration-150 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                >
                  <Shield className="mr-3 h-5 w-5 flex-shrink-0 text-purple-600" />
                  Admin Panel
                </Link>
              )}

              {!authLoading && user && (
                <Link 
                  key="profile"
                  to="/profile"
                  className={getLinkClasses(location.pathname === '/profile')}
                >
                  <UserCircle className={getIconClasses(location.pathname === '/profile')} />
                  Profile
                </Link>
              )}

              {!authLoading && user && (
                <button
                  key="signout"
                  onClick={handleSignOut}
                  className={`${getLinkClasses(false)} w-full text-left`}
                >
                  <LogOut className={getIconClasses(false)} />
                  Sign Out
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>;
}