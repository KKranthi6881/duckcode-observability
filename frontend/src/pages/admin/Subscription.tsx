import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Calendar, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ExternalLink,
  Clock,
  TrendingUp
} from 'lucide-react';
import axios from 'axios';
import { supabase } from '@/config/supabaseClient';

interface SubscriptionInfo {
  subscription_status: string;
  subscription_plan: string | null;
  current_seats: number;
  trial_end_date: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_per_seat: number | null;
  trial_days_remaining: number;
  is_active: boolean;
}

interface PricingPlan {
  name: string;
  pricePerSeat: number;
  features: string[];
}

interface PricingPlans {
  professional: PricingPlan;
  enterprise: PricingPlan;
  trial: {
    days: number;
    description: string;
  };
}

const Subscription: React.FC = () => {
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [pricingPlans, setPricingPlans] = useState<PricingPlans | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'professional' | 'enterprise'>('professional');
  const [seats, setSeats] = useState(1);

  const API_URL =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:3001';

  useEffect(() => {
    fetchSubscriptionInfo();
    fetchPricingPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSubscriptionInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      const response = await axios.get(`${API_URL}/api/subscriptions/info`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setSubscriptionInfo(response.data);
    } catch (error) {
      console.error('Error fetching subscription info:', error);
      // If error is 404 or subscription not found, it's okay - user might not have subscription yet
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404 || axiosError.response?.status === 400) {
        setSubscriptionInfo(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/subscriptions/plans`);
      const { plans, trial } = response.data;
      setPricingPlans({
        professional: plans.professional,
        enterprise: plans.enterprise,
        trial,
      });
    } catch (error) {
      console.error('Error fetching pricing plans:', error);
      // Set default pricing if API fails
      setPricingPlans({
        professional: {
          name: 'Professional',
          pricePerSeat: 75,
          features: [
            'Column-level lineage',
            'Snowflake cost dashboard',
            'AI query optimization',
            'Auto documentation',
            'Auto troubleshooting',
            'Architecture diagrams',
            'AI code completion',
            'Offline IDE capabilities',
            'Metadata sync',
          ],
        },
        enterprise: {
          name: 'Enterprise',
          pricePerSeat: 125,
          features: [
            'All Professional features',
            'OKTA SSO integration',
            'Advanced security controls',
            'Priority support',
            'Custom integrations',
            'Dedicated account manager',
            'SLA guarantees',
          ],
        },
        trial: {
          days: 30,
          description: '30-day free trial - No credit card required',
        },
      });
    }
  };

  const handleSubscribe = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      const response = await axios.post(
        `${API_URL}/api/subscriptions/checkout`,
        { plan: selectedPlan, seats },
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      
      // Redirect to Stripe Checkout
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to create checkout session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }
      const response = await axios.post(
        `${API_URL}/api/subscriptions/portal`,
        {},
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      
      // Redirect to Stripe Customer Portal
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('Failed to open billing portal');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ElementType; text: string }> = {
      trialing: { color: 'bg-blue-100 text-blue-800', icon: Clock, text: 'Trial' },
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Active' },
      past_due: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle, text: 'Past Due' },
      canceled: { color: 'bg-red-100 text-red-800', icon: AlertCircle, text: 'Canceled' },
    };

    const config = statusConfig[status] || statusConfig.canceled;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
        <Icon className="w-4 h-4 mr-1.5" />
        {config.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-[#2AB7A9] mx-auto mb-4" />
          <p className="text-gray-600">Loading subscription information...</p>
        </div>
      </div>
    );
  }

  const isOnTrial = subscriptionInfo?.subscription_status === 'trialing';
  const hasActiveSubscription = subscriptionInfo?.subscription_status === 'active';
  const hasNoSubscription = !subscriptionInfo;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Modern Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Subscription & Billing</h1>
              <p className="text-muted-foreground mt-1">Manage your subscription plan and billing information</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Trial Warning Banner */}
      {isOnTrial && subscriptionInfo && (
        <div className={`mb-6 p-4 rounded-lg border ${
          subscriptionInfo.trial_days_remaining <= 7 
            ? 'bg-yellow-500/10 border-yellow-500/30' 
            : 'bg-blue-500/10 border-blue-500/30'
        }`}>
          <div className="flex items-start">
            <Clock className={`w-5 h-5 mt-0.5 mr-3 ${
              subscriptionInfo.trial_days_remaining <= 7 ? 'text-yellow-500' : 'text-blue-500'
            }`} />
            <div>
              <h3 className="font-semibold text-foreground">
                {subscriptionInfo.trial_days_remaining} Days Remaining in Trial
              </h3>
              <p className="text-sm mt-1 text-muted-foreground">
                Your trial ends on {formatDate(subscriptionInfo.trial_end_date)}. 
                Subscribe now to continue using DuckCode after your trial expires.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Subscription Card */}
      {subscriptionInfo && (
        <div className="bg-card rounded-lg shadow-lg border border-border p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Current Plan</h2>
            {getStatusBadge(subscriptionInfo.subscription_status)}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Plan Info */}
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="text-lg font-semibold text-foreground capitalize">
                  {subscriptionInfo.subscription_plan || 'Trial'}
                </p>
              </div>
            </div>

            {/* Seats */}
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Seats</p>
                <p className="text-lg font-semibold text-foreground">
                  {subscriptionInfo.current_seats} {subscriptionInfo.current_seats === 1 ? 'user' : 'users'}
                </p>
              </div>
            </div>

            {/* Renewal Date */}
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isOnTrial ? 'Trial Ends' : 'Renews'}
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {formatDate(isOnTrial ? subscriptionInfo.trial_end_date : subscriptionInfo.current_period_end)}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {hasActiveSubscription && (
            <div className="mt-6 pt-6 border-t border-border">
              <button
                onClick={handleManageSubscription}
                disabled={actionLoading}
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Manage Subscription
              </button>
              <p className="text-sm text-muted-foreground mt-2">
                Update payment method, change seats, or view invoices
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pricing Plans (Show if on trial, no subscription, or not active) */}
      {(isOnTrial || !hasActiveSubscription || hasNoSubscription) && pricingPlans && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6">Choose Your Plan</h2>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Professional Plan */}
            <div className={`bg-card rounded-lg shadow-lg border-2 p-6 cursor-pointer transition hover:shadow-xl ${
              selectedPlan === 'professional' ? 'border-primary shadow-primary/20' : 'border-border'
            }`} onClick={() => setSelectedPlan('professional')}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-foreground">Professional</h3>
                {selectedPlan === 'professional' && (
                  <CheckCircle className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="mb-1">
                <span className="text-4xl font-bold text-foreground">
                  ${pricingPlans.professional.pricePerSeat}
                </span>
                <span className="text-muted-foreground ml-2">/user/month</span>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wide">
                Billed annually
              </p>
              <ul className="space-y-2 mb-4">
                {pricingPlans.professional.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Enterprise Plan */}
            <div className={`bg-card rounded-lg shadow-lg border-2 p-6 cursor-pointer transition hover:shadow-xl relative ${
              selectedPlan === 'enterprise' ? 'border-primary shadow-primary/20' : 'border-border'
            }`} onClick={() => setSelectedPlan('enterprise')}>
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg rounded-tr-lg">
                POPULAR
              </div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <h3 className="text-xl font-semibold text-foreground">Enterprise</h3>
                {selectedPlan === 'enterprise' && (
                  <CheckCircle className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="mb-1">
                <span className="text-4xl font-bold text-foreground">
                  ${pricingPlans.enterprise.pricePerSeat}
                </span>
                <span className="text-muted-foreground ml-2">/user/month</span>
              </div>
              <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wide">
                Billed annually
              </p>
              <ul className="space-y-2 mb-4">
                {pricingPlans.enterprise.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Seats Selector */}
          <div className="bg-card rounded-lg shadow-lg border border-border p-6 mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Number of Seats
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={seats}
              onChange={(e) => setSeats(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-transparent text-foreground"
            />
            <p className="text-sm text-muted-foreground mt-2">
              Total (billed annually): ${(((selectedPlan === 'professional'
                ? pricingPlans.professional.pricePerSeat
                : pricingPlans.enterprise.pricePerSeat) * 12 * seats).toLocaleString())}/year
            </p>
          </div>

          {/* Subscribe Button */}
          <button
            onClick={handleSubscribe}
            disabled={actionLoading}
            className="w-full bg-primary text-primary-foreground py-3 px-6 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center shadow-lg hover:shadow-xl"
          >
            {actionLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Subscribe to {selectedPlan === 'professional' ? 'Professional' : 'Enterprise'}
              </>
            )}
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default Subscription;
