import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext'; 
import { useNavigate, Link } from 'react-router-dom'; 

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { register, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const { data, error: registrationError } = await register(email, password);
      if (registrationError) {
        setError(registrationError.message);
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        setSuccessMessage('Registration successful! Please check your email to confirm your account.');
      } else if (data.user) {
        navigate('/dashboard'); 
      } else {
        setSuccessMessage('Registration successful! Please proceed to login or check your email.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during registration.');
    }
    setLoading(false);
  };

  if (authLoading || (!authLoading && user)) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <div style={{ padding: '40px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '24px', color: '#333' }}>Create Account</h1>
        {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '16px' }}>{error}</p>}
        {successMessage && <p style={{ color: 'green', textAlign: 'center', marginBottom: '16px' }}>{successMessage}</p>}
        {!successMessage && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="email" style={{ display: 'block', marginBottom: '8px', color: '#555' }}>Email Address</label>
              <input 
                type="email" 
                id="email" 
                name="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} 
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="password" style={{ display: 'block', marginBottom: '8px', color: '#555' }}>Password</label>
              <input 
                type="password" 
                id="password" 
                name="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} 
              />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '8px', color: '#555' }}>Confirm Password</label>
              <input 
                type="password" 
                id="confirmPassword" 
                name="confirmPassword" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} 
              />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', backgroundColor: '#2AB7A9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        )}
        <p style={{ textAlign: 'center', marginTop: '20px', color: '#555' }}>
          Already have an account? <Link to="/login" style={{ color: '#2AB7A9', textDecoration: 'none' }}>Log In</Link> 
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
