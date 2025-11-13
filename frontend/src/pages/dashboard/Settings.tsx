import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { User, Lock, CreditCard, Bell, Check, Star, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { PasswordChangeModal } from '@/components/modals/PasswordChangeModal';
import { PaymentModal } from '@/components/modals/PaymentModal';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  current?: boolean;
  popular?: boolean;
};

const plans: Plan[] = [{
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
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Repository Management</h3>
        <p className="text-sm text-muted-foreground">
          GitHub repositories are centrally managed by organization administrators.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <Github className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Centralized Repository Access
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
              All team members have read-only access to view repositories, lineage diagrams, 
              documentation, and data catalogs that have been connected by administrators.
            </p>
            
            <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>View repository metadata and objects</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>Browse data lineage diagrams</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>Read documentation</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span>Explore data catalog</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                <strong>Need to connect a repository?</strong> Contact your organization 
                administrator or visit the Admin page if you have admin access.
              </p>
              <Button 
                onClick={() => window.location.href = '/admin'}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Admin Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
          How It Works
        </h4>
        <ol className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start space-x-3">
            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold">
              1
            </span>
            <span>Administrators connect GitHub repositories in the Admin page</span>
          </li>
          <li className="flex items-start space-x-3">
            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold">
              2
            </span>
            <span>Metadata is automatically extracted and indexed</span>
          </li>
          <li className="flex items-start space-x-3">
            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold">
              3
            </span>
            <span>All team members can view and explore the data in the main dashboard</span>
          </li>
        </ol>
      </div>
    </div>
  );
};

type NotificationKey = 'email' | 'push' | 'weekly' | 'marketing';

export function Settings() {
  const {
    theme,
    setTheme
  } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    email: true,
    push: false,
    weekly: true,
    marketing: false
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Inc',
    role: 'Data Engineer'
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
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

  const handleUpdatePayment = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const notificationOptions: { key: NotificationKey; label: string; description: string }[] = [
    { key: 'email', label: 'Email Notifications', description: 'Receive important updates via email' },
    { key: 'push', label: 'Push Notifications', description: 'Get real-time alerts in your browser' },
    { key: 'weekly', label: 'Weekly Summary', description: 'Weekly digest of your data insights' },
    { key: 'marketing', label: 'Marketing Communications', description: 'Updates about new features and tips' }
  ];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Sun },
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
  }, [location, searchParams]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Modern Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your account preferences and integrations</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-card text-card-foreground rounded-xl border border-border overflow-hidden">
          
          {/* Modern Tab Navigation */}
          <div className="border-b border-border bg-background">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-[#ff6a3c] text-[#ff6a3c]'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    } flex items-center space-x-2 whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-all duration-200 -mb-px`}
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
            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold">Appearance</h3>
                  <p className="text-muted-foreground mt-1">Choose Light, Dark, or follow your System preference</p>
                </div>

                <div className="inline-flex rounded-lg border border-border overflow-hidden">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => setTheme('light')}
                    className="rounded-none"
                  >
                    <Sun className="h-4 w-4 mr-2" /> Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => setTheme('dark')}
                    className="rounded-none"
                  >
                    <Moon className="h-4 w-4 mr-2" /> Dark
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    onClick={() => setTheme('system')}
                    className="rounded-none"
                  >
                    <Monitor className="h-4 w-4 mr-2" /> System
                  </Button>
                </div>

                <div className="rounded-lg border border-border p-6 bg-muted/30">
                  <p className="text-sm text-muted-foreground">Preview</p>
                  <div className="mt-3 h-24 rounded-md border border-border bg-background" />
                </div>
              </div>
            )}
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-white">Profile Information</h3>
                  <p className="text-[#8d857b] mt-1">
                    Update your personal details and account information
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Profile Photo Section */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-white mb-3">
                        Profile Photo
                      </label>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="h-24 w-24 rounded-full bg-[#1f1d1b] border-4 border-[#2d2a27] flex items-center justify-center overflow-hidden">
                          {profileImage ? (
                            <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-10 w-10 text-[#8d857b]" />
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
                          className="cursor-pointer px-4 py-2 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg hover:bg-[#2d2a27] transition-colors text-sm font-medium"
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
                        <label className="block text-sm font-semibold text-white mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          className="w-full px-4 py-3 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg focus:ring-2 focus:ring-[#ff6a3c]/50 focus:border-transparent text-white placeholder-[#8d857b]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full px-4 py-3 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg focus:ring-2 focus:ring-[#ff6a3c]/50 focus:border-transparent text-white placeholder-[#8d857b]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">
                          Company
                        </label>
                        <input
                          type="text"
                          value={form.company}
                          onChange={(e) => setForm({ ...form, company: e.target.value })}
                          className="w-full px-4 py-3 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg focus:ring-2 focus:ring-[#ff6a3c]/50 focus:border-transparent text-white placeholder-[#8d857b]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-white mb-2">
                          Role
                        </label>
                        <input
                          type="text"
                          value={form.role}
                          onChange={(e) => setForm({ ...form, role: e.target.value })}
                          className="w-full px-4 py-3 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg focus:ring-2 focus:ring-[#ff6a3c]/50 focus:border-transparent text-white placeholder-[#8d857b]"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-4 pt-6 border-t border-[#2d2a27]">
                      <button
                        onClick={handleSaveProfile}
                        className="px-6 py-3 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#ff8c66] font-semibold transition-colors"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleChangePassword}
                        className="px-6 py-3 bg-[#1f1d1b] border border-[#2d2a27] text-white rounded-lg hover:bg-[#2d2a27] font-medium transition-colors flex items-center space-x-2"
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
                  <h3 className="text-xl font-bold text-white">Notification Preferences</h3>
                  <p className="text-[#8d857b] mt-1">
                    Choose what notifications you want to receive
                  </p>
                </div>

                <div className="space-y-6">
                  {notificationOptions.map((notification) => (
                    <div key={notification.key} className="flex items-center justify-between p-4 bg-[#1f1d1b] border border-[#2d2a27] rounded-lg">
                      <div>
                        <h4 className="text-sm font-semibold text-white">{notification.label}</h4>
                        <p className="text-sm text-[#8d857b]">{notification.description}</p>
                      </div>
                      <button
                        onClick={() => setNotifications({ ...notifications, [notification.key]: !notifications[notification.key] })}
                        className={`${
                          notifications[notification.key] ? 'bg-[#ff6a3c]' : 'bg-[#2d2a27]'
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
                  <h3 className="text-xl font-bold text-white">Billing & Subscription</h3>
                  <p className="text-[#8d857b] mt-1">
                    Manage your subscription plan and payment methods
                  </p>
                </div>

                {/* Current Plan Overview */}
                <div className="bg-[#1f1d1b] rounded-xl p-6 border-2 border-[#ff6a3c]/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-white">Current Plan: Free</h4>
                      <p className="text-[#8d857b]">You're currently on the Free plan</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#ff6a3c]">$0</div>
                      <div className="text-sm text-[#8d857b]">per month</div>
                    </div>
                  </div>
                </div>

                {/* Available Plans */}
                <div>
                  <h4 className="text-lg font-bold text-white mb-6">Available Plans</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.map((plan) => (
                      <div
                        key={plan.name}
                        className={`relative rounded-xl border-2 p-6 transition-all bg-[#1f1d1b] ${
                          plan.current
                            ? 'border-[#ff6a3c] shadow-lg shadow-[#ff6a3c]/20'
                            : 'border-[#2d2a27] hover:border-[#ff6a3c]/50 hover:shadow-md'
                        }`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="inline-flex items-center rounded-full bg-[#ff6a3c] px-3 py-1 text-xs font-bold text-white shadow-lg">
                              <Star className="h-3 w-3 mr-1" />
                              Most Popular
                            </span>
                          </div>
                        )}
                        
                        <div className="text-center">
                          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                          <div className="mt-3">
                            <span className="text-3xl font-bold text-white">{plan.price}</span>
                            <span className="text-[#8d857b] text-sm">/{plan.period}</span>
                          </div>
                          <p className="mt-3 text-sm text-[#8d857b]">{plan.description}</p>
                        </div>

                        <ul className="mt-6 space-y-3">
                          {plan.features.map((feature) => (
                            <li key={feature} className="flex items-start text-sm">
                              <Check className="h-4 w-4 text-[#ff6a3c] mr-3 flex-shrink-0 mt-0.5" />
                              <span className="text-white">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <button
                          onClick={() => !plan.current && handleUpdatePayment(plan)}
                          disabled={plan.current}
                          className={`mt-6 w-full rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                            plan.current
                              ? 'bg-[#2d2a27] text-[#8d857b] cursor-not-allowed'
                              : plan.popular
                              ? 'bg-[#ff6a3c] text-white hover:bg-[#ff8c66] hover:shadow-lg hover:scale-105'
                              : 'bg-[#ff6a3c] text-white hover:bg-[#ff8c66] hover:shadow-md'
                          }`}
                        >
                          {plan.current ? 'Current Plan' : 'Upgrade'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Method Section */}
                <div className="border-t border-[#2d2a27] pt-8">
                  <h4 className="text-lg font-bold text-white mb-6">Payment Method</h4>
                  <div className="bg-[#1f1d1b] border border-[#2d2a27] rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 bg-[#2d2a27] rounded-lg flex items-center justify-center">
                          <CreditCard className="h-6 w-6 text-[#8d857b]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">No payment method added</p>
                          <p className="text-sm text-[#8d857b]">Add a payment method to upgrade your plan</p>
                        </div>
                      </div>
                      <button className="px-4 py-2 bg-[#ff6a3c] text-white rounded-lg hover:bg-[#ff8c66] font-semibold transition-colors">
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