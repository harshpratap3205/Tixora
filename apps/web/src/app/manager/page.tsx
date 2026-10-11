'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Layers,
  CalendarPlus,
  QrCode,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { apiFetch, Movie } from '@/lib/api';
import { useApp } from '@/components/Providers';

export default function CinemaManagerDashboard() {
  const { user, loginWithCredentials } = useApp();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'shows' | 'screens' | 'scanner' | 'bookings'
  >('overview');

  // Show scheduling form state
  const [movieId, setMovieId] = useState('');
  const [cinemaId, setCinemaId] = useState('');
  const [screenId, setScreenId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [format, setFormat] = useState('IMAX Laser 2D');
  const [language, setLanguage] = useState('English');
  const [priceStandard, setPriceStandard] = useState(380);
  const [pricePrime, setPricePrime] = useState(520);
  const [priceRecliner, setPriceRecliner] = useState(890);
  const [scheduleMsg, setScheduleMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Screen creation state
  const [newScreenCinemaId, setNewScreenCinemaId] = useState('');
  const [newScreenName, setNewScreenName] = useState('');
  const [newScreenFormat, setNewScreenFormat] = useState('IMAX Laser');
  const [newScreenRows, setNewScreenRows] = useState(6);
  const [newScreenCols, setNewScreenCols] = useState(10);
  const [screenMsg, setScreenMsg] = useState('');

  // QR Scanner state
  const [qrInput, setQrInput] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState('');

  const isAuthorized =
    user?.roles.includes('CINEMA_MANAGER') ||
    user?.roles.includes('CINEMA_STAFF') ||
    user?.roles.includes('PLATFORM_ADMIN');

  const { data: managedCinemas } = useQuery({
    queryKey: ['manager-cinemas', user?.id],
    queryFn: () => apiFetch<any[]>('/manager/cinemas'),
    enabled: Boolean(isAuthorized),
  });

  const selectedCinemaForDetail =
    cinemaId || newScreenCinemaId || managedCinemas?.[0]?.id || '';

  const { data: cinemaDetail } = useQuery({
    queryKey: ['manager-cinema-detail', selectedCinemaForDetail],
    queryFn: () => apiFetch<any>(`/cinemas/${selectedCinemaForDetail}`),
    enabled: Boolean(selectedCinemaForDetail),
  });

  const { data: movies } = useQuery({
    queryKey: ['movies-list'],
    queryFn: () => apiFetch<Movie[]>('/movies'),
    enabled: Boolean(isAuthorized),
  });

  const { data: revenueReport } = useQuery({
    queryKey: ['manager-revenue', user?.id],
    queryFn: () => apiFetch<any>('/manager/reports/revenue'),
    enabled: Boolean(isAuthorized),
  });

  const { data: occupancyReport } = useQuery({
    queryKey: ['manager-occupancy', user?.id],
    queryFn: () => apiFetch<any[]>('/manager/reports/occupancy'),
    enabled: Boolean(isAuthorized),
  });

  const { data: managerBookings } = useQuery({
    queryKey: ['manager-bookings', user?.id],
    queryFn: () => apiFetch<any[]>('/manager/bookings'),
    enabled: Boolean(isAuthorized),
  });

  if (!isAuthorized) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-4">
        <Building2 className="mx-auto h-12 w-12 text-amber-400" />
        <h1 className="font-display text-3xl font-bold text-white">
          Cinema Manager Authorization Required
        </h1>
        <p className="text-sm text-zinc-400">
          Switch to the seeded Mumbai Cinema Manager account (`manager@tixora.cinema`) to manage auditoriums, schedule shows, and validate QR tickets.
        </p>
        <button
          onClick={() => loginWithCredentials('manager@tixora.cinema', 'Tixora@2026')}
          className="rounded bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950"
        >
          Instant Switch to Cinema Manager (Meera Kapoor)
        </button>
      </div>
    );
  }

  const handleScheduleShow = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleMsg(null);
    const targetCinemaId = cinemaId || managedCinemas?.[0]?.id;
    const targetMovieId = movieId || movies?.[0]?.id;
    const targetScreenId = screenId || cinemaDetail?.screens?.[0]?.id;

    try {
      await apiFetch('/manager/shows', {
        method: 'POST',
        body: JSON.stringify({
          movieId: targetMovieId,
          cinemaId: targetCinemaId,
          screenId: targetScreenId,
          language,
          format,
          startTime: new Date(startTime).toISOString(),
          categoryPrices: {
            STANDARD: Number(priceStandard),
            PRIME: Number(pricePrime),
            RECLINER: Number(priceRecliner),
          },
        }),
      });
      setScheduleMsg({
        type: 'success',
        text: 'Screening scheduled and per-show seat inventory generated!',
      });
      queryClient.invalidateQueries({ queryKey: ['manager-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['manager-cinema-detail'] });
    } catch (err: any) {
      setScheduleMsg({
        type: 'error',
        text: err.message || 'Failed to schedule screening',
      });
    }
  };

  const handleCreateScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    setScreenMsg('');
    const targetCinemaId = newScreenCinemaId || managedCinemas?.[0]?.id;
    try {
      await apiFetch(`/manager/cinemas/${targetCinemaId}/screens`, {
        method: 'POST',
        body: JSON.stringify({
          name: newScreenName,
          formatType: newScreenFormat,
          soundSystem: 'Dolby Atmos',
          totalRows: Number(newScreenRows),
          totalCols: Number(newScreenCols),
          turnaroundMinutes: 20,
        }),
      });
      setScreenMsg(`Screen "${newScreenName}" created with ${newScreenRows * newScreenCols} physical seats.`);
      setNewScreenName('');
      queryClient.invalidateQueries({ queryKey: ['manager-cinema-detail'] });
      queryClient.invalidateQueries({ queryKey: ['manager-cinemas'] });
    } catch (err: any) {
      setScreenMsg(err.message || 'Could not create screen');
    }
  };

  const handleValidateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setScanError('');
    setScanResult(null);
    try {
      const res = await apiFetch('/manager/tickets/validate', {
        method: 'POST',
        body: JSON.stringify({ qrTokenOrCode: qrInput }),
      });
      setScanResult(res);
      queryClient.invalidateQueries({ queryKey: ['manager-bookings'] });
    } catch (err: any) {
      setScanError(err.message || 'Ticket validation rejected');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
            Cinema Operations Portal · Scoped RBAC
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            Auditorium, Showtime & Gate Control
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Signed in as {user?.fullName} · Authorized Houses:{' '}
            {(managedCinemas || []).map((c) => c.name).join(', ')}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: 'Overview & Occupancy', icon: BarChart3 },
            { id: 'shows', label: 'Schedule & Pricing', icon: CalendarPlus },
            { id: 'screens', label: 'Screens & Seat Layouts', icon: Layers },
            { id: 'scanner', label: 'QR Gate Scanner', icon: QrCode },
            { id: 'bookings', label: 'Booking Ledger', icon: Building2 },
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

      {/* TAB 1: OVERVIEW & OCCUPANCY */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded border border-zinc-800 bg-[#111115] p-5">
              <span className="font-mono text-xs uppercase text-zinc-400">
                Authorized Revenue
              </span>
              <p className="mt-2 font-mono text-3xl font-bold text-amber-400">
                ₹{(revenueReport?.totalRevenue || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded border border-zinc-800 bg-[#111115] p-5">
              <span className="font-mono text-xs uppercase text-zinc-400">
                Confirmed Bookings
              </span>
              <p className="mt-2 font-mono text-3xl font-bold text-white">
                {revenueReport?.confirmedBookings || 0}
              </p>
            </div>
            <div className="rounded border border-zinc-800 bg-[#111115] p-5">
              <span className="font-mono text-xs uppercase text-zinc-400">
                Managed Cinemas
              </span>
              <p className="mt-2 font-mono text-3xl font-bold text-emerald-400">
                {managedCinemas?.length || 0}
              </p>
            </div>
          </div>

          <div className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-white">
              Showtime Occupancy Telemetry
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-zinc-800 text-zinc-400 uppercase">
                  <tr>
                    <th className="py-3 pr-4">Film</th>
                    <th className="py-3 pr-4">Cinema / Auditorium</th>
                    <th className="py-3 pr-4">Start Time</th>
                    <th className="py-3 pr-4">Booked / Held / Cap</th>
                    <th className="py-3">Occupancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {(occupancyReport || []).map((row) => (
                    <tr key={row.showId}>
                      <td className="py-3 pr-4 font-sans font-semibold text-zinc-100">
                        {row.movieTitle}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {row.cinemaName} · {row.screenName}
                      </td>
                      <td className="py-3 pr-4 text-amber-400">
                        {new Date(row.startTime).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {row.bookedSeats} sold · {row.heldSeats} held / {row.totalCapacity}
                      </td>
                      <td className="py-3">
                        <span className="rounded bg-amber-400/15 px-2 py-0.5 text-amber-300">
                          {row.occupancyPercent || 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEDULE SHOWTIME & PRICING */}
      {activeTab === 'shows' && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <form
            onSubmit={handleScheduleShow}
            className="md:col-span-7 rounded border border-zinc-800 bg-[#111115] p-6 space-y-4"
          >
            <h2 className="font-display text-xl font-bold text-white">
              Schedule New Screening (With Overlap & Turnaround Protection)
            </h2>

            {scheduleMsg && (
              <div
                className={`rounded border p-3 text-xs ${
                  scheduleMsg.type === 'success'
                    ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                    : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
                }`}
              >
                {scheduleMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Authorized Cinema
                </label>
                <select
                  value={cinemaId || managedCinemas?.[0]?.id || ''}
                  onChange={(e) => setCinemaId(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                >
                  {(managedCinemas || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Auditorium Screen
                </label>
                <select
                  value={screenId || cinemaDetail?.screens?.[0]?.id || ''}
                  onChange={(e) => setScreenId(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                >
                  {(cinemaDetail?.screens || []).map((sc: any) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Movie Title
                </label>
                <select
                  value={movieId || movies?.[0]?.id || ''}
                  onChange={(e) => setMovieId(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                >
                  {(movies || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.durationMinutes}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                  STANDARD (₹)
                </label>
                <input
                  type="number"
                  value={priceStandard}
                  onChange={(e) => setPriceStandard(Number(e.target.value))}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                  PRIME (₹)
                </label>
                <input
                  type="number"
                  value={pricePrime}
                  onChange={(e) => setPricePrime(Number(e.target.value))}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                  RECLINER (₹)
                </label>
                <input
                  type="number"
                  value={priceRecliner}
                  onChange={(e) => setPriceRecliner(Number(e.target.value))}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded bg-amber-400 px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
            >
              Publish Showtime & Initialize Seat Inventory
            </button>
          </form>

          <div className="md:col-span-5 rounded border border-zinc-800 bg-[#111115] p-6 space-y-3">
            <h3 className="font-mono text-xs uppercase tracking-wider text-amber-400">
              Scheduling Conflict Rules
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Every screen enforces an automatic turnaround buffer (20–25 minutes) after the film&apos;s runtime. Attempting to schedule a show that overlaps an existing screening + turnaround window returns <code>HTTP 409 CONFLICT</code>.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: SCREENS & SEAT LAYOUTS */}
      {activeTab === 'screens' && (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <form
            onSubmit={handleCreateScreen}
            className="md:col-span-5 rounded border border-zinc-800 bg-[#111115] p-6 space-y-4"
          >
            <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-400" />
              Create New Auditorium Screen
            </h2>

            {screenMsg && (
              <div className="rounded border border-amber-400/40 bg-amber-400/10 p-3 text-xs text-amber-200">
                {screenMsg}
              </div>
            )}

            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Cinema Location
              </label>
              <select
                value={newScreenCinemaId || managedCinemas?.[0]?.id || ''}
                onChange={(e) => setNewScreenCinemaId(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              >
                {(managedCinemas || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs text-zinc-400 mb-1">
                Auditorium Name
              </label>
              <input
                type="text"
                required
                placeholder="Auditorium 3 · Director's Suite"
                value={newScreenName}
                onChange={(e) => setNewScreenName(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Seating Rows (3-20)
                </label>
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={newScreenRows}
                  onChange={(e) => setNewScreenRows(Number(e.target.value))}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
              <div>
                <label className="block font-mono text-xs text-zinc-400 mb-1">
                  Columns per Row (4-24)
                </label>
                <input
                  type="number"
                  min={4}
                  max={24}
                  value={newScreenCols}
                  onChange={(e) => setNewScreenCols(Number(e.target.value))}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded bg-amber-400 px-5 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
            >
              Generate Screen & Seat Matrix
            </button>
          </form>

          <div className="md:col-span-7 rounded border border-zinc-800 bg-[#111115] p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-white">
              Configured Screens ({cinemaDetail?.name})
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(cinemaDetail?.screens || []).map((sc: any) => (
                <div
                  key={sc.id}
                  className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-1"
                >
                  <p className="font-bold text-sm text-zinc-100">{sc.name}</p>
                  <p className="font-mono text-xs text-amber-400">
                    {sc.formatType} · {sc.soundSystem}
                  </p>
                  <p className="font-mono text-xs text-zinc-400">
                    Dimensions: {sc.totalRows} Rows × {sc.totalCols} Cols (
                    {sc.totalRows * sc.totalCols} Physical Seats)
                  </p>
                  <p className="font-mono text-[11px] text-zinc-500">
                    Turnaround Buffer: {sc.turnaroundMinutes}m · Layout v{sc.layoutVersion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CRYPTOGRAPHIC QR TICKET GATE SCANNER */}
      {activeTab === 'scanner' && (
        <div className="mx-auto max-w-2xl rounded border border-zinc-800 bg-[#111115] p-8 space-y-6">
          <div className="space-y-1">
            <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
              Gate Entry Verification
            </span>
            <h2 className="font-display text-2xl font-bold text-white">
              Validate Customer QR Ticket
            </h2>
            <p className="text-xs text-zinc-400">
              Paste a signed <code>TXQR...</code> token or ticket code (e.g., <code>TIX-...</code>). Duplicate scans are automatically rejected with HTTP 409.
            </p>
          </div>

          <form onSubmit={handleValidateTicket} className="flex gap-3">
            <input
              type="text"
              required
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Paste TXQR... signed token or TIX-... ticket code"
              className="flex-1 rounded border border-zinc-800 bg-zinc-950 px-4 py-2.5 font-mono text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded bg-amber-400 px-5 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
            >
              Verify & Check-In
            </button>
          </form>

          {scanError && (
            <div className="flex items-start gap-3 rounded border border-rose-500/50 bg-rose-950/30 p-4 text-xs text-rose-200">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <div>
                <p className="font-bold uppercase font-mono"> Entry Rejected</p>
                <p className="mt-1">{scanError}</p>
              </div>
            </div>
          )}

          {scanResult && (
            <div className="rounded border border-emerald-500/50 bg-emerald-950/20 p-5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold uppercase">
                <CheckCircle2 className="h-5 w-5" />
                Valid Ticket — Gate Check-In Recorded
              </div>
              <p className="text-zinc-200 font-semibold text-base">
                {scanResult.movieTitle}
              </p>
              <p className="text-zinc-300">
                {scanResult.cinemaName} · {scanResult.screenName}
              </p>
              <p className="font-mono text-amber-400 font-bold">
                Admit Seats: {(scanResult.seatCodes || []).join(', ')}
              </p>
              <p className="font-mono text-[11px] text-zinc-400">
                Ticket Code: {scanResult.ticketCode} · Checked in at{' '}
                {new Date(scanResult.checkedInAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: BOOKINGS LEDGER */}
      {activeTab === 'bookings' && (
        <div className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">
            Scoped Cinema Bookings ({managerBookings?.length || 0})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-zinc-800 text-zinc-400 uppercase">
                <tr>
                  <th className="py-3 pr-4">Booking Ref</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Film & Auditorium</th>
                  <th className="py-3 pr-4">Total</th>
                  <th className="py-3 pr-4">Booking Status</th>
                  <th className="py-3">Ticket / Gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {(managerBookings || []).map((b) => (
                  <tr key={b.id}>
                    <td className="py-3 pr-4 font-bold text-amber-400">
                      {b.bookingReference}
                    </td>
                    <td className="py-3 pr-4 text-zinc-300">
                      {b.customerName} ({b.customerEmail})
                    </td>
                    <td className="py-3 pr-4 text-zinc-200">
                      {b.movieTitle} · {b.screenName}
                    </td>
                    <td className="py-3 pr-4 text-zinc-100">
                      ₹{b.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-zinc-900 border border-zinc-700 px-2 py-0.5 text-zinc-200">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-300">
                      {b.ticketCode ? (
                        <span>
                          {b.ticketCode} ({b.ticketStatus})
                        </span>
                      ) : (
                        '—'
                      )}
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

