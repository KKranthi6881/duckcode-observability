import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { CodeIntegration } from './components/CodeIntegration';
import { Benefits } from './components/Benefits';
// import { CTA } from './components/CTA'; // CTA and Footer removed from landing if user is redirected
// import { Footer } from './components/Footer';
import { DashboardLayout } from './pages/dashboard/DashboardLayout';
import { Overview } from './pages/dashboard/Overview';
import { DataLineage } from './pages/dashboard/DataLineage';
import { DataCatalog } from './pages/dashboard/DataCatalog';
import { DataAlerts } from './pages/dashboard/DataAlerts';
import { DataGovernance } from './pages/dashboard/DataGovernance';
import { Settings } from './pages/dashboard/Settings';
import FctOrderItemsLineage from './pages/dashboard/FctOrderItemsLineage';
import { AnomalyDetection } from './pages/dashboard/AnomalyDetection';
import { AnomalyFreshness } from './pages/dashboard/anomalies/AnomalyFreshness';
import { AnomalyVolume } from './pages/dashboard/anomalies/AnomalyVolume';
import { AnomalyPattern } from './pages/dashboard/anomalies/AnomalyPattern';
import { AnomalySchema } from './pages/dashboard/anomalies/AnomalySchema';
import { IncidentManager } from './pages/dashboard/IncidentManager';
import { CodeBase } from './pages/dashboard/CodeBase';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './features/auth/contexts/AuthContext'; // Added useAuth import
import LoginPage from './features/auth/components/LoginPage';
import RegisterPage from './features/auth/components/RegisterPage';
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import ForgotPasswordPage from './features/auth/components/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/components/ResetPasswordPage';
import ProfilePage from './features/auth/components/ProfilePage';
import GitHubCallbackPage from './pages/GitHubCallbackPage'; // Import the new page
import GitHubCallbackDebugPage from './pages/GitHubCallbackDebugPage'; // Import our debug page

// Debug component to test routing
const DebugComponent = () => {
  return (
    <div className="min-h-screen bg-purple-900 p-8 flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold mb-4 text-yellow-300">Debug Route Working!</h1>
      <p className="text-2xl text-white">If you can see this, routing is working correctly.</p>
      <div className="mt-8 p-6 bg-red-500 text-white text-xl rounded-lg">
        This is a high-contrast test element to verify rendering
      </div>
    </div>
  );
};

// New component to handle routes and global auth redirects
const AppContent = () => {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && session && location.pathname === '/') {
      navigate('/dashboard', { replace: true });
    }
  }, [session, isLoading, navigate, location.pathname]);

  // If authentication state is still loading, display a loading indicator
  // or a minimal layout to prevent flashing the main content.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        {/* You can replace this with a more sophisticated spinner component if desired */}
        <p className="text-lg text-gray-700">Loading...</p>
      </div>
    );
  }

  // If not loading, proceed to render the main application routes.
  // The useEffect above will handle redirection if necessary.
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#F5B72F]/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#2AB7A9]/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000" />
      </div>
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/github/callback" element={<GitHubCallbackPage />} />
        <Route path="/github/debug-callback" element={<GitHubCallbackDebugPage />} /> {/* Add debug route */}

        {/* Protected Routes - All routes within this element will be guarded */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Overview />} />
            <Route path="lineage" element={<DataLineage />} />
            <Route path="fct-order-items" element={<FctOrderItemsLineage />} />
            <Route path="catalog" element={<DataCatalog />} />
            <Route path="alerts" element={<DataAlerts />} />
            <Route path="anomalies" element={<AnomalyDetection />} />
            <Route path="anomalies/freshness" element={<AnomalyFreshness />} />
            <Route path="anomalies/volume" element={<AnomalyVolume />} />
            <Route path="anomalies/pattern" element={<AnomalyPattern />} />
            <Route path="anomalies/schema" element={<AnomalySchema />} />
            <Route path="incidents" element={<IncidentManager />} />
            <Route path="code" element={<CodeBase />} />
            <Route path="governance" element={<DataGovernance />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Debug route */}
        <Route path="/debug" element={<DebugComponent />} />

        {/* Landing page route */}
        <Route path="/" element={
          <>
            <Header />
            <main>
              <Hero />
              <CodeIntegration />
              <Features />
              <Benefits />
            </main>
            {/* CTA and Footer are part of the main landing page layout, 
                they will only show if the user is not authenticated and not redirected. 
                If we want them on other pages, they should be part of those page layouts. */}
          </>
        } />
      </Routes>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <AppContent /> {/* Use the new AppContent component here */}
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}