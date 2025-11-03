import { useEffect, ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';

interface DashboardLayoutProps {
  children?: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  
  useEffect(() => {
    // Debug console log to track when this component renders and with what path
    console.log('DashboardLayout rendered. Path:', location.pathname);
    
    // Check if there are any duplicate elements that might cause the double UI
    const sidebarElements = document.querySelectorAll('.sidebar-container');
    if (sidebarElements.length > 1) {
      console.error('DUPLICATE UI DETECTED: Multiple sidebar elements found', sidebarElements.length);
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-white">
        {/* Use children if provided, otherwise fall back to Outlet for router-based content */}
        {children || <Outlet />}
      </div>
    </div>
  );
}