import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { useAuth } from '../contexts/AuthContext';
import { signInWithEmailPassword, signInWithGitHub } from '../services/authService';

const LoginPage: React.FC = () => {
  const {
    email, setEmail,
    password, setPassword,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  
  // Check if this is an IDE OAuth authorization request (JWT-based)
  const oauthToken = searchParams.get('oauth_token');
  const [oauthData, setOauthData] = React.useState<{state: string, redirect_uri: string} | null>(null);
  const isIdeAuth = !!oauthToken || !!oauthData;
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { data, error: signInError } = await signInWithEmailPassword({ email, password });
      if (signInError) throw signInError;
      console.log('Login successful', data.session);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to login. Please check your credentials.';
      setError(errorMessage);
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleAuth = async () => {
      console.log('LoginPage: useEffect triggered', { 
        hasSession: !!session, 
        session, 
        isIdeAuth, 
        oauthData 
      });
      
      // Prevent infinite redirects by checking if we already processed this session
      const processedSessionId = sessionStorage.getItem('processedSessionId');
      const currentSessionId = session?.access_token?.slice(-10); // Use last 10 chars as ID
      
      if (session && processedSessionId !== currentSessionId) {
        console.log('LoginPage: Session detected', { 
          session, 
          isIdeAuth, 
          oauthData,
          sessionKeys: Object.keys(session),
          accessToken: session.access_token,
          user: session.user
        });
        
        if (isIdeAuth && oauthData) {
          // OAuth-style IDE authentication - redirect to backend authorization endpoint
          console.log('LoginPage: OAuth IDE auth detected, redirecting to authorization endpoint');
          sessionStorage.setItem('processedSessionId', currentSessionId || '');
          
          // For IDE flows, redirect directly to authorization endpoint
          const authUrl = `/api/auth/ide/authorize?oauth_token=${encodeURIComponent(oauthToken || '')}`;
          console.log('LoginPage: Redirecting to authorization endpoint:', authUrl);
          
          // Add session token as query parameter for authentication
          const authUrlWithToken = `${authUrl}&session_token=${encodeURIComponent(session.access_token)}`;
          
          // Direct redirect - backend will handle the IDE callback
          window.location.href = authUrlWithToken;
        } else {
          console.log('LoginPage: Regular web auth, going to dashboard');
          // Regular web authentication, go to dashboard
          navigate('/dashboard');
        }
      } else {
        console.log('LoginPage: No session detected yet');
      }
    };

    handleAuth();
  }, [session, navigate, isIdeAuth, oauthData, oauthToken, setError]);

  const handleGitHubSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      // Preserve IDE parameters in GitHub OAuth redirect
      const currentUrl = window.location.href;
      await signInWithGitHub(currentUrl);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in with GitHub.';
      setError(errorMessage);
      console.error('GitHub Sign-in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Welcome Back</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>Sign in to your account</p>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label htmlFor="password" style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                Password
              </label>
              <Link to="/forgot-password" style={{ fontSize: '14px', color: '#2AB7A9', textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
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
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'Logging in...' : 'Sign in'}
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
            onClick={handleGitHubSignIn}
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
            <span>Sign in with GitHub</span>
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
            <span>Sign in with SSO</span>
          </button>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            Need an account?{' '}
            <Link to="/register" style={{ color: '#2AB7A9', textDecoration: 'none', fontWeight: '500' }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
