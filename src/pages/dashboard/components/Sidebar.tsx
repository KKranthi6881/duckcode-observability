import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Network, Database, Bell, Shield, BarChart3, Settings as SettingsIcon, 
  HelpCircle, Table, AlertTriangle, AlertOctagon, Code, UserCircle, LogOut 
} from 'lucide-react';
import { useAuth } from '../../../features/auth/contexts/AuthContext';

const navigation = [{
  name: 'Overview',
  href: '/dashboard/', 
  icon: BarChart3
}, {
  name: 'Data Observability',
  items: [{
    name: 'Data Lineage',
    href: '/dashboard/lineage',
    icon: Network,
    subItems: [
      {
        name: 'fct_order_items',
        href: '/dashboard/fct-order-items',
        icon: Table
      }
    ]
  }, {
    name: 'Data Catalog',
    href: '/dashboard/catalog',
    icon: Database
  }, {
    name: 'Data Alerts',
    href: '/dashboard/alerts',
    icon: Bell
  }, {
    name: 'Anomaly Detection',
    href: '/dashboard/anomalies',
    icon: AlertTriangle
  }, {
    name: 'Incident Manager',
    href: '/dashboard/incidents',
    icon: AlertOctagon
  }, {
    name: 'Code Base',
    href: '/dashboard/code',
    icon: Code
  }, {
    name: 'Data Governance',
    href: '/dashboard/governance',
    icon: Shield
  }]
}];

const bottomNavigation = [{
  name: 'Settings',
  href: '/dashboard/settings',
  icon: SettingsIcon
}, {
  name: 'Help',
  href: '/dashboard/help',
  icon: HelpCircle
}];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isLoading: authLoading } = useAuth();
  const logoColor = "#2AB7A9"; 

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
                if (item.name === 'Overview') {
                  const isActive = location.pathname === item.href || (item.href === '/dashboard/' && location.pathname === '/dashboard');
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
                }
                if (item.items) { 
                  return (
                    <div key={item.name}>
                      <p className="px-3 mb-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {item.name}
                      </p>
                      <div className="mt-2 space-y-3">
                        {item.items.map(subItem => {
                          const isActive = location.pathname === subItem.href || 
                                         (subItem.href && location.pathname.startsWith(subItem.href) && subItem.href !== '/dashboard/') || 
                                         (subItem.subItems && subItem.subItems.some(si => location.pathname === si.href));
                          return (
                            <div key={subItem.name}>
                              <Link 
                                to={subItem.href} 
                                className={getLinkClasses(isActive)}
                              >
                                <subItem.icon className={getIconClasses(isActive)} />
                                {subItem.name}
                              </Link>
                              
                              {subItem.subItems && subItem.subItems.length > 0 && (
                                <div className="ml-6 mt-2 space-y-2">
                                  {subItem.subItems.map(subSubItem => {
                                    const isSubActive = location.pathname === subSubItem.href;
                                    return (
                                      <Link
                                        key={subSubItem.name}
                                        to={subSubItem.href}
                                        className={`group flex items-center px-3 py-2.5 text-xs font-medium rounded-md transition-colors duration-150
                                          ${isSubActive ? `text-[${logoColor}]` : `text-gray-600 hover:text-[${logoColor}]`}
                                        `}
                                      >
                                        <span className={`mr-2 h-4 w-4 flex items-center justify-center ${isSubActive ? `text-[${logoColor}]` : `text-gray-400 group-hover:text-[${logoColor}]`}`}>
                                          {subSubItem.icon ? <subSubItem.icon className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current"></span>}
                                        </span>
                                        {subSubItem.name}
                                      </Link>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null; 
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