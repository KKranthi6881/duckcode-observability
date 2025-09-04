import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { signUpWithEmailPassword, signInWithGitHub } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage: React.FC = () => {
  const {
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  const navigate = useNavigate();
  const { session, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();

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

  useEffect(() => {
    if (!authLoading && session) {
      if (isIdeFlow && oauthToken) {
        // For IDE flow, redirect to authorization endpoint with JWT token and session
        const authUrl = `/api/auth/ide/authorize?oauth_token=${encodeURIComponent(oauthToken)}&session_token=${encodeURIComponent(session.access_token)}`;
        window.location.href = authUrl;
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [session, authLoading, navigate, isIdeFlow, oauthToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const { data, error: signUpError } = await signUpWithEmailPassword({ email, password });
      if (signUpError) throw signUpError;
      console.log('Registration successful', data.user);
      
      if (isIdeFlow) {
        // For IDE flow, the useEffect will handle the redirect after session is established
        alert('Registration successful! Redirecting back to IDE...');
      } else {
        alert('Registration successful! Please check your email to confirm your account if required, then login.');
        navigate('/login');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignUp = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithGitHub();
      // Success will be handled by useEffect when session updates
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign up with GitHub. Please try again.';
      setError(errorMessage);
      console.error('GitHub sign up error:', err);
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Create an account</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>Join us to get started</p>
        </div>
        
        <form onSubmit={handleSubmit}>
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
            <label htmlFor="password" style={{ fontSize: '14px', fontWeight: '500', color: '#333', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="••••••••"
            />
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="confirmPassword" style={{ fontSize: '14px', fontWeight: '500', color: '#333', display: 'block', marginBottom: '6px' }}>
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{ 
                width: '100%', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="••••••••"
            />
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
            {isLoading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
        
        <div style={{ position: 'relative', margin: '24px 0' }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: '#e5e7eb' }}></div>
          <div style={{ textAlign: 'center' }}>
            <span style={{ backgroundColor: 'white', padding: '0 8px', position: 'relative', fontSize: '14px', color: '#6B7280' }}>
              Or continue with
            </span>
          </div>
        </div>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          <button
            onClick={handleGitHubSignUp}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            <span>Sign up with GitHub</span>
          </button>
          
          <button
            disabled={true}
            style={{
              width: '100%',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: 'not-allowed',
              opacity: 0.7
            }}
          >
            <span>Sign up with SSO</span>
          </button>
        </div>
        
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
};

export default RegisterPage;
