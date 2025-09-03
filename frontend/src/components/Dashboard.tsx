import React, { useState, useEffect } from 'react';
import './Dashboard.css';

interface UsageData {
  tokens: {
    used: number;
    limit: number;
    percentage: number;
  };
  requests: {
    used: number;
    limit: number;
    percentage: number;
  };
  cost: number;
}

interface BillingInfo {
  user: {
    id: string;
    email: string;
    subscriptionTier: string;
  };
  currentTier: {
    name: string;
    monthlyPrice: number;
    tokenLimit: number;
    requestLimit: number;
    features: string[];
  };
  usage: UsageData;
  billingPeriod: {
    start: string;
    end: string;
  };
}

interface AnalyticsData {
  period: string;
  dailyUsage: Array<{
    _id: string;
    tokens: number;
    requests: number;
    cost: number;
  }>;
  modelUsage: Array<{
    _id: string;
    tokens: number;
    requests: number;
    cost: number;
  }>;
  errorRate: number;
  summary: {
    totalTokens: number;
    totalRequests: number;
    totalCost: number;
    averageTokensPerRequest: number;
  };
}

const Dashboard: React.FC = () => {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('30d');

  useEffect(() => {
    fetchBillingInfo();
    fetchAnalytics();
  }, [selectedPeriod]);

  const fetchBillingInfo = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/billing/info', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBillingInfo(data);
      } else {
        setError('Failed to fetch billing information');
      }
    } catch (err) {
      setError('Error fetching billing information');
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/billing/analytics?period=${selectedPeriod}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else if (response.status === 403) {
        // User doesn't have enterprise access
        setAnalytics(null);
      } else {
        setError('Failed to fetch analytics');
      }
    } catch (err) {
      setError('Error fetching analytics');
    } finally {
      setLoading(false);
    }
  };

  const upgradeSubscription = async (tier: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tier })
      });

      if (response.ok) {
        await fetchBillingInfo();
        alert('Subscription upgraded successfully!');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to upgrade subscription');
      }
    } catch (err) {
      alert('Error upgrading subscription');
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="dashboard-error">Error: {error}</div>;
  }

  if (!billingInfo) {
    return <div className="dashboard-error">No billing information available</div>;
  }

  return (
    <div className="dashboard">
      <h1>DuckCode Usage Dashboard</h1>
      
      {/* User Info */}
      <div className="dashboard-section">
        <h2>Account Information</h2>
        <div className="account-info">
          <p><strong>Email:</strong> {billingInfo.user.email}</p>
          <p><strong>Plan:</strong> {billingInfo.currentTier.name} (${billingInfo.currentTier.monthlyPrice}/month)</p>
          <p><strong>Billing Period:</strong> {new Date(billingInfo.billingPeriod.start).toLocaleDateString()} - {new Date(billingInfo.billingPeriod.end).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="dashboard-section">
        <h2>Current Usage</h2>
        <div className="usage-cards">
          <div className="usage-card">
            <h3>Tokens</h3>
            <div className="usage-bar">
              <div 
                className="usage-fill" 
                style={{ width: `${Math.min(billingInfo.usage.tokens.percentage, 100)}%` }}
              ></div>
            </div>
            <p>{billingInfo.usage.tokens.used.toLocaleString()} / {billingInfo.usage.tokens.limit.toLocaleString()}</p>
            <p className="usage-percentage">{billingInfo.usage.tokens.percentage.toFixed(1)}% used</p>
          </div>
          
          <div className="usage-card">
            <h3>Requests</h3>
            <div className="usage-bar">
              <div 
                className="usage-fill" 
                style={{ width: `${Math.min(billingInfo.usage.requests.percentage, 100)}%` }}
              ></div>
            </div>
            <p>{billingInfo.usage.requests.used.toLocaleString()} / {billingInfo.usage.requests.limit.toLocaleString()}</p>
            <p className="usage-percentage">{billingInfo.usage.requests.percentage.toFixed(1)}% used</p>
          </div>
          
          <div className="usage-card">
            <h3>Cost</h3>
            <p className="cost-amount">${billingInfo.usage.cost.toFixed(4)}</p>
            <p>This billing period</p>
          </div>
        </div>
      </div>

      {/* Plan Features */}
      <div className="dashboard-section">
        <h2>Plan Features</h2>
        <ul className="features-list">
          {billingInfo.currentTier.features.map((feature, index) => (
            <li key={index}>{feature}</li>
          ))}
        </ul>
      </div>

      {/* Upgrade Options */}
      {billingInfo.user.subscriptionTier !== 'enterprise' && (
        <div className="dashboard-section">
          <h2>Upgrade Your Plan</h2>
          <div className="upgrade-options">
            {billingInfo.user.subscriptionTier === 'free' && (
              <button 
                className="upgrade-btn pro"
                onClick={() => upgradeSubscription('pro')}
              >
                Upgrade to Pro - $29/month
              </button>
            )}
            <button 
              className="upgrade-btn enterprise"
              onClick={() => upgradeSubscription('enterprise')}
            >
              Upgrade to Enterprise - $199/month
            </button>
          </div>
        </div>
      )}

      {/* Enterprise Analytics */}
      {billingInfo.user.subscriptionTier === 'enterprise' && analytics && (
        <div className="dashboard-section">
          <h2>Usage Analytics</h2>
          
          <div className="analytics-controls">
            <select 
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>

          <div className="analytics-summary">
            <div className="summary-card">
              <h4>Total Tokens</h4>
              <p>{analytics.summary.totalTokens.toLocaleString()}</p>
            </div>
            <div className="summary-card">
              <h4>Total Requests</h4>
              <p>{analytics.summary.totalRequests.toLocaleString()}</p>
            </div>
            <div className="summary-card">
              <h4>Total Cost</h4>
              <p>${analytics.summary.totalCost.toFixed(4)}</p>
            </div>
            <div className="summary-card">
              <h4>Error Rate</h4>
              <p>{analytics.errorRate.toFixed(2)}%</p>
            </div>
          </div>

          <div className="analytics-charts">
            <div className="chart-section">
              <h4>Model Usage</h4>
              <div className="model-usage">
                {analytics.modelUsage.map((model, index) => (
                  <div key={index} className="model-item">
                    <span className="model-name">{model._id}</span>
                    <span className="model-tokens">{model.tokens.toLocaleString()} tokens</span>
                    <span className="model-cost">${model.cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
