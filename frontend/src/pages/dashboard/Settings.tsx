import { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { User, Lock, Bell, Check, Github } from 'lucide-react';
import { PasswordChangeModal } from '@/components/modals/PasswordChangeModal';
import { Button } from '@/components/ui/button';

const GitHubIntegrationTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Repository Management</h3>
        <p className="text-sm text-muted-foreground">
          GitHub repositories are centrally managed by organization administrators.
        </p>
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <Github className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold text-foreground mb-2">
              Centralized Repository Access
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              All team members have read-only access to view repositories, lineage diagrams, 
              documentation, and data catalogs that have been connected by administrators.
            </p>
            
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>View repository metadata and objects</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Browse data lineage diagrams</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Read documentation</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Explore data catalog</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">
                <strong>Need to connect a repository?</strong> Contact your organization 
                administrator or visit the Admin page if you have admin access.
              </p>
              <Button 
                onClick={() => window.location.href = '/admin'}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Go to Admin Page
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          How It Works
        </h4>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start space-x-3">
            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-semibold">
              1
            </span>
            <span>Administrators connect GitHub repositories in the Admin page</span>
          </li>
          <li className="flex items-start space-x-3">
            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-semibold">
              2
            </span>
            <span>Metadata is automatically extracted and indexed</span>
          </li>
          <li className="flex items-start space-x-3">
            <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-semibold">
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
  const [activeTab, setActiveTab] = useState('profile');
  const [notifications, setNotifications] = useState<Record<NotificationKey, boolean>>({
    email: true,
    push: false,
    weekly: true,
    marketing: false
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: 'John Doe',
    email: 'john@example.com',
    company: 'Acme Inc',
    role: 'Data Engineer'
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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

  const notificationOptions: { key: NotificationKey; label: string; description: string }[] = [
    { key: 'email', label: 'Email Notifications', description: 'Receive important updates via email' },
    { key: 'push', label: 'Push Notifications', description: 'Get real-time alerts in your browser' },
    { key: 'weekly', label: 'Weekly Summary', description: 'Weekly digest of your data insights' },
    { key: 'marketing', label: 'Marketing Communications', description: 'Updates about new features and tips' }
  ];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
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
                        ? 'border-primary text-primary'
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
            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Profile Information</h3>
                  <p className="text-muted-foreground mt-1">
                    Update your personal details and account information
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Profile Photo Section */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-3">
                        Profile Photo
                      </label>
                      <div className="flex flex-col items-center space-y-4">
                        <div className="h-24 w-24 rounded-full bg-muted border-4 border-border flex items-center justify-center overflow-hidden">
                          {profileImage ? (
                            <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-10 w-10 text-muted-foreground" />
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
                          className="cursor-pointer px-4 py-2 bg-muted border border-border text-foreground rounded-lg hover:bg-accent transition-colors text-sm font-medium"
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
                        <label className="block text-sm font-semibold text-foreground mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent text-foreground placeholder-muted-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent text-foreground placeholder-muted-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                          Company
                        </label>
                        <input
                          type="text"
                          value={form.company}
                          onChange={(e) => setForm({ ...form, company: e.target.value })}
                          className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent text-foreground placeholder-muted-foreground"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">
                          Role
                        </label>
                        <input
                          type="text"
                          value={form.role}
                          onChange={(e) => setForm({ ...form, role: e.target.value })}
                          className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent text-foreground placeholder-muted-foreground"
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-4 pt-6 border-t border-border">
                      <button
                        onClick={handleSaveProfile}
                        className="px-6 py-3 bg-primary text-foreground rounded-lg hover:bg-primary/90 font-semibold transition-colors"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={handleChangePassword}
                        className="px-6 py-3 bg-muted border border-border text-foreground rounded-lg hover:bg-accent font-medium transition-colors flex items-center space-x-2"
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
                  <h3 className="text-xl font-bold text-foreground">Notification Preferences</h3>
                  <p className="text-muted-foreground mt-1">
                    Choose what notifications you want to receive
                  </p>
                </div>

                <div className="space-y-6">
                  {notificationOptions.map((notification) => (
                    <div key={notification.key} className="flex items-center justify-between p-4 bg-muted border border-border rounded-lg">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{notification.label}</h4>
                        <p className="text-sm text-muted-foreground">{notification.description}</p>
                      </div>
                      <button
                        onClick={() => setNotifications({ ...notifications, [notification.key]: !notifications[notification.key] })}
                        className={`${
                          notifications[notification.key] ? 'bg-primary' : 'bg-accent'
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

            {/* GitHub Integration */}
            {activeTab === 'github' && <GitHubIntegrationTab />}
          </div>
        </div>
      </div>

      {/* Modals */}
      <PasswordChangeModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  );
}