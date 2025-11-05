import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { requestPasswordResetForEmail } from '../services/authService';

const ForgotPasswordPage: React.FC = () => {
  const { email, setEmail, error, setError, isLoading, setIsLoading } = useAuthForm();
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);
    try {
      const { error: requestError } = await requestPasswordResetForEmail(email);
      if (requestError) throw requestError;
      setMessage('If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send password reset email. Please try again.';
      setError(errorMessage);
      console.error('Password reset request error:', err);
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
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>
            </svg>
          </div>
          <h2 className="text-4xl font-bold text-[#0d0c0a] mb-2">Reset Password</h2>
          <p className="text-base text-[#59544c]">
            {message ? 'Check your email' : 'Enter your email to receive reset instructions'}
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-[32px] border-2 border-[#e1dcd3] bg-white p-8 shadow-xl">
          {message && (
            <div className="p-4 rounded-2xl bg-green-50 border-2 border-green-200 mb-6">
              <p className="text-sm font-medium text-green-700">{message}</p>
            </div>
          )}
          
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-200 mb-6">
              <p className="text-sm font-medium text-red-600">{error}</p>
            </div>
          )}
          
          {!message && (
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
              
              <button 
                type="submit" 
                disabled={isLoading} 
                className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-[#ff6a3c] to-[#d94a1e] text-base font-bold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
          
          <div className="mt-6 text-center">
            <p className="text-sm text-[#7b7469]">
              Remember your password?{' '}
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

export default ForgotPasswordPage;
