import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/config/supabaseClient';
import { getProfile, Profile } from '../services/authService'; // Import Profile and getProfile

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null; // Add profile state
  isLoading: boolean;
  signOut: () => Promise<void>;
  // We could add a refreshProfile function here if needed later
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick timeout to prevent infinite loading
  useEffect(() => {
    const quickTimeout = setTimeout(() => {
      console.warn('[AuthContext] Quick timeout: Forcing loading to false after 3 seconds');
      setIsLoading(false);
    }, 3000); // Reduced timeout for faster UX

    return () => clearTimeout(quickTimeout);
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      console.log('[AuthContext] Starting fast auth check');
      setIsLoading(true);
      
      try {
        // Fast session check without profile initially
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[AuthContext] Session error:', sessionError);
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        if (initialSession?.user) {
          console.log('[AuthContext] Session found, setting user immediately');
          // Set session and user immediately for fast UI
          setSession(initialSession);
          setUser(initialSession.user);
          setIsLoading(false); // Allow UI to render immediately
          
          // Fetch profile in background (non-blocking)
          console.log('[AuthContext] Fetching profile in background');
          getProfile()
            .then(({ profile: userProfile, error: profileError }) => {
              if (profileError) {
                console.warn('[AuthContext] Profile fetch failed (non-blocking):', profileError);
              }
              setProfile(userProfile);
            })
            .catch((err) => {
              console.warn('[AuthContext] Profile fetch error (non-blocking):', err);
            });
        } else {
          console.log('[AuthContext] No session found');
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
      } catch (error) { 
        console.error("[AuthContext] Auth check error:", error);
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    };

    checkUser();
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      console.log('[AuthContext] onAuthStateChange: Event triggered. New session:', newSession);
      setSession(newSession);
      setUser(newSession?.user || null);
      
      if (newSession?.user) {
        // Fetch profile for new session (non-blocking)
        getProfile()
          .then(({ profile: userProfile, error: profileError }) => {
            if (profileError) {
              console.warn('[AuthContext] Profile fetch failed on auth change:', profileError);
            }
            setProfile(userProfile);
          })
          .catch((err) => {
            console.warn('[AuthContext] Profile fetch error on auth change:', err);
          });
      } else {
        setProfile(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
    // The onAuthStateChange listener will handle clearing local state.
  };

  const value = {
    session,
    user,
    profile,
    isLoading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
