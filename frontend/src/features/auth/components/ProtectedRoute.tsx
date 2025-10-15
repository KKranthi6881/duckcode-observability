import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading, session } = useAuth();

  if (isLoading) {
    // You can render a loading spinner or a blank page while checking auth state
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  // Check for session as well, as user object might persist briefly after logout 
  // depending on how state updates are scheduled by React.
  // Supabase session is the most reliable source of truth for active login.
  if (!session || !user) {
    // User not authenticated, redirect to login page
    return <Navigate to="/login" replace />;
  }

  // User is authenticated, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;
