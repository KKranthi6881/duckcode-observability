import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../config/supabaseClient';
import { validatePassword } from '../../../utils/passwordValidation';

const RegisterPage: React.FC = () => {
  const {
    email, setEmail,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = React.useState('');
  const [organizationName, setOrganizationName] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordErrors, setPasswordErrors] = React.useState<string[]>([]);
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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    // Validate password requirements using utility
    const validation = validatePassword(newPassword);
    setPasswordErrors(validation.errors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password requirements
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError('Please meet all password requirements');
      return;
    }

    setIsLoading(true);
    try {
      // Register user
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, organizationName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || data.message || 'Registration failed');
      }

      // Store token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // ✅ CRITICAL: Sign in to Supabase to create session for RLS
      // Without this, auth.uid() returns NULL and RLS blocks all queries
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Failed to create Supabase session:', signInError);
        throw new Error('Registration successful but failed to sign in. Please login manually.');
      }

      console.log('✅ Supabase session created successfully');

      // If IDE flow, authorize and redirect back to IDE
      if (isIdeFlow && oauthData) {
        setRedirecting(true);
        await authorizeIDE(data.token, oauthData.state, oauthData.redirect_uri);
      } else {
        // Regular web signup - first user creates organization, becomes admin
        // Redirect to admin panel to set up organization (invite users, configure settings, etc.)
        navigate('/admin', {
          state: { message: 'Welcome! Your organization has been created. Set up your team and settings.' }
        });
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
      <div className="min-h-screen bg-[#f5f1e9] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[32px] border-2 border-[#e1dcd3] bg-white p-8 shadow-xl text-center">
          <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full border-4 border-[#f8f4ec] border-t-[#ff6a3c] animate-spin"></div>
          <h2 className="text-2xl font-bold text-[#0d0c0a] mb-3">Success! Redirecting to IDE...</h2>
          <p className="text-base text-[#59544c] mb-6">
            Your browser will ask to open VS Code. Click "Open" to complete authentication.
          </p>
          <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-200">
            <p className="text-sm text-blue-700">
              💡 If nothing happens, make sure VS Code is running and try clicking "Sign In" from the IDE.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          <h2 className="text-4xl font-bold text-[#0d0c0a] mb-2">Create your account</h2>
          <p className="text-base text-[#59544c]">{isIdeFlow ? 'Sign up to use DuckCode IDE' : 'Get started with DuckCode'}</p>
        </div>

        {/* Form Card */}
        <div className="rounded-[32px] border-2 border-[#e1dcd3] bg-white p-8 shadow-xl">
        
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-[#161413] mb-2">
                Full name
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#d6d2c9] bg-white text-base text-[#161413] transition focus:border-[#ff6a3c] focus:outline-none focus:ring-4 focus:ring-[#ff6a3c]/20"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label htmlFor="organizationName" className="block text-sm font-semibold text-[#161413] mb-2">
                Organization name
              </label>
              <input
                type="text"
                id="organizationName"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#d6d2c9] bg-white text-base text-[#161413] transition focus:border-[#ff6a3c] focus:outline-none focus:ring-4 focus:ring-[#ff6a3c]/20"
                placeholder="Acme Inc"
              />
              <p className="text-xs text-[#7b7469] mt-2">
                This will be your workspace name
              </p>
            </div>

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
              <label htmlFor="password" className="block text-sm font-semibold text-[#161413] mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={handlePasswordChange}
                required
                minLength={12}
                className={`w-full px-4 py-3 rounded-2xl border-2 bg-white text-base text-[#161413] transition focus:outline-none focus:ring-4 focus:ring-[#ff6a3c]/20 ${
                  passwordErrors.length > 0 && password.length > 0 
                    ? 'border-red-400 focus:border-red-500' 
                    : 'border-[#d6d2c9] focus:border-[#ff6a3c]'
                }`}
                placeholder="Enter a strong password"
              />
              
              {/* Password requirements checklist */}
              <div className="mt-3 space-y-2 text-xs">
                <div className="font-semibold text-[#161413] mb-2">Password must include:</div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={password.length >= 12 ? 'text-green-600' : 'text-gray-400'}>
                      {password.length >= 12 ? '✓' : '○'}
                    </span>
                    <span className={password.length >= 12 ? 'text-green-600 font-medium' : 'text-[#7b7469]'}>
                      At least 12 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={/[A-Z]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
                      {/[A-Z]/.test(password) ? '✓' : '○'}
                    </span>
                    <span className={/[A-Z]/.test(password) ? 'text-green-600 font-medium' : 'text-[#7b7469]'}>
                      One uppercase letter (A-Z)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={/[a-z]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
                      {/[a-z]/.test(password) ? '✓' : '○'}
                    </span>
                    <span className={/[a-z]/.test(password) ? 'text-green-600 font-medium' : 'text-[#7b7469]'}>
                      One lowercase letter (a-z)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={/[0-9]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
                      {/[0-9]/.test(password) ? '✓' : '○'}
                    </span>
                    <span className={/[0-9]/.test(password) ? 'text-green-600 font-medium' : 'text-[#7b7469]'}>
                      One number (0-9)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? 'text-green-600' : 'text-gray-400'}>
                      {/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? '✓' : '○'}
                    </span>
                    <span className={/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? 'text-green-600 font-medium' : 'text-[#7b7469]'}>
                      One special character (!@#$%^&*...)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-[#161413] mb-2">
                Confirm password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#d6d2c9] bg-white text-base text-[#161413] transition focus:border-[#ff6a3c] focus:outline-none focus:ring-4 focus:ring-[#ff6a3c]/20"
                placeholder="Confirm your password"
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
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-[#7b7469]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#ff6a3c] hover:text-[#d94a1e] transition">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
