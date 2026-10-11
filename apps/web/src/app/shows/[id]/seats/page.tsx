'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Clock,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch, ShowSeat, Showtime } from '@/lib/api';
import { useApp } from '@/components/Providers';

interface HoldResponse {
  id: string;
  showId: string;
  status: string;
  expiresAt: string;
  totalAmount: number;
  currency: string;
  seats: Array<{
    showSeatId: string;
    seatCode: string;
    category: string;
    price: number;
  }>;
}

export default function SeatSelectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loginWithCredentials } = useApp();

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [activeHold, setActiveHold] = useState<HoldResponse | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isHolding, setIsHolding] = useState(false);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['show-seats', params.id],
    queryFn: () =>
      apiFetch<{ show: Showtime; seats: ShowSeat[] }>(`/shows/${params.id}/seats`),
    refetchInterval: 8000,
  });

  // Live countdown timer based on server expiresAt timestamp
  useEffect(() => {
    if (!activeHold) return;
    const updateTimer = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(activeHold.expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(diff);
      if (diff <= 0) {
        setActiveHold(null);
        setErrorMsg('Your temporary seat hold expired. Please select your seats again.');
        refetch();
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [activeHold, refetch]);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="h-[520px] animate-pulse rounded border border-zinc-800 bg-zinc-900/40" />
      </div>
    );
  }

  const { show, seats } = data;

  // Group seats by rowLabel
  const rowsMap = new Map<string, ShowSeat[]>();
  for (const s of seats) {
    const arr = rowsMap.get(s.rowLabel) || [];
    arr.push(s);
    rowsMap.set(s.rowLabel, arr);
  }

  const toggleSeat = (seat: ShowSeat) => {
    if (activeHold) {
      setErrorMsg(
        'You have an active server hold. Proceed to checkout or release the current hold to change seats.'
      );
      return;
    }
    if (seat.status !== 'AVAILABLE') return;
    setErrorMsg('');

    setSelectedSeats((prev) => {
      if (prev.includes(seat.seatCode)) {
        return prev.filter((c) => c !== seat.seatCode);
      }
      if (prev.length >= 10) {
        setErrorMsg('Maximum 10 seats allowed per reservation.');
        return prev;
      }
      return [...prev, seat.seatCode].sort();
    });
  };

  const selectedSeatObjects = seats.filter((s) =>
    selectedSeats.includes(s.seatCode)
  );
  const liveTotal = selectedSeatObjects.reduce((sum, s) => sum + s.price, 0);

  const handleCreateHold = async () => {
    setErrorMsg('');
    if (selectedSeats.length === 0) return;

    setIsHolding(true);
    try {
      // If user is not signed in, automatically sign in as Demo Customer Aarav so checkout can be tested seamlessly
      if (!user) {
        await loginWithCredentials('aarav@tixora.cinema', 'Tixora@2026');
      }

      const hold = await apiFetch<HoldResponse>('/seat-holds', {
        method: 'POST',
        body: JSON.stringify({
          showId: show.id,
          seatCodes: selectedSeats,
        }),
      });
      setActiveHold(hold);
      await queryClient.invalidateQueries({ queryKey: ['show-seats', params.id] });
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          'One or more selected seats were just claimed by another customer.'
      );
      setSelectedSeats([]);
      refetch();
    } finally {
      setIsHolding(false);
    }
  };

  const handleReleaseHold = async () => {
    if (!activeHold) return;
    try {
      await apiFetch(`/seat-holds/${activeHold.id}`, { method: 'DELETE' });
    } catch {
      // Ignore error
    }
    setActiveHold(null);
    setSelectedSeats([]);
    refetch();
  };

  const handleProceedToCheckout = async () => {
    if (!activeHold) return;
    setIsCreatingBooking(true);
    setErrorMsg('');
    try {
      const booking = await apiFetch<{ id: string }>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          holdId: activeHold.id,
          idempotencyKey: `idem_book_${activeHold.id}`,
        }),
      });
      router.push(`/checkout/${booking.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize booking.');
      setIsCreatingBooking(false);
    }
  };

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-amber-400">
            <span>{show.cinemaName}</span>
            <span>·</span>
            <span>{show.screenName}</span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            {show.movieTitle}
          </h1>
          <p className="mt-1 font-mono text-xs text-zinc-400">
            {new Date(show.startTime).toLocaleDateString([], {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}{' '}
            at{' '}
            {new Date(show.startTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {show.format} · {show.language}
          </p>
        </div>

        {/* Active Hold Countdown Badge */}
        {activeHold && (
          <div className="flex items-center gap-3 rounded border border-amber-400 bg-amber-400/15 px-4 py-2.5">
            <Clock className="h-5 w-5 text-amber-400 animate-pulse" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-amber-300">
                Server Seat Hold Active
              </p>
              <p className="font-mono text-lg font-bold text-white">
                Expires in {formatCountdown(secondsLeft)}
              </p>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-3 rounded border border-rose-500/50 bg-rose-950/30 p-4 text-sm text-rose-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left/Center: Interactive Auditorium Seat Map */}
        <div className="lg:col-span-8 rounded border border-zinc-800 bg-[#111115] p-6 sm:p-8 overflow-x-auto">
          {/* Curved Cinema Screen Graphic */}
          <div className="mx-auto mb-12 max-w-xl text-center">
            <div className="h-2.5 w-full rounded-t-full bg-gradient-to-r from-zinc-800 via-amber-400/80 to-zinc-800 shadow-[0_10px_30px_rgba(245,176,65,0.28)]" />
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.35em] text-zinc-500">
              {show.screenFormat || 'IMAX'} PROJECTION SCREEN THIS WAY
            </p>
          </div>

          {/* Seat Rows */}
          <div className="min-w-[540px] space-y-3">
            {Array.from(rowsMap.entries()).map(([rowLabel, rowSeats]) => {
              const rowCategory = rowSeats[0]?.category || 'PRIME';
              const rowPrice = rowSeats[0]?.price || 450;

              return (
                <div
                  key={rowLabel}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="w-16 shrink-0 flex items-center gap-2 font-mono text-xs">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-800 bg-zinc-900 font-bold text-zinc-300">
                      {rowLabel}
                    </span>
                    <span className="text-[10px] text-zinc-500">₹{rowPrice}</span>
                  </div>

                  <div className="flex flex-1 items-center justify-center gap-1.5 sm:gap-2">
                    {rowSeats.map((seat, idx) => {
                      const isSelected = selectedSeats.includes(seat.seatCode);
                      const isHeldByMe =
                        activeHold?.seats.some((s) => s.seatCode === seat.seatCode) ??
                        false;

                      // Add subtle center aisle spacing
                      const addAisleMargin =
                        idx === 2 || idx === rowSeats.length - 3 ? 'mr-3' : '';

                      let btnStyle =
                        'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-amber-400 hover:text-amber-300';
                      if (isHeldByMe || isSelected) {
                        btnStyle =
                          'border-amber-300 bg-amber-400 text-zinc-950 font-bold shadow-[0_0_12px_rgba(245,176,65,0.45)]';
                      } else if (seat.status === 'HELD') {
                        btnStyle =
                          'border-amber-700/50 bg-amber-950/40 text-amber-500/60 cursor-not-allowed';
                      } else if (seat.status === 'BOOKED') {
                        btnStyle =
                          'border-zinc-800 bg-zinc-950 text-zinc-700 cursor-not-allowed line-through';
                      } else if (seat.status === 'BLOCKED') {
                        btnStyle =
                          'border-zinc-900 bg-zinc-950/40 text-zinc-800 cursor-not-allowed';
                      }

                      return (
                        <button
                          key={seat.id}
                          type="button"
                          disabled={
                            (seat.status !== 'AVAILABLE' && !isHeldByMe) ||
                            Boolean(activeHold)
                          }
                          onClick={() => toggleSeat(seat)}
                          title={`${seat.seatCode} · ${seat.category} · ₹${seat.price} (${seat.status})`}
                          className={`h-8 w-8 sm:h-9 sm:w-9 rounded-t-md border font-mono text-[11px] transition ${btnStyle} ${addAisleMargin}`}
                        >
                          {seat.seatNumber}
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-20 shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    {rowCategory}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 border-t border-zinc-800/80 pt-5 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-t border border-zinc-700 bg-zinc-900" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-t border border-amber-300 bg-amber-400" />
              <span>Selected / Your Hold</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-t border border-amber-700/50 bg-amber-950/50" />
              <span>Held by Other</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-t border border-zinc-800 bg-zinc-950" />
              <span>Sold / Booked</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Reservation Summary */}
        <div className="lg:col-span-4 rounded border border-zinc-800 bg-[#111115] p-6 space-y-6 sticky top-28">
          <div className="border-b border-zinc-800 pb-4">
            <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
              Reservation Ledger
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-white">
              Seat Summary
            </h2>
          </div>

          {selectedSeats.length === 0 && !activeHold ? (
            <div className="py-8 text-center space-y-2 text-zinc-500 text-xs">
              <p>Click on any available seat in the auditorium map to begin.</p>
              <p className="font-mono text-[11px] text-zinc-600">
                Up to 10 seats per transaction · All-or-nothing atomic lock
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {(activeHold ? activeHold.seats : selectedSeatObjects).map((s) => (
                  <div
                    key={s.seatCode}
                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-amber-400">{s.seatCode}</span>
                      <span className="ml-2 text-zinc-400">{s.category}</span>
                    </div>
                    <span className="text-zinc-100">₹{s.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
                <span className="text-xs uppercase font-mono text-zinc-400">
                  Ticket Subtotal
                </span>
                <span className="font-mono text-xl font-bold text-amber-400">
                  ₹{(activeHold ? activeHold.totalAmount : liveTotal).toFixed(2)}
                </span>
              </div>

              {!activeHold ? (
                <button
                  onClick={handleCreateHold}
                  disabled={isHolding}
                  className="w-full flex items-center justify-center gap-2 rounded bg-amber-400 py-3 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isHolding
                    ? 'Locking Seats in PostgreSQL...'
                    : `Lock ${selectedSeats.length} Seat${
                        selectedSeats.length > 1 ? 's' : ''
                      } (8-Min Hold)`}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded border border-emerald-500/40 bg-emerald-950/20 p-3 text-xs text-emerald-300 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                    <div>
                      <p className="font-semibold">Seats Locked Exclusively For You</p>
                      <p className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
                        Hold ID: {activeHold.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleProceedToCheckout}
                    disabled={isCreatingBooking}
                    className="w-full flex items-center justify-center gap-2 rounded bg-amber-400 py-3 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isCreatingBooking
                      ? 'Preparing Checkout...'
                      : 'Proceed to Sandbox Checkout'}
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <button
                    onClick={handleReleaseHold}
                    className="w-full flex items-center justify-center gap-1.5 rounded border border-zinc-800 bg-zinc-950 py-2 text-xs text-zinc-400 hover:border-rose-500/40 hover:text-rose-300"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Release Hold & Change Seats
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-zinc-800/80 pt-4 text-[11px] text-zinc-500 leading-relaxed">
            <strong className="text-zinc-400">Concurrency Guarantee:</strong> Selecting a seat on the client does not reserve it until you click{' '}
            <em>Lock Seats</em>, which executes an atomic `SELECT ... FOR UPDATE` transaction in PostgreSQL.
          </div>
        </div>
      </div>
    </div>
  );
}

