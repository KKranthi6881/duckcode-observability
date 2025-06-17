import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/contexts/AuthContext';
import { supabase } from '@/config/supabaseClient'; // Import supabase client for token access

// This is a simplified debug component to help identify GitHub callback issues
const GitHubCallbackDebugPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    // Log all information on mount
    console.log('DEBUG PAGE: GitHub Callback Debug Page Mounted');
    console.log('DEBUG PAGE: Current URL parameters:', Object.fromEntries(searchParams.entries()));
    console.log('DEBUG PAGE: Auth user state:', user);
    
    // Alert to make sure we see it even if console is not open
    alert(`GitHub Callback Debug Page Loaded\n\nParameters received:\n${
      Array.from(searchParams.entries())
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
    }\n\nUser logged in: ${user ? 'Yes' : 'No'}`);
  }, [searchParams, user]);

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto', 
      fontFamily: 'sans-serif'
    }}>
      <h1>GitHub Callback Debug Page</h1>
      
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd', backgroundColor: '#f9f9f9' }}>
        <h2>URL Parameters</h2>
        <pre style={{ 
          backgroundColor: '#eee', 
          padding: '10px', 
          overflow: 'auto',
          maxHeight: '200px'
        }}>
          {JSON.stringify(Object.fromEntries(searchParams.entries()), null, 2)}
        </pre>
      </div>
      
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd', backgroundColor: '#f9f9f9' }}>
        <h2>Authentication Status</h2>
        <div>User logged in: {user ? 'Yes' : 'No'}</div>
        {user && (
          <div>
            <div>User ID: {user.id}</div>
            <div>Email: {user.email}</div>
          </div>
        )}
      </div>
      
      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd', backgroundColor: '#f9f9f9' }}>
        <h2>Recovery Test Section</h2>
        <p>If you see 'recovery=needed' in the parameters above, click this button to test manual linking:</p>
        <button
          onClick={async () => {
            const installationId = searchParams.get('installation_id');
            if (!installationId) {
              alert('No installation_id found in URL parameters');
              return;
            }
            
            try {
              // Get the current user's session token for authorization
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData?.session?.access_token;
              
              if (!token) {
                alert('No authorization token available. Please make sure you are logged in.');
                return;
              }

              alert(`Sending manual link request for installation ${installationId}`);
              
              const response = await fetch(`/api/github/manual-link-installation?installation_id=${installationId}`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` // Add the authorization header
                },
                credentials: 'include',
              });
              
              const text = await response.text();
              let data;
              try {
                data = JSON.parse(text);
              } catch (e) {
                data = { text };
              }
              
              alert(`Response received: ${response.status}\n\n${JSON.stringify(data, null, 2)}`);
            } catch (error) {
              alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }}
          style={{
            padding: '10px 15px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          disabled={!user}
        >
          {user ? 'Test Manual Link' : 'Please Login First'}
        </button>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <Link to="/dashboard" style={{ marginRight: '20px' }}>Go to Dashboard</Link>
        <Link to="/dashboard/settings">Go to Settings</Link>
      </div>
    </div>
  );
};

export default GitHubCallbackDebugPage;
