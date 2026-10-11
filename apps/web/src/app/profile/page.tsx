'use client';

import React, { useState, useEffect } from 'react';
import { User, Shield, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useApp } from '@/components/Providers';

export default function ProfilePage() {
  const { user, refreshProfile } = useApp();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredCity, setPreferredCity] = useState('Mumbai');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '');
      setPreferredCity(user.preferredCity || 'Mumbai');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center text-zinc-400">
        Please sign in to manage your profile.
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('');
    await apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ fullName, phone, preferredCity }),
    });
    await refreshProfile();
    setSavedMsg('Profile preferences updated successfully.');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-8">
      <div className="border-b border-zinc-800 pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
          Identity & Session Security
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-white">
          Account Settings
        </h1>
      </div>

      {savedMsg && (
        <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <form
          onSubmit={handleSave}
          className="md:col-span-7 rounded border border-zinc-800 bg-[#111115] p-6 space-y-4"
        >
          <div className="flex items-center gap-2 font-mono text-xs uppercase text-amber-400">
            <User className="h-4 w-4" />
            Personal Information
          </div>

          <div className="space-y-1">
            <label className="block font-mono text-xs text-zinc-400">Email</label>
            <input
              type="text"
              disabled
              value={user.email}
              className="w-full rounded border border-zinc-800 bg-zinc-900 py-2 px-3 text-sm text-zinc-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-mono text-xs text-zinc-400">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-mono text-xs text-zinc-400">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 px-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-mono text-xs text-zinc-400">
              Preferred City
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
            className="rounded bg-amber-400 px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
          >
            Save Profile Changes
          </button>
        </form>

        <div className="md:col-span-5 rounded border border-zinc-800 bg-[#111115] p-6 space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs uppercase text-amber-400">
            <Shield className="h-4 w-4" />
            Assigned RBAC Permissions
          </div>
          <div className="flex flex-wrap gap-2">
            {user.roles.map((r) => (
              <span
                key={r}
                className="rounded border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 font-mono text-xs text-amber-300"
              >
                {r}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your session uses short-lived JWT access tokens paired with rotating SHA-256 hashed refresh tokens in PostgreSQL.
          </p>
        </div>
      </div>
    </div>
  );
}

