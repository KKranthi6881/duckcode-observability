import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { User, Mail, Lock, CreditCard, Moon, Sun, Monitor, Bell, Check, Star, Zap } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { PasswordChangeModal } from '@/components/modals/PasswordChangeModal';
import { PaymentModal } from '@/components/modals/PaymentModal';
import { useAuth } from '@/features/auth/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Github, Loader2 } from 'lucide-react';

// Define types for GitHub connection status (mirroring backend types)
interface GitHubAccountInfo {
  login: string | null;
  avatarUrl: string | null;
  type: string | null;
}

interface GitHubRepositoryInfo { // We might not use all fields here, but good to have
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
}

interface GitHubConnectionDetails {
  installationId: number;
  account: GitHubAccountInfo;
  repositorySelection: string | null;
  accessibleRepos: GitHubRepositoryInfo[];
  totalAccessibleRepoCount: number;
}

interface GitHubConnectionStatusResponse {
  isConnected: boolean;
  details: GitHubConnectionDetails | null;
  error?: string;
}

const plans = [{
  name: 'Free',
  price: '$0',
  period: 'forever',
  description: 'Basic features for individuals getting started',
  features: ['Basic data lineage', 'Limited catalog entries', 'Community support', '1 user'],
  current: true
}, {
  name: 'Starter',
  price: '$29',
  period: 'per month',
  description: 'Everything in Free plus enhanced features',
  features: ['Advanced data lineage', 'Unlimited catalog entries', 'Email support', 'Up to 5 users']
}, {
  name: 'Pro',
  price: '$99',
  period: 'per month',
  description: 'Professional features for growing teams',
  features: ['Column-level lineage', 'Advanced governance', 'Priority support', 'Up to 20 users'],
  popular: true
}, {
  name: 'Pro Plus',
  price: '$299',
  period: 'per month',
  description: 'Enterprise-grade features and support',
  features: ['Custom integrations', 'Enterprise governance', 'Dedicated support', 'Unlimited users']
}];

const GitHubIntegrationTab = () => {
  const { profile, isLoading: authLoading, user, session } = useAuth();
  const [isLoadingInstall, setIsLoadingInstall] = useState(false);
  const [errorInstall, setErrorInstall] = useState<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<GitHubConnectionStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  console.log('[Settings.tsx] Rendering GitHubIntegrationTab. Profile:', profile, 'Auth Loading:', authLoading, 'User:', user?.id, 'Session:', session);

  const fetchConnectionStatus = useCallback(async () => {
    if (!session?.access_token) {
      setIsLoadingStatus(false);
      console.log('[Settings.tsx] No session token, cannot fetch GitHub status.');
      setConnectionStatus({ isConnected: false, details: null });
      return;
    }
    setIsLoadingStatus(true);
    console.log('[Settings.tsx] Attempting to fetch GitHub connection status...');
    try {
      const response = await fetch('/api/github/connection-status', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch GitHub connection status from server.' }));
        console.error('[Settings.tsx] API Error fetching GitHub connection status:', response.status, errorData);
        throw new Error(errorData.message);
      }
      const data: GitHubConnectionStatusResponse = await response.json();
      console.log('[Settings.tsx] Successfully received GitHub connection status:', data);
      setConnectionStatus(data);
    } catch (error: any) {
      console.error('[Settings.tsx] Exception caught while fetching GitHub connection status:', error);
      setConnectionStatus({ isConnected: false, details: null, error: error.message });
    } finally {
      setIsLoadingStatus(false);
      console.log('[Settings.tsx] Finished fetching GitHub connection status. isLoadingStatus set to false.');
    }
  }, [session, setIsLoadingStatus, setConnectionStatus]); // Dependencies for useCallback

  useEffect(() => {
    console.log('[Settings.tsx] useEffect triggered. AuthLoading:', authLoading);
    if (!authLoading) {
      console.log('[Settings.tsx] Auth is not loading, calling fetchConnectionStatus.');
      fetchConnectionStatus();
    } else {
      console.log('[Settings.tsx] Auth is loading, setting isLoadingStatus to true.');
      setIsLoadingStatus(true); 
    }

    const handleFocus = () => {
      console.log('[Settings.tsx] Window focused. AuthLoading:', authLoading);
      if (!authLoading) { // Only fetch if auth is settled
          console.log('[Settings.tsx] Window focused and auth not loading, calling fetchConnectionStatus.');
          fetchConnectionStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    console.log('[Settings.tsx] Added window focus event listener.');

    return () => {
      window.removeEventListener('focus', handleFocus);
      console.log('[Settings.tsx] Removed window focus event listener.');
    };
  }, [authLoading, fetchConnectionStatus]); // fetchConnectionStatus is now a stable dependency

  const handleInstallGitHubApp = async () => {
    console.log('[Settings.tsx] GitHub Install Button CLICKED.');
    setIsLoadingInstall(true);
    setErrorInstall(null);

    if (!session?.access_token) {
      console.error('[Settings.tsx] No access token found. User might not be authenticated.');
      setErrorInstall('Authentication error. Please log in again.');
      setIsLoadingInstall(false);
      return;
    }

    try {
      console.log('[Settings.tsx] Fetching GitHub installation URL from /api/github/start-installation');
      const response = await fetch('/api/github/start-installation', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch installation URL. Please try again.' }));
        console.error('[Settings.tsx] Error fetching installation URL:', response.status, errorData);
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      if (data.installationUrl) {
        console.log('[Settings.tsx] Received installation URL. Redirecting to:', data.installationUrl);
        window.location.href = data.installationUrl;
      } else {
        console.error('[Settings.tsx] Installation URL not found in response:', data);
        throw new Error('Installation URL not provided by the server.');
      }
    } catch (error) {
      console.error('[Settings.tsx] Failed to initiate GitHub installation:', error);
      setErrorInstall(error instanceof Error ? error.message : 'An unknown error occurred.');
      setIsLoadingInstall(false);
    } 
  };

  if (isLoadingStatus) {
    return (
      <div className="space-y-6 py-6 flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Loading GitHub Integration status...</p>
      </div>
    );
  }

  if (connectionStatus?.isConnected && connectionStatus.details) {
    const { account, repositorySelection, totalAccessibleRepoCount, accessibleRepos } = connectionStatus.details;
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">GitHub App Integration</h3>
          <p className="text-sm text-muted-foreground">
            Manage your GitHub App connection.
          </p>
        </div>
        <div className="rounded-md border bg-card p-6 shadow">
          <div className="flex items-center space-x-4">
            {account?.avatarUrl && (
              <img src={account.avatarUrl} alt={`${account.login || 'GitHub Account'}'s avatar`} className="h-16 w-16 rounded-full" />
            )}
            <div>
              <p className="text-xl font-semibold">Connected as {account?.login || 'Unknown Account'}</p>
              <p className="text-sm text-muted-foreground">
                Repository Access: {repositorySelection === 'all' ? 'All Repositories' : `Selected Repositories (${totalAccessibleRepoCount} accessible)`}
              </p>
              {repositorySelection === 'selected' && accessibleRepos && accessibleRepos.length > 0 && (
                <div className="mt-2 pl-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Accessible Repositories:</p>
                  <ul className="list-disc list-inside mt-1 text-sm text-gray-600 dark:text-gray-300 space-y-1">
                    {accessibleRepos.map(repo => (
                      <li key={repo.id}>{repo.full_name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="mt-6">
            {/* TODO: Add a "Manage Installation on GitHub" link that goes to: 
                `https://github.com/settings/installations/${connectionStatus.details.installationId}` 
            */}
            <a 
              href={`https://github.com/settings/installations/${connectionStatus.details.installationId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 mr-2"
            >
              Manage on GitHub
            </a>
            {/* TODO: Add a "Disconnect" button - this will require a backend endpoint and confirmation modal */}
            <Button variant="outline" onClick={() => alert('Disconnect functionality to be implemented.')}>
              Disconnect (Placeholder)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If not loading and not connected (or error fetching status), show the install button section
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">GitHub App Integration</h3>
        <p className="text-sm text-muted-foreground">
          Connect your GitHub account to enable repository insights and observability.
        </p>
      </div>
      <div className="rounded-md border border-dashed p-6 flex flex-col items-center text-center">
        <Github className="h-12 w-12 text-muted-foreground mb-4" />
        <h4 className="text-md font-semibold mb-1">Connect to GitHub</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Authorize DuckCode Observability to access your repositories.
        </p>
        <Button onClick={handleInstallGitHubApp} disabled={isLoadingInstall || authLoading}>
          {isLoadingInstall ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait...</>
          ) : (
            <><Github className="mr-2 h-4 w-4" /> Install GitHub App</>
          )}
        </Button>
        {errorInstall && (
          <p className="mt-4 text-sm text-red-600">Error: {errorInstall}</p>
        )}
        {connectionStatus?.error && !connectionStatus.isConnected && (
            <p className="mt-4 text-sm text-red-600">Could not load connection status: {connectionStatus.error}</p>
        )}
      </div>
    </div>
  );
};

export function Settings() {
  const {
    theme,
    setTheme
  } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    weekly: true,
    marketing: false
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [form, setForm] = useState({
    fullName: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Inc',
    role: 'Data Engineer'
  });

  const handleImageUpload = (event: any) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    alert('Profile updated successfully!');
  };

  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handleUpdatePayment = (plan: any) => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
    { id: 'github', label: 'GitHub Integration', icon: Github }
  ];

  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'github') {
      setActiveTab('github');
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Modern Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account preferences and integrations</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          
          {/* Modern Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-[#2AB7A9] text-[#2AB7A9] bg-white dark:bg-gray-900'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    } flex items-center space-x-2 whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-all duration-200 ease-in-out rounded-t-lg -mb-px`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Profile Information</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Update your personal details and account information
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Profile Photo Section */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Profile Photo
                      </label>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="h-24 w-24 rounded-full bg-gray-100 dark:bg-gray-800 border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden">
                          {profileImage ? (
                            <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-10 w-10 text-gray-400" />
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="profile-upload"
                        />
                        <label
                          htmlFor="profile-upload"
                          className="cursor-pointer px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
                        >
                          Change Photo
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Profile Form */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Company
                        </label>
                        <input
                          type="text"
                          value={form.company}
                          onChange={(e) => setForm({ ...form, company: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Role
                        </label>
                        <input
                          type="text"
                          value={form.role}
                          onChange={(e) => setForm({ ...form, role: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={handleSaveProfile}
                        className="px-6 py-3 bg-[#2AB7A9] text-white rounded-lg hover:bg-[#2AB7A9]/90 font-medium transition-colors"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleChangePassword}
                        className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-colors flex items-center space-x-2"
                      >
                        <Lock className="h-4 w-4" />
                        <span>Change Password</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Notification Preferences</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Choose what notifications you want to receive
                  </p>
                </div>

                <div className="space-y-6">
                  {[
                    { key: 'email', label: 'Email Notifications', description: 'Receive important updates via email' },
                    { key: 'push', label: 'Push Notifications', description: 'Get real-time alerts in your browser' },
                    { key: 'weekly', label: 'Weekly Summary', description: 'Weekly digest of your data insights' },
                    { key: 'marketing', label: 'Marketing Communications', description: 'Updates about new features and tips' }
                  ].map((notification) => (
                    <div key={notification.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">{notification.label}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{notification.description}</p>
                      </div>
                      <button
                        onClick={() => setNotifications({ ...notifications, [notification.key]: !notifications[notification.key] })}
                        className={`${
                          notifications[notification.key] ? 'bg-[#2AB7A9]' : 'bg-gray-200 dark:bg-gray-700'
                        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
                      >
                        <span
                          className={`${
                            notifications[notification.key] ? 'translate-x-5' : 'translate-x-0'
                          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Billing & Plans */}
            {activeTab === 'billing' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Billing & Subscription</h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Manage your subscription plan and payment methods
                  </p>
                </div>

                {/* Current Plan Overview */}
                <div className="bg-gradient-to-r from-[#2AB7A9]/10 to-blue-500/10 rounded-xl p-6 border border-[#2AB7A9]/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Current Plan: Free</h4>
                      <p className="text-gray-600 dark:text-gray-400">You're currently on the Free plan</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">$0</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">per month</div>
                    </div>
                  </div>
                </div>

                {/* Available Plans */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Available Plans</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.map((plan) => (
                      <div
                        key={plan.name}
                        className={`relative rounded-xl border-2 p-6 transition-all ${
                          plan.current
                            ? 'border-[#2AB7A9] bg-[#2AB7A9]/5 shadow-lg'
                            : 'border-gray-200 dark:border-gray-700 hover:border-[#2AB7A9]/50 hover:shadow-md'
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#2AB7A9] to-blue-500 px-3 py-1 text-xs font-medium text-white shadow-lg">
                              <Star className="h-3 w-3 mr-1" />
                              Most Popular
                            </span>
                          </div>
                        )}
                        
                        <div className="text-center">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                          <div className="mt-3">
                            <span className="text-3xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                            <span className="text-gray-600 dark:text-gray-400 text-sm">/{plan.period}</span>
                          </div>
                          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{plan.description}</p>
                        </div>

                        <ul className="mt-6 space-y-3">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start text-sm">
                              <Check className="h-4 w-4 text-[#2AB7A9] mr-3 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <button
                          onClick={() => !plan.current && handleUpdatePayment(plan)}
                          disabled={plan.current}
                          className={`mt-6 w-full rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                            plan.current
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                              : plan.popular
                              ? 'bg-gradient-to-r from-[#2AB7A9] to-blue-500 text-white hover:shadow-lg hover:scale-105'
                              : 'bg-[#2AB7A9] text-white hover:bg-[#2AB7A9]/90 hover:shadow-md'
                          }`}
                        >
                          {plan.current ? 'Current Plan' : 'Upgrade'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Payment Method</h4>
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                          <CreditCard className="h-6 w-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">No payment method added</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Add a payment method to upgrade your plan</p>
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-[#2AB7A9] text-white rounded-lg hover:bg-[#2AB7A9]/90 font-medium transition-colors">
                        Add Payment Method
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* GitHub Integration */}
            {activeTab === 'github' && <GitHubIntegrationTab />}
          </div>
        </div>
      </div>

      {/* Modals */}
      <PasswordChangeModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
      {selectedPlan && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          plan={selectedPlan}
        />
      )}
    </div>
  );
}