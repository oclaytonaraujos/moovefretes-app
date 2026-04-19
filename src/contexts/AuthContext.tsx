import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Driver, Profile } from '../types';

interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
  driver: Driver | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshDriver: () => Promise<void>;
  updateDriverAvailability: (status: 'available' | 'busy' | 'offline') => Promise<void>;
  updateDriverLocation: (location: { city: string; state: string; lat?: number; lng?: number }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserData(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData(userId: string, email: string) {
    try {
      const [profileResult, driverResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('drivers').select('*').eq('user_id', userId).single(),
      ]);

      setUser({
        id: userId,
        email,
        profile: profileResult.data || null,
        driver: driverResult.data || null,
      });
    } catch {
      setUser({ id: userId, email, profile: null, driver: null });
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshDriver() {
    if (!user) return;
    const { data } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setUser(prev => prev ? { ...prev, driver: data } : prev);
    }
  }

  async function updateDriverAvailability(status: 'available' | 'busy' | 'offline') {
    if (!user?.driver) return;
    const isAvailable = status === 'available';
    await supabase
      .from('drivers')
      .update({ available: isAvailable, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    await supabase
      .from('profiles')
      .update({ is_online: status !== 'offline', last_seen: new Date().toISOString() })
      .eq('id', user.id);
    setUser(prev => {
      if (!prev?.driver) return prev;
      return { ...prev, driver: { ...prev.driver, available: isAvailable } };
    });
  }

  async function updateDriverLocation(location: { city: string; state: string; lat?: number; lng?: number }) {
    if (!user?.driver) return;
    const locationData = { ...location, lastUpdated: new Date().toISOString() };
    await supabase
      .from('drivers')
      .update({ current_location: locationData, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    setUser(prev => {
      if (!prev?.driver) return prev;
      return { ...prev, driver: { ...prev.driver, current_location: locationData } };
    });
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshDriver, updateDriverAvailability, updateDriverLocation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
