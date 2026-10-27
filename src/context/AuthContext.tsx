import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  syncAuthenticatedUserProfile,
  logoutUser,
  translateSupabaseError,
} from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<Profile | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyProfile = useCallback(async (authUser: User | null): Promise<Profile | null> => {
    if (!authUser) {
      setProfile(null);
      setIsAdmin(false);
      return null;
    }

    try {
      setError(null);
      const syncedProfile = await syncAuthenticatedUserProfile(authUser);

      if (syncedProfile) {
        setProfile(syncedProfile);
        setIsAdmin(syncedProfile.role === 'admin');
        return syncedProfile;
      } else {
        setProfile(null);
        setIsAdmin(false);
        return null;
      }
    } catch (err: any) {
      console.error('[AuthContext] Error fetching profile:', err);
      setError(translateSupabaseError(err, 'প্রোফাইল লোড করা যায়নি।'));
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      setLoading(true);

      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) {
            console.error('[AuthContext] getSession error:', sessionError);
          }
          if (isMounted) {
            const currentSession = data?.session || null;
            setSession(currentSession);
            const currentUser = currentSession?.user || null;
            setUser(currentUser);

            if (currentUser) {
              await fetchMyProfile(currentUser);
            } else {
              setProfile(null);
              setIsAdmin(false);
            }
          }
        } catch (err) {
          console.error('[AuthContext] initAuth exception:', err);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    }

    initAuth();

    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!isMounted) return;

        setSession(newSession);
        const authUser = newSession?.user || null;
        setUser(authUser);

        if (event === 'SIGNED_OUT' || !authUser) {
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Defer Supabase query out of synchronous auth callback to avoid lock contention
        setTimeout(async () => {
          if (!isMounted) return;
          await fetchMyProfile(authUser);
          if (isMounted) setLoading(false);
        }, 0);
      });

      return () => {
        isMounted = false;
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [fetchMyProfile]);

  const refreshProfile = async (): Promise<Profile | null> => {
    setLoading(true);
    let currentUser = user;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          console.error('[AuthContext] refreshProfile getUser error:', userErr);
        }
        if (data?.user) {
          currentUser = data.user;
          setUser(currentUser);
        }
      } catch (err) {
        console.error('[AuthContext] refreshProfile exception:', err);
      }
    }

    const res = await fetchMyProfile(currentUser);
    setLoading(false);
    return res;
  };

  const handleLogout = async () => {
    setLoading(true);
    await logoutUser();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setError(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isAdmin,
        loading,
        error,
        refreshProfile,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
