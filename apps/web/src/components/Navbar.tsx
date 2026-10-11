'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Film,
  MapPin,
  Ticket,
  ShieldCheck,
  Building2,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { useApp } from './Providers';

const CITIES = ['', 'Mumbai', 'New Delhi', 'Bengaluru'];

export function Navbar() {
  const pathname = usePathname();
  const { user, city, setCity, logout, loginWithCredentials } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const isManager =
    user?.roles.includes('CINEMA_MANAGER') ||
    user?.roles.includes('CINEMA_STAFF') ||
    user?.roles.includes('PLATFORM_ADMIN');
  const isAdmin = user?.roles.includes('PLATFORM_ADMIN');

  const handleQuickDemoSwitch = async (email: string) => {
    setSwitchingRole(true);
    try {
      await loginWithCredentials(email, 'Tixora@2026');
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#09090B]/90 backdrop-blur-md">
      {/* Top Quick Role Bar for Instant Portfolio / Engineering Evaluation */}
      <div className="border-b border-zinc-900 bg-[#0d0d12] px-4 py-1.5 text-xs text-zinc-400">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="font-mono uppercase tracking-wider text-zinc-300">
              TIXORA V1 · POSTGRESQL ACID ENGINE
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500">Instant Demo Session Switcher:</span>
            <button
              disabled={switchingRole}
              onClick={() => handleQuickDemoSwitch('aarav@tixora.cinema')}
              className={`rounded px-2 py-0.5 font-mono transition ${
                user?.email === 'aarav@tixora.cinema'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Customer (Aarav)
            </button>
            <button
              disabled={switchingRole}
              onClick={() => handleQuickDemoSwitch('manager@tixora.cinema')}
              className={`rounded px-2 py-0.5 font-mono transition ${
                user?.email === 'manager@tixora.cinema'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Cinema Manager (Mumbai)
            </button>
            <button
              disabled={switchingRole}
              onClick={() => handleQuickDemoSwitch('admin@tixora.cinema')}
              className={`rounded px-2 py-0.5 font-mono transition ${
                user?.email === 'admin@tixora.cinema'
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Platform Admin
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-amber-400/50 bg-amber-400/10 text-amber-400 transition group-hover:bg-amber-400 group-hover:text-zinc-950">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <span className="font-display text-xl font-bold tracking-[0.18em] text-zinc-100">
                TIXORA
              </span>
              <span className="block font-mono text-[10px] uppercase tracking-widest text-amber-400/80">
                Premiere Ticketing
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/movies"
              className={`transition ${
                pathname.startsWith('/movies')
                  ? 'text-amber-400'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Movies
            </Link>
            <Link
              href="/cinemas"
              className={`transition ${
                pathname.startsWith('/cinemas')
                  ? 'text-amber-400'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              Cinemas
            </Link>
            {user && (
              <Link
                href="/bookings"
                className={`flex items-center gap-1.5 transition ${
                  pathname.startsWith('/bookings')
                    ? 'text-amber-400'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Ticket className="h-4 w-4 text-amber-400" />
                My Bookings
              </Link>
            )}
            {isManager && (
              <Link
                href="/manager"
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-mono uppercase tracking-wider transition ${
                  pathname.startsWith('/manager')
                    ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                    : 'border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <Building2 className="h-3.5 w-3.5 text-amber-400" />
                Cinema Ops
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-mono uppercase tracking-wider transition ${
                  pathname.startsWith('/admin')
                    ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                    : 'border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                Admin Console
              </Link>
            )}
          </nav>
        </div>

        {/* Right Controls: City Selector & Auth */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 text-amber-400" />
            <select
              aria-label="Select City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-transparent font-medium text-zinc-200 focus:outline-none"
            >
              {CITIES.map((c) => (
                <option key={c || 'all'} value={c} className="bg-zinc-900 text-zinc-100">
                  {c || 'All Cities'}
                </option>
              ))}
            </select>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-400/50"
              >
                <UserIcon className="h-3.5 w-3.5 text-amber-400" />
                <span>{user.fullName.split(' ')[0]}</span>
                <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                  {user.roles[0]}
                </span>
              </Link>
              <button
                onClick={() => logout()}
                title="Sign out"
                className="rounded border border-zinc-800 p-1.5 text-zinc-400 hover:border-rose-500/40 hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded px-3.5 py-1.5 text-sm font-medium text-zinc-300 hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded bg-amber-400 px-4 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Join Tixora
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded border border-zinc-800 p-2 text-zinc-300"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-zinc-800 bg-[#111115] px-4 py-4 md:hidden space-y-3">
          <div className="flex flex-col space-y-2 text-sm">
            <Link href="/movies" onClick={() => setMobileMenuOpen(false)} className="py-1 text-zinc-200">
              Movies
            </Link>
            <Link href="/cinemas" onClick={() => setMobileMenuOpen(false)} className="py-1 text-zinc-200">
              Cinemas
            </Link>
            {user && (
              <Link href="/bookings" onClick={() => setMobileMenuOpen(false)} className="py-1 text-amber-400">
                My Bookings
              </Link>
            )}
            {isManager && (
              <Link href="/manager" onClick={() => setMobileMenuOpen(false)} className="py-1 text-zinc-200">
                Cinema Manager Portal
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="py-1 text-zinc-200">
                Platform Admin Console
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-zinc-900 bg-[#09090B] py-12 text-sm text-zinc-500">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <p className="font-display text-lg font-bold tracking-[0.18em] text-zinc-200">
            TIXORA
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Your Seat. Your Show. Your Moment. · Authoritative PostgreSQL Reservation Engine.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-xs font-mono uppercase tracking-wider">
          <Link href="/movies" className="hover:text-amber-400">
            Now Showing
          </Link>
          <Link href="/cinemas" className="hover:text-amber-400">
            IMAX & Noir Suites
          </Link>
          <Link href="/manager" className="hover:text-amber-400">
            Cinema Operations
          </Link>
          <Link href="/admin" className="hover:text-amber-400">
            Platform Governance
          </Link>
        </div>
      </div>
    </footer>
  );
}
