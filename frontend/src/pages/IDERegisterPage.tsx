import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../features/auth/hooks/useAuthForm';
import { useAuth } from '../features/auth/contexts/AuthContext';
import { signUpWithEmailPassword } from '../features/auth/services/authService';

const IDERegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  const [authSuccess, setAuthSuccess] = useState(false);
  
  const {
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  
  const { session, user } = useAuth();

  // Get OAuth parameters from URL
  const state = searchParams.get('state');
  const redirectUri = searchParams.get('redirect_uri');

  // Handle successful authentication - redirect to IDE
  useEffect(() => {
    if (session && state && redirectUri) {
      // For IDE flow, redirect to authorization endpoint with session token
      const authUrl = `/api/auth/ide/authorize?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}&session_token=${encodeURIComponent(session.access_token)}`;
      window.location.href = authUrl;
      setAuthSuccess(true);
    }
  }, [session, state, redirectUri]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return;
    }
    
    if (!state || !redirectUri) {
      setError('Missing OAuth parameters');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    
    try {
      // Use the same working registration method as the main RegisterPage
      const { data, error: signUpError } = await signUpWithEmailPassword({ email, password });
      if (signUpError) throw signUpError;
      console.log('Registration successful', data.user);
      
      // The useEffect will handle the redirect after session is established
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // If already authenticated and this is an IDE request, redirect immediately
  useEffect(() => {
    if (session && user) {
      const state = searchParams.get('state');
      const redirectUri = searchParams.get('redirect_uri');
      
      if (state && redirectUri && redirectUri.startsWith('vscode://')) {
        // Use OAuth authorization code flow for existing session
        fetch('http://localhost:3001/api/auth/ide/authorize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            state,
            redirect_uri: redirectUri 
          }),
        })
        .then(response => response.json())
        .then(authData => {
          if (authData.code) {
            const ideUrl = `${redirectUri}?code=${encodeURIComponent(authData.code)}&state=${encodeURIComponent(state)}`;
            window.location.href = ideUrl;
            setAuthSuccess(true);
          }
        })
        .catch(console.error);
      }
    }
  }, [session, user, searchParams]);

  if (authSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">Registration Successful!</h2>
              <p className="mt-2 text-sm text-gray-600">
                Your account has been created successfully. You can now close this window and return to your IDE.
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
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Create an account</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>Join us to get started</p>
          {source === 'ide' && (
            <p style={{ fontSize: '12px', color: '#2AB7A9', marginTop: '4px' }}>
              IDE Authentication Flow
            </p>
          )}
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
