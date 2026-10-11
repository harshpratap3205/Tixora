'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { apiFetch, setStoredAuth, ApiUser } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preferredCity, setPreferredCity] = useState('Mumbai');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{
        user: ApiUser;
        accessToken: string;
        refreshToken: string;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          password,
          preferredCity,
        }),
      });
      setStoredAuth(res.accessToken, res.refreshToken, res.user);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded border border-zinc-800 bg-[#111115] p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded border border-amber-400/50 bg-amber-400/10 text-amber-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Create Your Tixora Membership
          </h1>
          <p className="text-xs text-zinc-400">
            Experience priority IMAX & Noir Velvet reservations.
          </p>
        </div>

        {error && (
          <div className="rounded border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block font-mono text-xs uppercase text-zinc-400">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Aarav Mehta"
              className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-xs uppercase text-zinc-400">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-xs uppercase text-zinc-400">
              Password (8+ characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-mono text-xs uppercase text-zinc-400">
              Preferred Home City
            </label>
            <select
              value={preferredCity}
              onChange={(e) => setPreferredCity(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            >
              <option value="Mumbai">Mumbai</option>
              <option value="New Delhi">New Delhi</option>
              <option value="Bengaluru">Bengaluru</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-amber-400 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400">
          Already registered?{' '}
          <Link href="/login" className="text-amber-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

