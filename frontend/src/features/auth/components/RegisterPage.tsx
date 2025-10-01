import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { useNavigate } from 'react-router-dom';

const RegisterPage: React.FC = () => {
  const {
    email, setEmail,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [redirecting, setRedirecting] = React.useState(false);
  const navigate = useNavigate();

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

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      // Register user
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || data.message || 'Registration failed');
      }

      // Store token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // If IDE flow, authorize and redirect back to IDE
      if (isIdeFlow && oauthData) {
        setRedirecting(true);
        await authorizeIDE(data.token, oauthData.state, oauthData.redirect_uri);
      } else {
        // Regular web signup - redirect to dashboard
        navigate('/dashboard');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const authorizeIDE = async (token: string, state: string, redirectUri: string) => {
    try {
      // Call IDE authorize endpoint
      const response = await fetch('/api/auth/ide/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ state, redirect_uri: redirectUri })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Failed to authorize IDE');
      }

      // Redirect back to IDE with authorization code
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('code', data.code);
      redirectUrl.searchParams.set('state', state);
      
      // Redirect immediately
      window.location.href = redirectUrl.toString();
    } catch (err) {
      console.error('IDE authorization error:', err);
      setRedirecting(false);
      setIsLoading(false);
      setError('Registration successful, but IDE authorization failed. Please try logging in from the IDE.');
    }
  };


  if (redirecting) {
    return (
      <div style={{ maxWidth: '400px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '4px solid #f3f3f3', borderTop: '4px solid #2AB7A9', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Success! Redirecting to IDE...</h2>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            Your browser will ask to open VS Code. Click "Open" to complete authentication.
          </p>
          <div style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
            <p style={{ fontSize: '12px', color: '#1e40af', margin: 0 }}>
              💡 If nothing happens, make sure VS Code is running and try clicking "Sign In" from the IDE.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Create your account</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>{isIdeFlow ? 'Sign up to use DuckCode IDE' : 'Get started with DuckCode'}</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="fullName" style={{ fontSize: '14px', fontWeight: '500', color: '#333', display: 'block', marginBottom: '6px' }}>
              Full name
            </label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
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
            <label htmlFor="password" style={{ fontSize: '14px', fontWeight: '500', color: '#333', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ 
                width: '100%', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="At least 6 characters"
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="confirmPassword" style={{ fontSize: '14px', fontWeight: '500', color: '#333', display: 'block', marginBottom: '6px' }}>
              Confirm password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              style={{ 
                width: '100%', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="Confirm your password"
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
            {isLoading ? 'Creating account...' : 'Create account'}
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
