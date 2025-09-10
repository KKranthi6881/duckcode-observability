import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../features/auth/hooks/useAuthForm';
import { joinWaitlist, PlanChoice, AgentInterest } from '../features/auth/services/waitlistService';

const IDERegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  
  const {
    email, setEmail,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  const [fullName, setFullName] = useState('');
  const [planChoice, setPlanChoice] = useState<PlanChoice>('own_api_key');
  const [agentInterests, setAgentInterests] = useState<AgentInterest[]>(['all']);
  const [submitted, setSubmitted] = useState(false);

  // Get OAuth parameters from URL
  const state = searchParams.get('state');
  const redirectUri = searchParams.get('redirect_uri');

  // During waitlist phase, do NOT auto-redirect or attempt IDE authorization.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state || !redirectUri) {
      setError('Missing OAuth parameters');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      await joinWaitlist({
        email,
        full_name: fullName,
        plan_choice: planChoice,
        agent_interests: agentInterests,
        source: 'ide',
        metadata: { state, redirect_uri: redirectUri }
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };
  // Do not redirect IDE users automatically; approval email will be sent later.

  const toggleInterest = (value: AgentInterest) => {
    setAgentInterests((prev) => {
      if (value === 'all') return ['all'];
      const withoutAll = prev.filter((v) => v !== 'all');
      const has = withoutAll.includes(value);
      const next = has ? withoutAll.filter((v) => v !== value) : [...withoutAll, value];
      return next.length === 0 ? ['all'] as AgentInterest[] : next;
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2"></circle>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01"></path>
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">Thanks for joining the waitlist!</h2>
              <p className="mt-2 text-sm text-gray-600">
                You're on our waiting list. We'll email you once your access is approved. You can close this window and return to your IDE.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Join the waitlist</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>IDE Early Access Request</p>
          {source === 'ide' && (
            <p style={{ fontSize: '12px', color: '#2AB7A9', marginTop: '4px' }}>
              IDE Authentication Flow
            </p>
          )}
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="fullName" style={{ fontSize: '14px', fontWeight: '500', color: '#333', display: 'block', marginBottom: '6px' }}>
              Full name (optional)
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="Jane Doe"
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="email" style={{ fontSize: '14px', fontWeight: '500', color: '#333', display: 'block', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="name@example.com"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="plan" style={{ fontSize: '14px', fontWeight: '500', color: '#333', display: 'block', marginBottom: '6px' }}>
              Access preference
            </label>
            <select
              id="plan"
              value={planChoice}
              onChange={(e) => setPlanChoice(e.target.value as PlanChoice)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '14px' }}
            >
              <option value="own_api_key">I have my own API key</option>
              <option value="free_50_pro">Give me 50 free credits (Pro)</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#333', marginBottom: '6px' }}>
              Which agent(s) are you most interested in?
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'data_architect', label: 'Data Architect' },
                { key: 'data_developer', label: 'Data Developer' },
                { key: 'data_troubleshooter', label: 'Data Troubleshooter' },
                { key: 'platform_dba', label: 'Platform/DBA' },
              ].map((opt) => (
                <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#333' }}>
                  <input
                    type="checkbox"
                    checked={agentInterests.includes(opt.key as AgentInterest)}
                    onChange={() => toggleInterest(opt.key as AgentInterest)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          
          {error && (
            <div style={{ padding: '10px', marginBottom: '16px', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '4px' }}>
              <p style={{ color: '#DC2626', fontSize: '14px', margin: 0 }}>{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#2AB7A9',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              marginBottom: '16px'
            }}
          >
            {isLoading ? 'Submitting...' : 'Join waitlist'}
          </button>
        </form>
        
        {/* Removed alternative signup methods for waitlist mode */}
        
        {/* Disabled alternative methods removed */}
        
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            Already have an account?{' '}
            <a 
              href={`/ide-login?source=ide&state=${searchParams.get('state')}&redirect_uri=${searchParams.get('redirect_uri')}`}
              style={{ color: '#2AB7A9', textDecoration: 'none', fontWeight: '500' }}
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default IDERegisterPage;
