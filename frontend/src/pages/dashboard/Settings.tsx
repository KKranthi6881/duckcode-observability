import React, { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { User, Mail, Lock, CreditCard, Moon, Sun, Monitor, Bell, Check, Star, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { PasswordChangeModal } from '../../components/modals/PasswordChangeModal';
import { PaymentModal } from '../../components/modals/PaymentModal';
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
  const handleImageUpload = event => {
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
    // Here you would typically save to a backend
    // For now, just show a success message
    alert('Profile updated successfully!');
  };
  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };
  const handleUpdatePayment = plan => {
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="border-b border-slate-700">
            <nav className="flex -mb-px">
              {['profile', 'appearance', 'notifications', 'billing'].map(tab => <button key={tab} className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === tab ? 'border-[#2AB7A9] text-[#2AB7A9]' : 'border-transparent text-slate-400 hover:text-slate-300'}`} onClick={() => setActiveTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>)}
            </nav>
          </div>
          <div className="p-6">
            {/* Profile Settings */}
            {activeTab === 'profile' && <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-white">Profile</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Manage your account information
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-8 divide-y divide-slate-700">
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-300">
                          Profile Photo
                        </label>
                        <div className="mt-2 flex items-center space-x-4">
                          <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center">
                            {profileImage ? <img src={profileImage} alt="Profile Photo" className="h-16 w-16 rounded-full" /> : <User className="h-8 w-8 text-slate-400" />}
                          </div>
                          <button className="px-3 py-2 bg-slate-700 text-sm text-slate-300 rounded-md hover:bg-slate-600">
                            Change Photo
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300">
                          Full Name
                        </label>
                        <input type="text" className="mt-2 block w-full rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent" defaultValue="John Doe" value={form.fullName} onChange={e => setForm({
                      ...form,
                      fullName: e.target.value
                    })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-300">
                          Email
                        </label>
                        <input type="email" className="mt-2 block w-full rounded-md bg-slate-700 border border-slate-600 text-slate-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#2AB7A9] focus:border-transparent" defaultValue="john@example.com" value={form.email} onChange={e => setForm({
                      ...form,
                      email: e.target.value
                    })} />
                      </div>
                    </div>
                    <div className="pt-6 space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-slate-300">
                          Password
                        </h4>
                        <button className="mt-2 px-4 py-2 bg-slate-700 text-sm text-slate-300 rounded-md hover:bg-slate-600">
                          Change Password
                        </button>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-300">
                          Two-Factor Authentication
                        </h4>
                        <button className="mt-2 px-4 py-2 bg-slate-700 text-sm text-slate-300 rounded-md hover:bg-slate-600">
                          Enable 2FA
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>}
            {/* Appearance Settings */}
            {activeTab === 'appearance' && <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-white">Appearance</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Customize your interface
                  </p>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-slate-300">
                      Theme
                    </label>
                    <div className="mt-2 grid grid-cols-3 gap-4">
                      <button className={`flex items-center justify-center px-4 py-3 rounded-lg border ${theme === 'light' ? 'border-[#2AB7A9] bg-[#2AB7A9]/10' : 'border-slate-600 hover:border-slate-500'}`} onClick={() => setTheme('light')}>
                        <Sun className="h-5 w-5 mr-2 text-slate-300" />
                        <span className="text-sm text-slate-300">Light</span>
                      </button>
                      <button className={`flex items-center justify-center px-4 py-3 rounded-lg border ${theme === 'dark' ? 'border-[#2AB7A9] bg-[#2AB7A9]/10' : 'border-slate-600 hover:border-slate-500'}`} onClick={() => setTheme('dark')}>
                        <Moon className="h-5 w-5 mr-2 text-slate-300" />
                        <span className="text-sm text-slate-300">Dark</span>
                      </button>
                      <button className={`flex items-center justify-center px-4 py-3 rounded-lg border ${theme === 'system' ? 'border-[#2AB7A9] bg-[#2AB7A9]/10' : 'border-slate-600 hover:border-slate-500'}`} onClick={() => setTheme('system')}>
                        <Monitor className="h-5 w-5 mr-2 text-slate-300" />
                        <span className="text-sm text-slate-300">System</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>}
            {/* Notifications Settings */}
            {activeTab === 'notifications' && <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-white">
                    Notifications
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Manage your notification preferences
                  </p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-4">
                    {Object.entries(notifications).map(([key, value]) => <div key={key} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-300 capitalize">
                            {key.replace('_', ' ')} Notifications
                          </p>
                          <p className="text-sm text-slate-400">
                            Receive {key} notifications
                          </p>
                        </div>
                        <button className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${value ? 'bg-[#2AB7A9]' : 'bg-slate-600'}`} onClick={() => setNotifications(prev => ({
                    ...prev,
                    [key]: !prev[key]
                  }))}>
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${value ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>)}
                  </div>
                </div>
              </div>}
            {/* Billing Settings */}
            {activeTab === 'billing' && <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium text-white">
                    Billing & Plans
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Manage your subscription and billing
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {plans.map(plan => <div key={plan.name} className={`relative rounded-lg border ${plan.current ? 'border-[#2AB7A9] bg-[#2AB7A9]/5' : 'border-slate-700'} p-6 shadow-sm`}>
                      {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="inline-flex items-center rounded-full bg-[#2AB7A9]/10 px-3 py-1 text-xs font-medium text-[#2AB7A9]">
                            Most Popular
                          </span>
                        </div>}
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-white">
                          {plan.name}
                        </h3>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-white">
                            {plan.price}
                          </span>
                          <span className="text-sm text-slate-400">
                            /{plan.period}
                          </span>
                        </div>
                        <p className="mt-4 text-sm text-slate-400">
                          {plan.description}
                        </p>
                      </div>
                      <ul className="mt-6 space-y-3">
                        {plan.features.map(feature => <li key={feature} className="flex items-center text-sm text-slate-300">
                            <Check className="h-4 w-4 text-[#2AB7A9] mr-2 flex-shrink-0" />
                            {feature}
                          </li>)}
                      </ul>
                      <button className={`mt-6 w-full rounded-md px-3 py-2 text-sm font-medium ${plan.current ? 'bg-slate-700 text-slate-300 cursor-default' : 'bg-[#2AB7A9] text-white hover:bg-[#2AB7A9]/90'}`}>
                        {plan.current ? 'Current Plan' : 'Upgrade'}
                      </button>
                    </div>)}
                </div>
                <div className="mt-8 border-t border-slate-700 pt-8">
                  <h4 className="text-sm font-medium text-slate-300">
                    Payment Method
                  </h4>
                  <div className="mt-4">
                    <button className="px-4 py-2 bg-slate-700 text-sm text-slate-300 rounded-md hover:bg-slate-600">
                      <CreditCard className="h-4 w-4 inline mr-2" />
                      Update Payment Method
                    </button>
                  </div>
                </div>
              </div>}
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={handleSaveProfile} className="px-4 py-2 bg-[#2AB7A9] text-white rounded-md hover:bg-[#2AB7A9]/90">
          Save Changes
        </button>
      </div>
      <button onClick={handleChangePassword} className="mt-2 px-4 py-2 bg-slate-700 text-sm text-slate-300 rounded-md hover:bg-slate-600">
        Change Password
      </button>
      {plans.map(plan => <button key={plan.name} onClick={() => handleUpdatePayment(plan)} className={`mt-6 w-full rounded-md px-3 py-2 text-sm font-medium ${plan.current ? 'bg-slate-700 text-slate-300 cursor-default' : 'bg-[#2AB7A9] text-white hover:bg-[#2AB7A9]/90'}`} disabled={plan.current}>
          {plan.current ? 'Current Plan' : 'Upgrade'}
        </button>)}
      <PasswordChangeModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
      {selectedPlan && <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} plan={selectedPlan} />}
    </DashboardLayout>;
}