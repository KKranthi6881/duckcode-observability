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
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email. Please try again.');
      console.error('Password reset request error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '20px' }}>
      <h2>Forgot Password</h2>
      {message && <p style={{ color: 'green', marginBottom: '10px' }}>{message}</p>}
      {error && <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}
      {!message && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="email">Enter your email address:</label><br />
            <input 
              type="email" 
              id="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              style={{ width: '100%', padding: '8px' }} 
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading} 
            style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            {isLoading ? 'Sending...' : 'Send Password Reset Email'}
          </button>
        </form>
      )}
      <p style={{ marginTop: '15px' }}>
        Remember your password? <Link to="/login">Login</Link>
      </p>
    </div>
  );
};

export default ForgotPasswordPage;
