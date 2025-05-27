import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { DashboardHeader } from './components/DashboardHeader';

export function DashboardLayout() {
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
    <div className="min-h-screen bg-slate-900">
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto bg-slate-900 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}