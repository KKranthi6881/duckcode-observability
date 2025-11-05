import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { useAuth } from '../contexts/AuthContext';
import { signInWithEmailPassword, signInWithGitHub } from '../services/authService';
import { supabase } from '@/config/supabaseClient';

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
  
  // Decode OAuth token and check for existing session on component mount
  React.useEffect(() => {
    const handleOAuthAndSession = async () => {
      if (oauthToken) {
        try {
          // Decode OAuth token
          const response = await fetch('/api/auth/ide/decode-oauth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oauth_token: oauthToken })
          });
          const data = await response.json();
          
          if (data.state && data.redirect_uri) {
            setOauthData({ state: data.state, redirect_uri: data.redirect_uri });
            console.log('Decoded OAuth data:', data);
            
            // Immediately check for existing session
            const { data: { session: existingSession } } = await supabase.auth.getSession();
            if (existingSession?.access_token) {
              console.log('LoginPage: Existing session detected during OAuth decode, redirecting immediately');
              
              // Redirect immediately to authorization endpoint
              const authUrl = `/api/auth/ide/authorize?oauth_token=${encodeURIComponent(oauthToken)}`;
              const authUrlWithToken = `${authUrl}&session_token=${encodeURIComponent(existingSession.access_token)}`;
              
              window.location.href = authUrlWithToken;
              return; // Exit early to prevent further processing
            }
          }
        } catch (err) {
          console.error('Failed to decode OAuth token:', err);
          setError('Invalid authentication request. Please try again from the IDE.');
        }
      }
    };

    handleOAuthAndSession();
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
          console.log('LoginPage: Regular web auth, redirecting to dashboard');
          // Regular web authentication - go to main dashboard
          // Admin users can navigate to admin panel from there
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
    <div className="min-h-screen bg-[#f5f1e9] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-[#0d0c0a] mb-2">Welcome Back</h2>
          <p className="text-base text-[#59544c]">Sign in to continue to DuckCode</p>
        </div>

        {/* Form Card */}
        <div className="rounded-[32px] border-2 border-[#e1dcd3] bg-white p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[#161413] mb-2">
                Email address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#d6d2c9] bg-white text-base text-[#161413] transition focus:border-[#ff6a3c] focus:outline-none focus:ring-4 focus:ring-[#ff6a3c]/20"
                placeholder="name@example.com"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="password" className="block text-sm font-semibold text-[#161413]">
                  Password
                </label>
                <Link to="/forgot-password" className="text-sm font-medium text-[#ff6a3c] hover:text-[#d94a1e] transition">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#d6d2c9] bg-white text-base text-[#161413] transition focus:border-[#ff6a3c] focus:outline-none focus:ring-4 focus:ring-[#ff6a3c]/20"
                placeholder="••••••••"
              />
            </div>
            
            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200">
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] text-base font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? 'Logging in...' : 'Sign in'}
            </button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e1dcd3]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-[#7b7469] font-medium">Or continue with</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handleGitHubSignIn}
              disabled={isLoading}
              className="w-full px-6 py-3 rounded-2xl bg-white border-2 border-[#d6d2c9] text-base font-semibold text-[#161413] transition-all duration-300 hover:border-[#ff6a3c] hover:bg-[#fff4ee] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign in with GitHub
            </button>
            
            <button
              disabled={true}
              className="w-full px-6 py-3 rounded-2xl bg-white border-2 border-[#e1dcd3] text-base font-semibold text-[#7b7469] cursor-not-allowed opacity-50"
            >
              Sign in with SSO (Coming soon)
            </button>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-[#7b7469]">
              Need an account?{' '}
              <Link to="/register" className="font-semibold text-[#ff6a3c] hover:text-[#d94a1e] transition">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
