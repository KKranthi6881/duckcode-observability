import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { upsertProfile, Profile } from '../services/authService';

const ProfilePage: React.FC = () => {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [website, setWebsite] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>(''); // For simplicity, direct URL input
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setFullName(profile.full_name || '');
      setWebsite(profile.website || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);

    if (!user) {
      setError('User not authenticated.');
      setIsSaving(false);
      return;
    }

    const profileData: Partial<Profile> = {
      id: user.id, // This is crucial for RLS and linking to the auth user
      username: username.trim() || null,
      full_name: fullName.trim() || null,
      website: website.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    };

    try {
      const { profile: updatedProfile, error: updateError } = await upsertProfile(profileData);
      if (updateError) throw updateError;
      setMessage('Profile updated successfully!');
      // AuthContext will eventually update with the new profile data if getProfile is called again,
      // or we could manually update the profile state in AuthContext if we add a setter.
      // For now, a page refresh or re-login would show updated data from AuthContext.
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
      console.error('Profile update error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return <div>Loading profile...</div>;
  }

  if (!user) {
    return <div>Please log in to view your profile.</div>; // Should be handled by ProtectedRoute
  }

  return (
    <div style={{ maxWidth: '600px', margin: 'auto', padding: '20px' }}>
      <h2>User Profile</h2>
      <p><strong>Email:</strong> {user.email}</p>
      {profile && <p><strong>Last Updated:</strong> {new Date(profile.updated_at || '').toLocaleString()}</p>}

      <form onSubmit={handleProfileUpdate} style={{ marginTop: '20px' }}>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="username">Username:</label><br />
          <input 
            type="text" 
            id="username" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            placeholder="Your public username"
            style={{ width: '100%', padding: '8px' }} 
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="fullName">Full Name:</label><br />
          <input 
            type="text" 
            id="fullName" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            placeholder="Your full name"
            style={{ width: '100%', padding: '8px' }} 
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="website">Website:</label><br />
          <input 
            type="url" 
            id="website" 
            value={website} 
            onChange={(e) => setWebsite(e.target.value)} 
            placeholder="https://your-website.com"
            style={{ width: '100%', padding: '8px' }} 
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="avatarUrl">Avatar URL:</label><br />
          <input 
            type="url" 
            id="avatarUrl" 
            value={avatarUrl} 
            onChange={(e) => setAvatarUrl(e.target.value)} 
            placeholder="https://link-to-your-avatar.png"
            style={{ width: '100%', padding: '8px' }} 
          />
        </div>

        <button type="submit" disabled={isSaving} style={{ padding: '10px 20px' }}>
          {isSaving ? 'Saving...' : 'Update Profile'}
        </button>
      </form>
    </div>
  );
};

export default ProfilePage;
