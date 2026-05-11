'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browserClient';
import { useAuth } from '@/contexts/AuthContext';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && session) {
      router.replace('/dashboard');
    }
  }, [session, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
          setError(authError.message);
        } else {
          router.replace('/dashboard');
        }
      } else {
        const { error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) {
          setError(authError.message);
        } else {
          setInfo('Account created! Check your email to confirm, then log in.');
          setMode('login');
          setPassword('');
          setConfirmPassword('');
        }
      }
    } catch {
      setError('Authentication service is not configured. Please set up Supabase credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="h-[600px] w-[600px] rounded-full bg-cyan-500/8 blur-[120px]" />
      </div>

      {/* Logo */}
      <Link href="/" className="relative mb-8 flex items-center gap-2">
        <span className="text-3xl">₿</span>
        <span className="text-xl font-bold text-white">
          Crypto<span className="text-cyan-400">Scanner</span>
        </span>
      </Link>

      {/* Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
        {/* Tab switcher */}
        <div className="mb-8 flex rounded-xl border border-gray-800 bg-gray-950 p-1">
          <button
            onClick={() => { setMode('login'); setError(''); setInfo(''); }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === 'login'
                ? 'bg-cyan-500 text-gray-950'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); setInfo(''); }}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === 'register'
                ? 'bg-cyan-500 text-gray-950'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        <h1 className="mb-2 text-xl font-bold text-white">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mb-6 text-sm text-gray-400">
          {mode === 'login'
            ? 'Log in to access your trading dashboard.'
            : 'Sign up free — no credit card required.'}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-400">
            {info}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">Confirm password</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-xl bg-cyan-500 py-3 text-sm font-bold text-gray-950 transition-colors hover:bg-cyan-400 disabled:opacity-60"
          >
            {submitting
              ? 'Please wait…'
              : mode === 'login'
              ? 'Log In →'
              : 'Create Account →'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => { setMode('register'); setError(''); setInfo(''); }}
                className="text-cyan-400 hover:underline"
              >
                Register for free
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                className="text-cyan-400 hover:underline"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>

      <p className="relative mt-6 text-xs text-gray-600">
        &copy; {new Date().getFullYear()} CryptoScanner. All rights reserved.
      </p>
    </div>
  );
}
