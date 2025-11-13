import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
// import { CTA } from './components/CTA'; // CTA and Footer removed from landing if user is redirected
// import { Footer } from './components/Footer';
import { DashboardLayout } from './pages/dashboard/DashboardLayout';
import { Profile } from './pages/dashboard/Profile';
import { CodeBase } from './pages/dashboard/CodeBase';
import { AnalysisSetup } from './pages/dashboard/AnalysisSetup';
import { EnhancedAnalytics } from './pages/dashboard/EnhancedAnalytics';
import { DataLineage } from './pages/dashboard/DataLineage';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import SnowflakeCostDashboard from './pages/dashboard/SnowflakeCostDashboard';
import SnowflakeRecommendations from './pages/dashboard/SnowflakeRecommendations';
import SnowflakeIntelligence from './pages/dashboard/SnowflakeIntelligence'; // Using old working version temporarily
import { FileProcessingStatus } from './components/FileProcessingStatus';
import { UserAnalytics } from './pages/user/UserAnalytics';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './features/auth/contexts/AuthContext'; // Added useAuth import
import { ProcessingStatusProvider } from './context/ProcessingStatusContext';
import LoginPage from './features/auth/components/LoginPage';
import { LoginPage as SimpleLoginPage } from './pages/LoginPage';
import RegisterPage from './features/auth/components/RegisterPage';
import ProtectedRoute from './features/auth/components/ProtectedRoute';
import ForgotPasswordPage from './features/auth/components/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/components/ResetPasswordPage';
import ProfilePage from './features/auth/components/ProfilePage';
import GitHubCallbackPage from './pages/GitHubCallbackPage'; // Import the new page
import GitHubCallbackDebugPage from './pages/GitHubCallbackDebugPage'; // Import our debug page
import IDELoginPage from './pages/IDELoginPage';
import IDERegisterPage from './pages/IDERegisterPage';
import InvitationAcceptPage from './pages/InvitationAcceptPage';
import {
  AdminLayout,
  Dashboard as AdminDashboard,
  Analytics as AdminAnalytics,
  ApiKeys as AdminApiKeys,
  Members as AdminMembers,
  SSO as AdminSSO,
  SettingsPage as AdminSettings,
  SearchPage as AdminSearch,
  AIDocumentation as AdminAIDocumentation,
  ConnectorsHub,
  Subscription as AdminSubscription,
} from './pages/admin';
import LineagePage from './pages/lineage/LineagePage';

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
      navigate('/dashboard/code', { replace: true });
    }
  }, [session, isLoading, navigate, location.pathname]);

  // If authentication state is still loading, display a loading indicator
  // or a minimal layout to prevent flashing the main content.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        {/* You can replace this with a more sophisticated spinner component if desired */}
        <p className="text-lg text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // If not loading, proceed to render the main application routes.
  // The useEffect above will handle redirection if necessary.
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#F5B72F]/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#2AB7A9]/20 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000" />
      </div>
      <Routes>
        {/* Auth routes */}
        <Route path="/ide-login" element={<IDELoginPage />} />
        <Route path="/ide-register" element={<IDERegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/simple-login" element={<SimpleLoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/github/callback" element={<GitHubCallbackPage />} />
        <Route path="/github/debug-callback" element={<GitHubCallbackDebugPage />} /> {/* Add debug route */}
        
        {/* Invitation Accept - Public route (no auth required) */}
        <Route path="/invite/:token" element={<InvitationAcceptPage />} />

        {/* IDE Analytics - No auth required (backend handles auth) */}
        <Route path="/dashboard/ide-analytics" element={<AnalyticsDashboard />} />

        {/* Protected Routes - All routes within this element will be guarded */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DataLineage />} />
            <Route path="code" element={<CodeBase />} />
            <Route path="code/analyze/:owner/:repo" element={<AnalysisSetup />} />
            <Route path="code/status/:owner/:repo" element={<FileProcessingStatus />} />
            <Route path="analytics" element={<EnhancedAnalytics />} />
            <Route path="snowflake-intelligence" element={<SnowflakeIntelligence />} />
            <Route path="snowflake-costs" element={<SnowflakeCostDashboard />} />
            <Route path="snowflake-recommendations" element={<SnowflakeRecommendations />} />
            <Route path="lineage" element={<DataLineage />} />
            <Route path="my-usage" element={<UserAnalytics />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/profile" element={<ProfilePage />} />
          
          {/* Admin Portal Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="subscription" element={<AdminSubscription />} />
            <Route path="api-keys" element={<AdminApiKeys />} />
            <Route path="members" element={<AdminMembers />} />
            <Route path="sso" element={<AdminSSO />} />
            <Route path="metadata" element={<ConnectorsHub />} />
            <Route path="connectors" element={<ConnectorsHub />} />
            <Route path="ai-documentation" element={<AdminAIDocumentation />} />
            <Route path="lineage/:connectionId" element={<LineagePage />} />
            <Route path="search" element={<AdminSearch />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>

        {/* Debug route */}
        <Route path="/debug" element={<DebugComponent />} />

        {/* Landing page route */}
        <Route path="/" element={
          <>
            <Header />
            <main>
              <Hero />
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
        <ProcessingStatusProvider>
          <Router>
            <AppContent /> {/* Use the new AppContent component here */}
          </Router>
        </ProcessingStatusProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}