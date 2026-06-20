'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthGuard({
  children,
  adminOnly = false,
  nonAdminRedirect = '/dashboard',
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  nonAdminRedirect?: string;
}) {
  const { session, loading, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login');
    }
    if (!loading && session && adminOnly && role !== 'admin') {
      router.replace(nonAdminRedirect);
    }
  }, [session, loading, router, adminOnly, role, nonAdminRedirect]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (adminOnly && role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}
