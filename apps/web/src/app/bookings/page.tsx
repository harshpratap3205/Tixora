'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ticket,
  QrCode,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useApp } from '@/components/Providers';

export default function MyBookingsPage() {
  const { user, loginWithCredentials } = useApp();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['my-bookings', user?.id],
    queryFn: () => apiFetch<any[]>('/users/me/bookings'),
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-3xl font-bold text-white">
          Sign in to view your bookings
        </h1>
        <p className="text-sm text-zinc-400">
          Use the instant demo switcher in the top bar or sign in with your account.
        </p>
        <button
          onClick={() => loginWithCredentials('aarav@tixora.cinema', 'Tixora@2026')}
          className="rounded bg-amber-400 px-5 py-2.5 text-sm font-semibold text-zinc-950"
        >
          Instant Sign In as Demo Customer (Aarav)
        </button>
      </div>
    );
  }

  const handleCancelBooking = async (bookingId: string) => {
    setErrorMsg('');
    setCancellingId(bookingId);
    try {
      await apiFetch(`/bookings/${bookingId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Customer requested cancellation via My Bookings' }),
      });
      await queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Cancellation failed');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 space-y-8">
      <div className="border-b border-zinc-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
            Personal Pass Vault
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            My Bookings & Digital Tickets
          </h1>
        </div>
        <Link
          href="/movies"
          className="inline-flex items-center gap-1.5 rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          Book Another Film <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {errorMsg && (
        <div className="rounded border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-44 animate-pulse rounded border border-zinc-800 bg-zinc-900/40"
            />
          ))}
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-[#111115] p-12 text-center space-y-4">
          <Ticket className="mx-auto h-10 w-10 text-amber-400" />
          <h2 className="font-display text-xl text-white">
            You haven&apos;t reserved any screenings yet
          </h2>
          <p className="text-xs text-zinc-400">
            Select a film, lock your seats, and complete sandbox checkout to generate your cryptographic QR pass.
          </p>
          <Link
            href="/movies"
            className="inline-block rounded bg-amber-400 px-5 py-2.5 text-xs font-semibold text-zinc-950"
          >
            Browse Now Showing
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="rounded border border-zinc-800 bg-[#111115] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
            >
              <div className="flex gap-4">
                {b.posterUrl && (
                  <img
                    src={b.posterUrl}
                    alt={b.movieTitle}
                    className="h-28 w-20 rounded object-cover shrink-0"
                  />
                )}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <span className="text-amber-400 font-bold">
                      {b.bookingReference}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] uppercase font-bold ${
                        b.status === 'CONFIRMED'
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : b.status === 'PENDING_PAYMENT'
                          ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {b.status}
                    </span>
                    {b.ticketStatus && (
                      <span className="rounded bg-zinc-900 border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                        Ticket: {b.ticketStatus}
                      </span>
                    )}
                  </div>

                  <h2 className="font-display text-xl font-bold text-white">
                    {b.movieTitle}
                  </h2>
                  <p className="text-xs text-zinc-300">
                    {b.cinemaName} · {b.screenName} ({b.format})
                  </p>
                  <p className="font-mono text-xs text-zinc-400">
                    {new Date(b.startTime).toLocaleString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    · Seats:{' '}
                    <strong className="text-amber-300">
                      {(b.seats || []).map((s: any) => s.seatCode).join(', ')}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-end md:self-center">
                <div className="text-right mr-2 font-mono">
                  <span className="block text-[10px] uppercase text-zinc-500">
                    Total Paid
                  </span>
                  <span className="text-base font-bold text-white">
                    ₹{b.totalAmount.toFixed(2)}
                  </span>
                </div>

                {b.status === 'CONFIRMED' && (
                  <Link
                    href={`/bookings/${b.id}/ticket`}
                    className="inline-flex items-center gap-1.5 rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    View QR Ticket
                  </Link>
                )}

                {b.status === 'PENDING_PAYMENT' && (
                  <Link
                    href={`/checkout/${b.id}`}
                    className="inline-flex items-center gap-1.5 rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    Complete Checkout
                  </Link>
                )}

                {(b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT') &&
                  b.ticketStatus !== 'CHECKED_IN' && (
                    <button
                      onClick={() => handleCancelBooking(b.id)}
                      disabled={cancellingId === b.id}
                      className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:border-rose-500/50 hover:text-rose-300"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {cancellingId === b.id ? 'Cancelling...' : 'Cancel & Refund'}
                    </button>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

