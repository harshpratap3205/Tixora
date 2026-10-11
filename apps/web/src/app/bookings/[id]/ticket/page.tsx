'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Calendar,
  Clock,
  Copy,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const [copied, setCopied] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', params.id],
    queryFn: () => apiFetch<any>(`/bookings/${params.id}/ticket`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="h-96 animate-pulse rounded border border-zinc-800 bg-zinc-900/40" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center space-y-4">
        <p className="font-display text-2xl text-zinc-200">
          Ticket not found or booking not yet confirmed
        </p>
        <Link
          href="/bookings"
          className="inline-block rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950"
        >
          Return to My Bookings
        </Link>
      </div>
    );
  }

  const copyToken = () => {
    navigator.clipboard.writeText(ticket.qrToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-zinc-400 hover:text-amber-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to My Bookings
        </Link>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-3.5 py-1.5 text-xs font-mono uppercase tracking-wider text-zinc-200 hover:border-amber-400"
        >
          <Printer className="h-3.5 w-3.5 text-amber-400" />
          Print / Save PDF
        </button>
      </div>

      {/* Digital Cinema Pass Card */}
      <div className="overflow-hidden rounded-lg border border-amber-400/50 bg-[#111115] shadow-2xl">
        {/* Top Banner */}
        <div className="border-b border-zinc-800 bg-gradient-to-r from-zinc-950 via-[#17171f] to-zinc-950 px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-display text-sm font-bold tracking-[0.22em] text-amber-400">
              TIXORA PREMIERE PASS
            </span>
            <p className="font-mono text-[11px] text-zinc-400">
              Booking Ref: {ticket.bookingReference} · Ticket: {ticket.ticketCode}
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1 font-mono text-xs font-bold uppercase ${
              ticket.status === 'ISSUED'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                : ticket.status === 'CHECKED_IN'
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/40'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {ticket.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left Stub: Movie & Auditorium Info */}
          <div className="md:col-span-8 p-6 sm:p-8 space-y-6 border-b md:border-b-0 md:border-r border-dashed border-zinc-800">
            <div className="flex gap-5">
              {ticket.posterUrl && (
                <img
                  src={ticket.posterUrl}
                  alt={ticket.movieTitle}
                  className="h-32 w-24 rounded border border-zinc-700 object-cover shrink-0"
                />
              )}
              <div className="space-y-1.5">
                <span className="rounded bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-300">
                  {ticket.format} · {ticket.language} · {ticket.ageRating}
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  {ticket.movieTitle}
                </h1>
                <p className="flex items-center gap-1.5 text-xs text-zinc-300">
                  <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  {ticket.cinemaName} ({ticket.cinemaCity})
                </p>
                <p className="text-xs text-zinc-500">{ticket.cinemaAddress}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">
                  Show Date & Time
                </span>
                <span className="mt-1 flex items-center gap-1.5 font-bold text-zinc-100">
                  <Calendar className="h-3.5 w-3.5 text-amber-400" />
                  {new Date(ticket.startTime).toLocaleDateString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(ticket.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px] uppercase">
                  Auditorium & Seats
                </span>
                <span className="mt-1 block font-bold text-zinc-100">
                  {ticket.screenName}
                </span>
                <span className="mt-0.5 block text-sm font-bold text-amber-400">
                  Seats: {(ticket.seatCodes || []).join(', ')}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  HMAC-SHA256 Signed QR Token (Copy to test Staff Gate Scanner):
                </span>
                <button
                  onClick={copyToken}
                  className="inline-flex items-center gap-1 text-amber-400 hover:underline"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy Token
                    </>
                  )}
                </button>
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] text-zinc-400 break-all">
                {ticket.qrToken}
              </div>
            </div>
          </div>

          {/* Right Stub: Scannable QR Code */}
          <div className="md:col-span-4 p-6 flex flex-col items-center justify-center bg-zinc-950/60 space-y-4">
            <div className="rounded-lg bg-white p-3.5 shadow-lg">
              <QRCodeSVG value={ticket.qrToken} size={160} level="M" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-mono text-xs font-bold text-zinc-200">
                {ticket.ticketCode}
              </p>
              <p className="text-[11px] text-zinc-500">
                Present at cinema gate for cryptographic verification
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

