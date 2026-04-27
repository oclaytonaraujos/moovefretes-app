import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications } from '../services/notifications';
import type { Company, Profile } from '../types';

interface AuthUser {
  id: string;
  email: string;
  profile: Profile | null;
  company: Company | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshCompany: () => Promise<void>;
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
      const [profileResult, companyResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('companies').select('*').eq('user_id', userId).single(),
      ]);

      if (profileResult.error) console.warn('[AuthContext] Profile load error:', profileResult.error.message);
      if (companyResult.error) console.warn('[AuthContext] Company load error:', companyResult.error.message);

      setUser({
        id: userId,
        email,
        profile: profileResult.data || null,
        company: companyResult.data || null,
      });

      registerForPushNotifications(userId).catch(e =>
        console.warn('[AuthContext] Push registration failed:', e?.message)
      );
    } catch (e: any) {
      console.error('[AuthContext] loadUserData failed:', e?.message);
      setUser(null);
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

  async function refreshCompany() {
    if (!user) return;
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setUser(prev => prev ? { ...prev, company: data } : prev);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, refreshCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
