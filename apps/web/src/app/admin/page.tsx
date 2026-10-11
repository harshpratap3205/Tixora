'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Film,
  Building2,
  Users,
  CreditCard,
  Activity,
  Plus,
} from 'lucide-react';
import { apiFetch, Movie } from '@/lib/api';
import { useApp } from '@/components/Providers';

export default function PlatformAdminDashboard() {
  const { user, loginWithCredentials } = useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'movies' | 'cinemas' | 'users' | 'payments' | 'audit'
  >('overview');

  // New movie state
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [director, setDirector] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(140);
  const [releaseDate, setReleaseDate] = useState('2026-11-20');
  const [movieCreatedMsg, setMovieCreatedMsg] = useState('');

  // New cinema state
  const [cinemaName, setCinemaName] = useState('');
  const [cinemaCity, setCinemaCity] = useState('Mumbai');
  const [cinemaNeighborhood, setCinemaNeighborhood] = useState('');
  const [cinemaAddress, setCinemaAddress] = useState('');
  const [cinemaMsg, setCinemaMsg] = useState('');

  const isAdmin = user?.roles.includes('PLATFORM_ADMIN');

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiFetch<any>('/admin/reports/overview'),
    enabled: Boolean(isAdmin),
  });

  const { data: movies } = useQuery({
    queryKey: ['admin-movies'],
    queryFn: () => apiFetch<Movie[]>('/movies?limit=50'),
    enabled: Boolean(isAdmin),
  });

  const { data: usersList } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => apiFetch<any[]>('/admin/users'),
    enabled: Boolean(isAdmin),
  });

  const { data: paymentsList } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => apiFetch<any[]>('/admin/payments'),
    enabled: Boolean(isAdmin),
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => apiFetch<any[]>('/admin/audit-logs?limit=100'),
    enabled: Boolean(isAdmin),
  });

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-4">
        <ShieldCheck className="mx-auto h-12 w-12 text-amber-400" />
        <h1 className="font-display text-3xl font-bold text-white">
          Platform Super-Admin Authorization Required
        </h1>
        <p className="text-sm text-zinc-400">
          Switch to the seeded Platform Admin account (`admin@tixora.cinema`) to govern the film catalog, onboard cinemas, manage users, inspect payment reconciliation, and view audit logs.
        </p>
        <button
          onClick={() => loginWithCredentials('admin@tixora.cinema', 'Tixora@2026')}
          className="rounded bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950"
        >
          Instant Switch to Platform Admin (Vikramaditya Sen)
        </button>
      </div>
    );
  }

  const handleCreateMovie = async (e: React.FormEvent) => {
    e.preventDefault();
    setMovieCreatedMsg('');
    await apiFetch('/admin/movies', {
      method: 'POST',
      body: JSON.stringify({
        title,
        tagline,
        synopsis,
        durationMinutes: Number(durationMinutes),
        releaseDate,
        releaseStatus: 'NOW_SHOWING',
        ageRating: 'UA 16+',
        languages: ['English', 'Hindi'],
        genres: ['Drama', 'Thriller'],
        director,
        posterUrl:
          'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=900&q=85',
        backdropUrl:
          'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1920&q=85',
        imdbRating: 8.5,
        isFeatured: true,
      }),
    });
    setTitle('');
    setTagline('');
    setSynopsis('');
    setDirector('');
    setMovieCreatedMsg('Film added to global Tixora catalog and logged in audit trail.');
    queryClient.invalidateQueries({ queryKey: ['admin-movies'] });
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
  };

  const handleOnboardCinema = async (e: React.FormEvent) => {
    e.preventDefault();
    setCinemaMsg('');
    await apiFetch('/admin/cinemas', {
      method: 'POST',
      body: JSON.stringify({
        name: cinemaName,
        city: cinemaCity,
        neighborhood: cinemaNeighborhood,
        address: cinemaAddress,
        facilities: ['IMAX Laser', 'Dolby Atmos', 'Valet Parking'],
        status: 'ACTIVE',
      }),
    });
    setCinemaName('');
    setCinemaNeighborhood('');
    setCinemaAddress('');
    setCinemaMsg('Cinema location onboarded and activated.');
    queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await apiFetch(`/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
            Platform Super-Admin Governance Console
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            Tixora Global Command Center
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Platform Health', icon: Activity },
            { id: 'movies', label: 'Catalog CRUD', icon: Film },
            { id: 'cinemas', label: 'Onboard Cinemas', icon: Building2 },
            { id: 'users', label: 'Users & RBAC', icon: Users },
            { id: 'payments', label: 'Payment Reconciliation', icon: CreditCard },
            { id: 'audit', label: 'Audit Logs', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-1.5 rounded border px-3.5 py-2 text-xs font-mono uppercase tracking-wider transition ${
                  activeTab === tab.id
                    ? 'border-amber-400 bg-amber-400 text-zinc-950 font-bold'
                    : 'border-zinc-800 bg-[#111115] text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: PLATFORM OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-zinc-800 bg-[#111115] p-5">
            <span className="font-mono text-xs uppercase text-zinc-400">
              Gross Platform Revenue
            </span>
            <p className="mt-2 font-mono text-3xl font-bold text-amber-400">
              ₹{(overview.grossRevenue || 0).toFixed(2)}
            </p>
          </div>
          <div className="rounded border border-zinc-800 bg-[#111115] p-5">
            <span className="font-mono text-xs uppercase text-zinc-400">
              Confirmed Bookings
            </span>
            <p className="mt-2 font-mono text-3xl font-bold text-white">
              {overview.confirmedBookings}
            </p>
          </div>
          <div className="rounded border border-zinc-800 bg-[#111115] p-5">
            <span className="font-mono text-xs uppercase text-zinc-400">
              Active Films / Houses / Screens
            </span>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-400">
              {overview.activeMovies} Films · {overview.activeCinemas} Houses ·{' '}
              {overview.totalScreens} Screens
            </p>
          </div>
          <div className="rounded border border-zinc-800 bg-[#111115] p-5">
            <span className="font-mono text-xs uppercase text-zinc-400">
              Seats Sold / Active Holds
            </span>
            <p className="mt-2 font-mono text-2xl font-bold text-zinc-100">
              {overview.totalSeatsBooked} Booked · {overview.activeSeatsHeld} Held
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: CATALOG CRUD */}
      {activeTab === 'movies' && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <form
            onSubmit={handleCreateMovie}
            className="md:col-span-5 rounded border border-zinc-800 bg-[#111115] p-6 space-y-4"
          >
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-400" />
              Publish New Film to Catalog
            </h2>

            {movieCreatedMsg && (
              <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
                {movieCreatedMsg}
              </div>
            )}

            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Film Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Nocturne Symphony"
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Editorial Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Every frame is a confession."
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              />
            </div>

            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Synopsis (10+ chars)
              </label>
              <textarea
                required
                minLength={10}
                rows={3}
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Director
                </label>
                <input
                  type="text"
                  required
                  value={director}
                  onChange={(e) => setDirector(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Runtime (m)
                </label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Release Date
                </label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded bg-amber-400 px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
            >
              Publish Film
            </button>
          </form>

          <div className="md:col-span-7 rounded border border-zinc-800 bg-[#111115] p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-white">
              Active Catalog ({movies?.length || 0})
            </h2>
            <div className="space-y-3">
              {(movies || []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 p-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-zinc-100">{m.title}</p>
                    <p className="font-mono text-[11px] text-zinc-400">
                      Dir. {m.director} · {m.durationMinutes}m · {m.releaseStatus}
                    </p>
                  </div>
                  <span className="rounded bg-amber-400/15 px-2 py-0.5 font-mono text-amber-300">
                    ★ {m.imdbRating.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CINEMA ONBOARDING */}
      {activeTab === 'cinemas' && (
        <form
          onSubmit={handleOnboardCinema}
          className="max-w-2xl rounded border border-zinc-800 bg-[#111115] p-6 space-y-4"
        >
          <h2 className="font-display text-xl font-bold text-white">
            Onboard New Flagship Cinema Location
          </h2>
          {cinemaMsg && (
            <div className="rounded border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-200">
              {cinemaMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Cinema Name
              </label>
              <input
                type="text"
                required
                value={cinemaName}
                onChange={(e) => setCinemaName(e.target.value)}
                placeholder="Tixora Grand Opera — Colaba"
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Metro City
              </label>
              <select
                value={cinemaCity}
                onChange={(e) => setCinemaCity(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              >
                <option value="Mumbai">Mumbai</option>
                <option value="New Delhi">New Delhi</option>
                <option value="Bengaluru">Bengaluru</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Neighborhood
              </label>
              <input
                type="text"
                required
                value={cinemaNeighborhood}
                onChange={(e) => setCinemaNeighborhood(e.target.value)}
                placeholder="Colaba Heritage Precinct"
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Full Street Address
              </label>
              <input
                type="text"
                required
                value={cinemaAddress}
                onChange={(e) => setCinemaAddress(e.target.value)}
                placeholder="24 Shahid Bhagat Singh Road, Mumbai 400001"
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded bg-amber-400 px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
          >
            Approve & Onboard Cinema
          </button>
        </form>
      )}

      {/* TAB 4: USERS & RBAC */}
      {activeTab === 'users' && (
        <div className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            User Administration & Role Assignments
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-zinc-800 text-zinc-400 uppercase">
                <tr>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Roles</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {(usersList || []).map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4 font-sans font-semibold text-zinc-100">
                      {u.fullName}
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">{u.email}</td>
                    <td className="py-3 pr-4 text-amber-400">
                      {(u.roles || []).join(', ')}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.status)}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-200 hover:border-amber-400"
                      >
                        {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENTS & RECONCILIATION */}
      {activeTab === 'payments' && (
        <div className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            Payment Intents, Webhooks & Late-Payment Reconciliation Ledger
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-zinc-800 text-zinc-400 uppercase">
                <tr>
                  <th className="py-3 pr-4">Intent ID</th>
                  <th className="py-3 pr-4">Booking Ref</th>
                  <th className="py-3 pr-4">Amount</th>
                  <th className="py-3 pr-4">Payment Status</th>
                  <th className="py-3 pr-4">Booking Status</th>
                  <th className="py-3">Reconciliation Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {(paymentsList || []).map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 pr-4 text-amber-400">{p.providerIntentId}</td>
                    <td className="py-3 pr-4 text-zinc-200">{p.bookingReference}</td>
                    <td className="py-3 pr-4 text-zinc-100">
                      ₹{p.amount.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-zinc-900 border border-zinc-700 px-2 py-0.5 text-zinc-200">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">{p.bookingStatus}</td>
                    <td className="py-3 text-zinc-400 max-w-xs truncate">
                      {p.reconciliationNotes || p.failureReason || 'Verified OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            Immutable Security & Administrative Audit Trail
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-zinc-800 text-zinc-400 uppercase">
                <tr>
                  <th className="py-3 pr-4">Timestamp</th>
                  <th className="py-3 pr-4">Action</th>
                  <th className="py-3 pr-4">Actor</th>
                  <th className="py-3 pr-4">Entity</th>
                  <th className="py-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {(auditLogs || []).map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 pr-4 text-zinc-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 font-bold text-amber-400">
                      {log.action}
                    </td>
                    <td className="py-3 pr-4 text-zinc-200">
                      {log.actor_email || log.actor_role || 'SYSTEM'}
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">
                      {log.entity_type} ({log.entity_id.slice(0, 8)}...)
                    </td>
                    <td className="py-3 text-zinc-400 max-w-md truncate">
                      {JSON.stringify(log.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

