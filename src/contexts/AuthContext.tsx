'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/browserClient';

export type AppRole = 'admin' | 'user';

function normalizeRole(value: unknown): AppRole {
  const role = String(value ?? '').toLowerCase();
  return role.includes('admin') ? 'admin' : 'user';
}

export function getUserRole(user: User | null): AppRole {
  if (!user) return 'user';
  return normalizeRole(
    user.app_metadata?.role ??
    user.user_metadata?.role ??
    user.app_metadata?.org_role ??
    user.user_metadata?.org_role
  );
}

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  role: AppRole;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  role: 'user',
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null;

    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Supabase not configured; clear locally
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, role: getUserRole(session?.user ?? null), loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
