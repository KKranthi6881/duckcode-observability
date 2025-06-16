import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthForm } from '../hooks/useAuthForm';
import { updateUserPassword } from '../services/authService';
import { useAuth } from '../contexts/AuthContext'; // To check session state

const ResetPasswordPage: React.FC = () => {
  const {
    password, setPassword,
    confirmPassword, setConfirmPassword,
    error, setError,
    isLoading, setIsLoading,
  } = useAuthForm();
  const { session, isLoading: isAuthLoading } = useAuth(); // Get session from AuthContext
  const navigate = useNavigate();
  const [message, setMessage] = React.useState<string | null>(null);

  useEffect(() => {
    // This page should only be accessible if Supabase has initiated a password recovery session.
    // The onAuthStateChange listener in AuthContext handles setting the session when the user
    // lands on this page after clicking the email link (event: PASSWORD_RECOVERY).
    // If there's no session and auth is not loading, it might mean the user accessed this page directly.
    if (!isAuthLoading && !session) {
      // setError('Invalid or expired password reset link. Please request a new one.');
      // It might be better to redirect to login or forgot-password page silently
      // Or display a generic message and a link to request a new reset.
      // For now, we'll allow rendering the form, Supabase will error if token is invalid.
    }
  }, [session, isAuthLoading, navigate, setError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return;
    }
    setError(null);
    setMessage(null);
    setIsLoading(true);
    try {
      const { error: updateError } = await updateUserPassword(password);
      if (updateError) throw updateError;
      setMessage('Your password has been successfully updated! You can now login with your new password.');
      // Optionally, navigate to login after a short delay or let user click
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. The reset link may be invalid or expired.');
      console.error('Password update error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '400px', margin: 'auto', padding: '20px' }}>
      <h2>Reset Your Password</h2>
      {message && <p style={{ color: 'green', marginBottom: '10px' }}>{message}</p>}
      {error && <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}
      {!message && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="password">New Password:</label><br />
            <input 
              type="password" 
              id="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor="confirmPassword">Confirm New Password:</label><br />
            <input 
              type="password" 
              id="confirmPassword" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '8px' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading} 
            style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            {isLoading ? 'Updating Password...' : 'Update Password'}
          </button>
        </form>
      )}
      {message && (
        <p style={{ marginTop: '15px' }}>
          <Link to="/login">Proceed to Login</Link>
        </p>
      )}
    </div>
  );
};

export default ResetPasswordPage;
