import { useState } from 'react';
import { User, Lock, Bell, Mail, Building, Briefcase, Camera } from 'lucide-react';
import { PasswordChangeModal } from '@/components/modals/PasswordChangeModal';

type NotificationKey = 'email' | 'push' | 'weekly' | 'marketing';

export function Profile() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');
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
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-4 border-background shadow-lg flex items-center justify-center overflow-hidden">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-primary" />
                )}
              </div>
              <label
                htmlFor="header-profile-upload"
                className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-lg"
              >
                <Camera className="h-4 w-4 text-primary-foreground" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="header-profile-upload"
                />
              </label>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{form.fullName}</h1>
              <p className="text-muted-foreground mt-1 flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>{form.email}</span>
              </p>
              <p className="text-muted-foreground mt-1 flex items-center space-x-2">
                <Building className="h-4 w-4" />
                <span>{form.company}</span>
                <span className="text-border">•</span>
                <Briefcase className="h-4 w-4" />
                <span>{form.role}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex space-x-1" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    activeTab === tab.id
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  } flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm transition-all duration-200`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-8">
            {/* Personal Information Card */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Personal Information</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Update your personal details and contact information
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground placeholder-muted-foreground transition-all"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground placeholder-muted-foreground transition-all"
                    placeholder="your.email@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground placeholder-muted-foreground transition-all"
                    placeholder="Your company name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Role / Job Title
                  </label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground placeholder-muted-foreground transition-all"
                    placeholder="e.g., Data Engineer"
                  />
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Security</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Manage your password and security preferences
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 border border-border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Password</h4>
                    <p className="text-sm text-muted-foreground">Last changed 3 months ago</p>
                  </div>
                </div>
                <button
                  onClick={handleChangePassword}
                  className="px-4 py-2 bg-background border border-border text-foreground rounded-lg hover:bg-accent font-medium transition-colors text-sm"
                >
                  Change Password
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                <span className="text-destructive">*</span> Required fields
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setForm({
                    fullName: 'John Doe',
                    email: 'john@example.com',
                    company: 'Acme Inc',
                    role: 'Data Engineer'
                  })}
                  className="px-6 py-2.5 bg-background border border-border text-foreground rounded-lg hover:bg-accent font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-semibold transition-colors shadow-sm hover:shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose how you want to be notified about important updates
                </p>
              </div>

              <div className="space-y-4">
                {notificationOptions.map((notification) => (
                  <div
                    key={notification.key}
                    className="flex items-center justify-between p-5 bg-background border border-border rounded-lg hover:border-primary/30 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground mb-1">{notification.label}</h4>
                      <p className="text-sm text-muted-foreground">{notification.description}</p>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, [notification.key]: !notifications[notification.key] })}
                      className={`${
                        notifications[notification.key] ? 'bg-primary' : 'bg-muted'
                      } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 ml-4`}
                      role="switch"
                      aria-checked={notifications[notification.key]}
                    >
                      <span
                        className={`${
                          notifications[notification.key] ? 'translate-x-5' : 'translate-x-0'
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Email Digest Frequency</h4>
                    <p className="text-sm text-muted-foreground">Receive consolidated updates</p>
                  </div>
                  <select className="px-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary">
                    <option>Daily</option>
                    <option>Weekly</option>
                    <option>Monthly</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <PasswordChangeModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  );
}
