'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Film, Lock, Mail, Sparkles } from 'lucide-react';
import { useApp } from '@/components/Providers';

export default function LoginPage() {
  const router = useRouter();
  const { loginWithCredentials } = useApp();
  const [email, setEmail] = useState('aarav@tixora.cinema');
  const [password, setPassword] = useState('Tixora@2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await loginWithCredentials(email, password);
      if (user.roles.includes('PLATFORM_ADMIN')) {
        router.push('/admin');
      } else if (user.roles.includes('CINEMA_MANAGER')) {
        router.push('/manager');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded border border-zinc-800 bg-[#111115] p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded border border-amber-400/50 bg-amber-400/10 text-amber-400">
            <Film className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Sign In to Tixora
          </h1>
          <p className="text-xs text-zinc-400">
            Access your seat holds, digital QR tickets, or management portals.
          </p>
        </div>

        {/* One-Click Demo Credentials Fillers */}
        <div className="rounded border border-zinc-800 bg-zinc-950 p-3 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
            Quick Fill Demo Accounts (Password: Tixora@2026)
          </p>
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => {
                setEmail('aarav@tixora.cinema');
                setPassword('Tixora@2026');
              }}
              className="rounded border border-zinc-800 bg-zinc-900 py-1.5 text-zinc-300 hover:border-amber-400"
            >
              Customer
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('manager@tixora.cinema');
                setPassword('Tixora@2026');
              }}
              className="rounded border border-zinc-800 bg-zinc-900 py-1.5 text-zinc-300 hover:border-amber-400"
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@tixora.cinema');
                setPassword('Tixora@2026');
              }}
              className="rounded border border-zinc-800 bg-zinc-900 py-1.5 text-zinc-300 hover:border-amber-400"
            >
              Admin
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-mono text-xs uppercase text-zinc-400">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-xs uppercase text-zinc-400">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-amber-400 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400">
          New to Tixora?{' '}
          <Link href="/register" className="text-amber-400 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

