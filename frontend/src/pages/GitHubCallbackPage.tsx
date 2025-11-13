import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/contexts/AuthContext';
import { supabase } from '../config/supabaseClient'; // Import supabase client for token access

const GitHubCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'success' | 'error' | 'loading'>('loading');
  const [message, setMessage] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Force an immediate state update based on URL parameters
  // This helps ensure we don't get stuck in loading state
  useEffect(() => {
    // Enhanced debugging logs
    console.log('GitHubCallbackPage: Received query params:', Object.fromEntries(searchParams.entries()));
    console.log('GitHubCallbackPage: Current auth user:', user);
    
    const installationStatus = searchParams.get('status');
    const installationId = searchParams.get('installation_id');
    const error = searchParams.get('error');
    const recovery = searchParams.get('recovery');
    
    console.log('GitHubCallbackPage: Parsed parameters:', { installationStatus, installationId, error, recovery });

    // IMPORTANT: Immediately detect and handle recovery mode, don't wait for timeouts
    if (recovery === 'needed' && installationId) {
      console.log('GitHubCallbackPage: Immediately setting recovery mode');
      setStatus('error'); // Change this from 'loading' to 'error' to show the recovery UI
      setRecoveryMode(true);
      setMessage('The GitHub installation couldn\'t be automatically linked to your account due to a session issue. Please click the "Link to My Account" button below to complete the setup.');
      return; // Exit early to avoid setting timeout
    }

    // Set a timeout to ensure we don't stay in loading state forever
    const timeout = setTimeout(() => {
      if (status === 'loading') {
        console.log('GitHubCallbackPage: Timeout triggered, changing to error state');
        setStatus('error');
        setMessage('Timeout waiting for GitHub response. Please try again.');
      }
    }, 10000); // Extended to 10 seconds for debugging

    if (installationStatus === 'success' && installationId) {
      console.log('GitHubCallbackPage: Setting success state');
      setStatus('success');
      setMessage(`GitHub App successfully installed with ID: ${installationId}. Redirecting to dashboard...`);
      // AUTOMATICALLY REDIRECT TO DASHBOARD AFTER A SHORT DELAY
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000); // 3-second delay to allow user to read message
    } else if (installationStatus === 'error' || error) {
      console.log('GitHubCallbackPage: Setting error state');
      setStatus('error');
      
      // Special case for recovery needed - this should already be handled above now
      if (recovery === 'needed' && installationId) {
        console.log('GitHubCallbackPage: Recovery mode needed');
        setRecoveryMode(true);
        setMessage('The GitHub installation couldn\'t be automatically linked to your account due to a session issue. Please click the "Link to My Account" button below to complete the setup.');
      } else {
        setMessage(error || 'An unknown error occurred during the GitHub App installation. Please try again.');
      }
    } else {
      // IMPORTANT: Handle the case where no recognizable parameters are received
      console.log('GitHubCallbackPage: No recognizable status parameters, will rely on timeout to exit loading state');
    }

    return () => clearTimeout(timeout);
  }, [searchParams, navigate]); // Remove status and user dependencies to avoid circular updates
  
  // Handle the manual linking of a GitHub installation to the current user
  const handleManualLink = async () => {
    const installationId = searchParams.get('installation_id');
    
    console.log('GitHubCallbackPage: Attempting manual link', { installationId, user });
    
    if (!installationId || !user) {
      setStatus('error');
      setMessage('Cannot link GitHub installation: missing installation ID or user not logged in.');
      return;
    }
    
    setStatus('loading');
    setMessage('Linking GitHub installation to your account...');
    
    try {
      // Get the current user's session token for authorization
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      if (!token) {
        console.error('No authorization token available. Cannot link GitHub installation.');
        setStatus('error');
        setMessage('Authentication error. Please try logging out and back in.');
        return;
      }

      // Call backend endpoint to manually link this installation to the current user
      console.log(`GitHubCallbackPage: Calling API to link installation ${installationId}`);
      
      const response = await fetch(`/api/github/manual-link-installation?installation_id=${installationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Add authorization header
        },
        credentials: 'include', // Important to include cookies/session
      });
      
      console.log(`GitHubCallbackPage: Received response`, { status: response.status, ok: response.ok });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`Error linking installation: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('GitHubCallbackPage: Successful response data', data);
      
      setStatus('success');
      setMessage(`GitHub App successfully linked to your account! Installation ID: ${installationId}`);
    } catch (error) {
      console.error('Error linking GitHub installation:', error);
      setStatus('error');
      setMessage(`Failed to link GitHub installation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1>Processing GitHub Installation...</h1>
          <div style={{ marginTop: '1rem', width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p>{message}</p>
          {/* Add a debug section to show what params we received */}
          <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#666', maxWidth: '90%', wordBreak: 'break-word' }}>
            <p>Debug Info:</p>
            <div>
              {Array.from(searchParams.entries()).map(([key, value]) => (
                <div key={key}><strong>{key}:</strong> {value}</div>
              ))}
              <div><strong>User logged in:</strong> {user ? 'Yes' : 'No'}</div>
              <div><strong>Recovery mode:</strong> {recoveryMode ? 'Yes' : 'No'}</div>
              <button 
                onClick={() => window.location.reload()} 
                style={{ 
                  marginTop: '1rem', 
                  padding: '0.25rem 0.5rem', 
                  backgroundColor: '#757575', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer',
                  fontSize: '0.7rem'
                }}
              >
                Force Refresh
              </button>
            </div>
          </div>
        </div>
      )}
      {status === 'success' && (
        <div style={{ textAlign: 'center', padding: '2rem', border: '1px solid #4caf50', borderRadius: '8px', backgroundColor: '#f1f8e9' }}>
          <h1 style={{ color: '#4caf50' }}>Installation Successful!</h1>
          <p>{message}</p>
          <Link to="/dashboard" style={{ marginTop: '1rem', display: 'inline-block', padding: '0.5rem 1rem', backgroundColor: '#4caf50', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
            Go to Dashboard
          </Link>
        </div>
      )}
      {status === 'error' && (
        <div style={{ textAlign: 'center', padding: '2rem', border: '1px solid #f44336', borderRadius: '8px', backgroundColor: '#ffebee' }}>
          <h1 style={{ color: '#f44336' }}>{recoveryMode ? 'Action Required' : 'Installation Failed'}</h1>
          <p>{message}</p>
          
          {recoveryMode ? (
            <div style={{ marginTop: '1.5rem' }}>
              <button 
                onClick={handleManualLink} 
                style={{ 
                  padding: '0.5rem 1.5rem', 
                  backgroundColor: '#2196F3', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer', 
                  marginRight: '10px',
                  fontSize: '1rem',
                  fontWeight: 'bold'
                }}
                disabled={!user}
              >
                {user ? 'Link to My Account' : 'Please Login First'}
              </button>
              <Link 
                to="/dashboard/profile" 
                style={{ 
                  marginTop: '1rem', 
                  display: 'inline-block', 
                  padding: '0.5rem 1rem', 
                  backgroundColor: '#757575', 
                  color: 'white', 
                  textDecoration: 'none', 
                  borderRadius: '4px' 
                }}
              >
                Cancel
              </Link>
            </div>
          ) : (
            <div>
              <Link to="/dashboard/profile" style={{ marginTop: '1rem', display: 'inline-block', padding: '0.5rem 1rem', backgroundColor: '#f44336', color: 'white', textDecoration: 'none', borderRadius: '4px', marginRight: '10px' }}>
                Go to Profile
              </Link>
              <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GitHubCallbackPage;
