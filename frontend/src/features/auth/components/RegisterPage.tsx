import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { joinWaitlist, PlanChoice, AgentInterest } from '../services/waitlistService';

const RegisterPage: React.FC = () => {
  const {
    email, setEmail,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = React.useState('');
  const [planChoice, setPlanChoice] = React.useState<PlanChoice>('own_api_key');
  const [agentInterests, setAgentInterests] = React.useState<AgentInterest[]>(['all']);
  const [submitted, setSubmitted] = React.useState(false);

  // Check if this is an IDE OAuth flow (JWT-based)
  const oauthToken = searchParams.get('oauth_token');
  const [oauthData, setOauthData] = React.useState<{state: string, redirect_uri: string} | null>(null);
  const isIdeFlow = !!oauthToken || !!oauthData;

  // Decode OAuth token on component mount
  React.useEffect(() => {
    if (oauthToken) {
      fetch('/api/auth/ide/decode-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oauth_token: oauthToken })
      })
      .then(res => res.json())
      .then(data => {
        if (data.state && data.redirect_uri) {
          setOauthData({ state: data.state, redirect_uri: data.redirect_uri });
          console.log('Decoded OAuth data:', data);
        }
      })
      .catch(err => {
        console.error('Failed to decode OAuth token:', err);
        setError('Invalid authentication request. Please try again from the IDE.');
      });
    }
  }, [oauthToken, setError]);

  // Important: Do not auto-login or navigate on session during waitlist period.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await joinWaitlist({
        email,
        full_name: fullName,
        plan_choice: planChoice,
        agent_interests: agentInterests,
        source: isIdeFlow ? 'ide' : 'web',
        metadata: { oauthTokenPresent: Boolean(oauthToken) }
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

  const toggleInterest = (value: AgentInterest) => {
    setAgentInterests((prev) => {
      // Handle 'all' as a special case
      if (value === 'all') return ['all'];
      const withoutAll = prev.filter((v) => v !== 'all');
      const has = withoutAll.includes(value);
      const next = has ? withoutAll.filter((v) => v !== value) : [...withoutAll, value];
      return next.length === 0 ? ['all'] as AgentInterest[] : next;
    });
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#333' }}>Thank you for signing up!</h2>
          </div>
          <p style={{ fontSize: '14px', color: '#444', lineHeight: 1.6 }}>
            You are now on our waiting list. We will review your request and get back to you ASAP with activation.
            Please keep an eye on your email. During this limited early-access period, login to the IDE and DuckCode Observability
            will be enabled after approval.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Join the waitlist</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>Request early access while we finish building</p>
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
        
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#2AB7A9', textDecoration: 'none', fontWeight: '500' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
;

export default RegisterPage;
