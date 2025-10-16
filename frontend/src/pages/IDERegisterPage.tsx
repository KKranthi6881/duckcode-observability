import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthForm } from '../features/auth/hooks/useAuthForm';
import { supabase } from '../config/supabaseClient';

const IDERegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  
  const {
    email, setEmail,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  // Get OAuth parameters from URL
  const state = searchParams.get('state');
  const redirectUri = searchParams.get('redirect_uri');

  // Validate password and return all errors
  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    
    if (pwd.length < 12) {
      errors.push('At least 12 characters');
    }
    if (!/[A-Z]/.test(pwd)) {
      errors.push('One uppercase letter (A-Z)');
    }
    if (!/[a-z]/.test(pwd)) {
      errors.push('One lowercase letter (a-z)');
    }
    if (!/[0-9]/.test(pwd)) {
      errors.push('One number (0-9)');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) {
      errors.push('One special character (!@#$%^&*...)');
    }
    
    return errors;
  };

  // Update password errors in real-time
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    if (newPassword.length > 0) {
      const errors = validatePassword(newPassword);
      setPasswordErrors(errors);
    } else {
      setPasswordErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!state || !redirectUri) {
      setError('Missing OAuth parameters. Please try again from the IDE.');
      return;
    }

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Enterprise password policy validation
    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      setError('Password must contain at least one number');
      return;
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      setError('Password must contain at least one special character');
      return;
    }
    
    setError(null);
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
        // Handle specific error cases with helpful messages
        if (response.status === 400) {
          if (data.msg?.includes('already exists')) {
            throw new Error('This email is already registered. Please sign in instead or use a different email.');
          }
          if (data.errors && Array.isArray(data.errors)) {
            // Validation errors from express-validator
            const errorMessages = data.errors.map((err: { msg: string }) => err.msg).join(', ');
            throw new Error(errorMessages);
          }
          throw new Error(data.msg || data.message || 'Invalid registration data. Please check all fields.');
        }
        if (response.status === 429) {
          throw new Error('Too many registration attempts. Please try again in a few minutes.');
        }
        throw new Error(data.msg || data.message || 'Registration failed. Please try again.');
      }

      // Create Supabase session for browser (enables SaaS auto-login)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        console.warn('Failed to create Supabase session:', signInError);
        // Don't fail registration - user can still log in manually
      }

      // Automatically authorize IDE
      const authResponse = await fetch('/api/auth/ide/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${data.token}`
        },
        body: JSON.stringify({ state, redirect_uri: redirectUri })
      });

      const authData = await authResponse.json();

      if (!authResponse.ok) {
        throw new Error(authData.msg || 'Failed to authorize IDE');
      }

      // Redirect back to IDE with authorization code
      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set('code', authData.code);
      redirectUrl.searchParams.set('state', state);
      window.location.href = redirectUrl.toString();
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to register. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#333', marginBottom: '8px' }}>Create your account</h2>
          <p style={{ fontSize: '14px', color: '#666' }}>Sign up to use DuckCode IDE</p>
          {source === 'ide' && (
            <p style={{ fontSize: '12px', color: '#2AB7A9', marginTop: '4px' }}>
              🔒 Secure IDE Authentication
            </p>
          )}
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
              onChange={handlePasswordChange}
              required
              minLength={12}
              style={{ 
                width: '100%', 
                padding: '8px 12px',
                borderRadius: '4px',
                border: passwordErrors.length > 0 && password.length > 0 ? '1px solid #EF4444' : '1px solid #ddd',
                fontSize: '14px'
              }}
              placeholder="Enter a strong password"
            />
            
            {/* Password requirements checklist */}
            <div style={{ marginTop: '8px', fontSize: '12px' }}>
              <div style={{ fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Password must include:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: password.length >= 12 ? '#10B981' : '#9CA3AF' }}>
                    {password.length >= 12 ? '✓' : '○'}
                  </span>
                  <span style={{ color: password.length >= 12 ? '#10B981' : '#6B7280' }}>
                    At least 12 characters
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: /[A-Z]/.test(password) ? '#10B981' : '#9CA3AF' }}>
                    {/[A-Z]/.test(password) ? '✓' : '○'}
                  </span>
                  <span style={{ color: /[A-Z]/.test(password) ? '#10B981' : '#6B7280' }}>
                    One uppercase letter (A-Z)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: /[a-z]/.test(password) ? '#10B981' : '#9CA3AF' }}>
                    {/[a-z]/.test(password) ? '✓' : '○'}
                  </span>
                  <span style={{ color: /[a-z]/.test(password) ? '#10B981' : '#6B7280' }}>
                    One lowercase letter (a-z)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: /[0-9]/.test(password) ? '#10B981' : '#9CA3AF' }}>
                    {/[0-9]/.test(password) ? '✓' : '○'}
                  </span>
                  <span style={{ color: /[0-9]/.test(password) ? '#10B981' : '#6B7280' }}>
                    One number (0-9)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? '#10B981' : '#9CA3AF' }}>
                    {/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? '✓' : '○'}
                  </span>
                  <span style={{ color: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) ? '#10B981' : '#6B7280' }}>
                    One special character (!@#$%^&*...)
                  </span>
                </div>
              </div>
            </div>
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
              minLength={12}
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
            <div style={{ 
              padding: '12px', 
              marginBottom: '16px', 
              backgroundColor: '#FEE2E2', 
              border: '1px solid #EF4444', 
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <span style={{ color: '#DC2626', fontSize: '18px', lineHeight: '1' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#DC2626', fontSize: '14px', fontWeight: '500', margin: '0 0 4px 0' }}>
                  Registration Error
                </p>
                <p style={{ color: '#991B1B', fontSize: '13px', margin: 0 }}>
                  {error}
                </p>
              </div>
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
