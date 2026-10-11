'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  Ticket,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch, API_BASE_URL } from '@/lib/api';

export default function CheckoutPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();

  const [paymentIntent, setPaymentIntent] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('CARD_SANDBOX');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  const { data: booking, isLoading, refetch } = useQuery({
    queryKey: ['booking-checkout', params.bookingId],
    queryFn: () => apiFetch<any>(`/bookings/${params.bookingId}`),
  });

  useEffect(() => {
    if (!booking?.holdExpiresAt) return;
    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(booking.holdExpiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(diff);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [booking?.holdExpiresAt]);

  useEffect(() => {
    if (booking?.status === 'CONFIRMED') {
      router.push(`/bookings/${booking.id}/ticket`);
    }
  }, [booking?.status, booking?.id, router]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="h-96 animate-pulse rounded border border-zinc-800 bg-zinc-900/40" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <p className="font-display text-2xl text-zinc-200">Booking not found</p>
      </div>
    );
  }

  const handleCreateIntent = async () => {
    setErrorMsg('');
    setProcessing(true);
    try {
      const intent = await apiFetch<any>('/payments/intents', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: booking.id,
          idempotencyKey: `idem_pay_${booking.id}_${Date.now()}`,
          paymentMethod,
        }),
      });
      setPaymentIntent(intent);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not initialize payment intent');
    } finally {
      setProcessing(false);
    }
  };

  const handleCompleteSandboxPayment = async (outcome: 'SUCCEED' | 'FAIL') => {
    if (!paymentIntent) return;
    setProcessing(true);
    setErrorMsg('');
    try {
      if (outcome === 'SUCCEED') {
        const { samplePayload, signature } = paymentIntent.sandboxWebhookHelper;
        const res = await fetch(
          `${API_BASE_URL}/payments/webhooks/tixora_sandbox`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tixora-signature': signature,
            },
            body: JSON.stringify(samplePayload),
          }
        );
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error?.message || 'Webhook processing failed');
        }
        await refetch();
        router.push(`/bookings/${booking.id}/ticket`);
      } else {
        setErrorMsg(
          'Sandbox payment was declined by simulated issuer. Your seat hold is still active — you can retry payment.'
        );
        setPaymentIntent(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Payment verification failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
            Booking Reference · {booking.bookingReference}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            Review & Sandbox Checkout
          </h1>
        </div>

        {booking.status === 'PENDING_PAYMENT' && (
          <div className="flex items-center gap-2.5 rounded border border-amber-400/50 bg-amber-400/10 px-4 py-2 font-mono text-xs text-amber-300">
            <Clock className="h-4 w-4 animate-pulse text-amber-400" />
            <span>
              Hold Expires in {Math.floor(secondsLeft / 60)}:
              {(secondsLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-3 rounded border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        {/* Left: Order & Seat Breakdown */}
        <div className="md:col-span-7 space-y-6">
          <div className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-5">
            <div className="flex gap-4 border-b border-zinc-800 pb-5">
              {booking.posterUrl && (
                <img
                  src={booking.posterUrl}
                  alt={booking.movieTitle}
                  className="h-28 w-20 rounded object-cover"
                />
              )}
              <div className="space-y-1">
                <span className="rounded bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-300">
                  {booking.format} · {booking.language}
                </span>
                <h2 className="font-display text-2xl font-bold text-white">
                  {booking.movieTitle}
                </h2>
                <p className="text-xs text-zinc-300">{booking.cinemaName}</p>
                <p className="text-xs text-zinc-400">
                  {booking.screenName} ·{' '}
                  {new Date(booking.startTime).toLocaleString([], {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {/* Selected Seats */}
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                Reserved Seats ({booking.seats?.length || 0})
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(booking.seats || []).map((s: any) => (
                  <div
                    key={s.seatCode}
                    className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs"
                  >
                    <span className="font-bold text-amber-400">{s.seatCode}</span>
                    <span className="text-zinc-300">₹{s.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Breakdown */}
            <div className="space-y-2 border-t border-zinc-800 pt-4 text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Tickets Subtotal</span>
                <span>₹{booking.subtotalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Platform Convenience Fee (8%)</span>
                <span>₹{booking.convenienceFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Integrated GST (18% on Fee)</span>
                <span>₹{booking.taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-3 text-base font-bold text-white">
                <span>Total Payable</span>
                <span className="text-amber-400">
                  ₹{booking.totalAmount.toFixed(2)} {booking.currency}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Payment Provider Sandbox Gateway */}
        <div className="md:col-span-5">
          <div className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                  Tixora Sandbox Gateway
                </p>
                <h2 className="font-display text-xl font-bold text-white mt-0.5">
                  Payment Authorization
                </h2>
              </div>
              <Lock className="h-5 w-5 text-amber-400" />
            </div>

            {!paymentIntent ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block font-mono text-xs uppercase text-zinc-400">
                    Select Payment Method
                  </label>
                  {[
                    { id: 'CARD_SANDBOX', label: 'Credit / Debit Card (Sandbox)' },
                    { id: 'UPI_INSTANT', label: 'UPI Instant Pay (Sandbox)' },
                    { id: 'NETBANKING', label: 'Premier NetBanking (Sandbox)' },
                  ].map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 rounded border p-3 text-xs cursor-pointer transition ${
                        paymentMethod === m.id
                          ? 'border-amber-400 bg-amber-400/10 text-white'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={m.id}
                        checked={paymentMethod === m.id}
                        onChange={() => setPaymentMethod(m.id)}
                        className="accent-amber-400"
                      />
                      <CreditCard className="h-4 w-4 text-amber-400" />
                      <span className="font-medium">{m.label}</span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={handleCreateIntent}
                  disabled={processing || secondsLeft <= 0}
                  className="w-full rounded bg-amber-400 py-3 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {processing
                    ? 'Creating Payment Intent...'
                    : `Pay ₹${booking.totalAmount.toFixed(2)}`}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded border border-amber-400/30 bg-zinc-950 p-4 space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Intent ID:</span>
                    <span className="text-amber-300">{paymentIntent.providerIntentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Status:</span>
                    <span className="text-zinc-200">{paymentIntent.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Webhook Security:</span>
                    <span className="text-emerald-400">HMAC-SHA256 Signed</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  Simulate the external payment provider webhook callback. Choosing{' '}
                  <strong className="text-emerald-400">Authorize & Dispatch Signed Webhook</strong>{' '}
                  sends an HMAC-SHA256 signed `payment.succeeded` event to{' '}
                  <code>/api/v1/payments/webhooks/tixora_sandbox</code>, confirming seat ownership and generating your QR ticket.
                </p>

                <button
                  onClick={() => handleCompleteSandboxPayment('SUCCEED')}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 rounded bg-emerald-500 py-3 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {processing
                    ? 'Verifying Signed Webhook...'
                    : 'Authorize & Dispatch Signed Webhook'}
                </button>

                <button
                  onClick={() => handleCompleteSandboxPayment('FAIL')}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 rounded border border-rose-500/40 bg-rose-950/30 py-2.5 px-4 text-xs font-medium text-rose-300 hover:bg-rose-950/50"
                >
                  <XCircle className="h-4 w-4" />
                  Simulate Payment Failure
                </button>
              </div>
            )}

            <div className="border-t border-zinc-800/80 pt-4 flex items-center gap-2 text-[11px] text-zinc-500">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                Idempotent webhook verification prevents duplicate charges and reconciles late payments safely.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

