import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Network, Database, Bell, Shield, BarChart3, Settings as SettingsIcon, HelpCircle, Table } from 'lucide-react';

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
  return <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col flex-1 min-h-0 bg-slate-800 border-r border-slate-700">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <div className="flex items-center flex-shrink-0 px-4">
              <Link to="/" className="flex items-center">
                <img src="/icon.png" alt="Duckcode Logo" className="h-8 w-auto" />
                <span className="ml-2 text-xl font-bold text-white">
                  Duckcode<span className="text-[#2AB7A9]">.ai</span>
                </span>
              </Link>
            </div>
            <nav className="mt-8 flex-1 px-2 space-y-8">
              {navigation.map(item => item.items ? <div key={item.name}>
                    <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {item.name}
                    </p>
                    <div className="mt-2 space-y-1">
                      {item.items.map(subItem => {
                        const isActive = location.pathname === subItem.href || 
                                       (subItem.subItems && subItem.subItems.some(si => location.pathname === si.href));
                        return (
                          <div key={subItem.name}>
                            <Link 
                              to={subItem.href} 
                              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                              }`}
                            >
                              <subItem.icon className={`mr-3 h-5 w-5 ${
                                isActive ? 'text-[#2AB7A9]' : 'text-slate-400 group-hover:text-[#2AB7A9]'
                              }`} />
                              {subItem.name}
                            </Link>
                            
                            {/* Display subItems if they exist */}
                            {subItem.subItems && subItem.subItems.length > 0 && (
                              <div className="ml-6 mt-1 space-y-1">
                                {subItem.subItems.map(subSubItem => {
                                  const isSubActive = location.pathname === subSubItem.href;
                                  return (
                                    <Link
                                      key={subSubItem.name}
                                      to={subSubItem.href}
                                      className={`group flex items-center px-3 py-1.5 text-xs font-medium rounded-md ${
                                        isSubActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                                      }`}
                                    >
                                      <subSubItem.icon className={`mr-2 h-4 w-4 ${
                                        isSubActive ? 'text-[#2AB7A9]' : 'text-slate-400 group-hover:text-[#2AB7A9]'
                                      }`} />
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
                  </div> : <Link key={item.name} to={item.href} className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${location.pathname === item.href ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'}`}>
                    <item.icon className={`mr-3 h-5 w-5 ${location.pathname === item.href ? 'text-[#2AB7A9]' : 'text-slate-400 group-hover:text-[#2AB7A9]'}`} />
                    {item.name}
                  </Link>)}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-slate-700 p-4">
            <div className="flex-shrink-0 w-full">
              {bottomNavigation.map(item => <Link key={item.name} to={item.href} className="group flex items-center px-3 py-2 text-sm font-medium rounded-md text-slate-300 hover:text-white hover:bg-slate-700">
                  <item.icon className="mr-3 h-5 w-5 text-slate-400 group-hover:text-[#2AB7A9]" />
                  {item.name}
                </Link>)}
            </div>
          </div>
        </div>
      </div>
    </div>;
}