'use client';

import React from 'react';
import {
  X,
  GraduationCap,
  ShieldCheck,
  Zap,
  Database,
  Cpu,
  Layers,
  CheckCircle2,
  ExternalLink,
  Code2,
} from 'lucide-react';

interface ProjectShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectShowcaseModal({
  isOpen,
  onClose,
}: ProjectShowcaseModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-amber-400/40 bg-[#0F0F14] text-zinc-100 shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-400">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded bg-amber-400/10 px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-amber-300">
                Final Year Engineering Capstone · Portfolio Demo
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white mt-1">
                Tixora — High-Concurrency Cinema Platform
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:border-zinc-700 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Academic Problem Statement */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/70 p-4 space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <Cpu className="h-4 w-4" /> Academic & Engineering Objective
          </h3>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Real-world movie ticketing platforms (e.g. BookMyShow, Fandango) experience high concurrency bursts where hundreds of users attempt to book the exact same auditorium seats within milliseconds. This project demonstrates how to guarantee <strong className="text-white">Zero Double-Booking</strong> using strict PostgreSQL ACID row locking (<code className="text-amber-300">SELECT ... FOR UPDATE</code> with deterministic sorting) without relying on fragile distributed caches or microservice overhead.
          </p>
        </div>

        {/* 4 Core Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-800 bg-[#14141B] p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <ShieldCheck className="h-4 w-4" />
              1. Concurrency-Safe Row Locking
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              When reserving seats, rows are sorted alphabetically and locked using <code className="text-amber-300">ORDER BY seat_code ASC FOR UPDATE</code>. This mathematical guarantee prevents deadlock cycles and guarantees that exactly 1 customer acquires the seat while competing requests receive <code className="text-amber-300">409 Conflict</code>.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#14141B] p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Zap className="h-4 w-4" />
              2. Cryptographic Gate Passes (TXQR)
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Tickets generate tamper-proof QR tokens signed with server-side HMAC-SHA256 secret keys. Cinema managers scan passes at the gate using constant-time verification, instantly detecting screenshot fraud and rejecting duplicate check-ins.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#14141B] p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Layers className="h-4 w-4" />
              3. Dual-Token JWT & Scoped RBAC
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Features short-lived 15-minute access tokens and rotating HTTP-only refresh tokens stored as SHA-256 hashes in PostgreSQL. Cinema staff permissions are strictly resource-scoped to their designated venue (e.g. Mumbai vs. Delhi).
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#14141B] p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <Database className="h-4 w-4" />
              4. Payment Reconciliation & Safety Net
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Handles the classic race condition where a hold expires while payment is processing and another user takes the seat. The system safely transitions late payments to <code className="text-amber-300">REFUND_REQUIRED</code> instead of double-booking.
            </p>
          </div>
        </div>

        {/* Tech Stack Matrix */}
        <div className="space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">
            Technology Stack & Standards
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
            <div className="rounded border border-zinc-800 bg-zinc-950 p-2 text-center text-zinc-300">
              <span className="block text-amber-400 font-semibold">Next.js 14</span>
              App Router (SSR)
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-2 text-center text-zinc-300">
              <span className="block text-amber-400 font-semibold">Node.js + Express</span>
              Modular Monolith
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-2 text-center text-zinc-300">
              <span className="block text-amber-400 font-semibold">PostgreSQL 16</span>
              21 Bounded Tables
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-2 text-center text-zinc-300">
              <span className="block text-amber-400 font-semibold">Docker & Compose</span>
              Full Stack Container
            </div>
          </div>
        </div>

        {/* Verification Checkmarks */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-4 space-y-2 text-xs text-zinc-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>8 Vitest integration & concurrency tests passing</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Zod validation on all API requests</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>OpenAPI 3.0 / Swagger UI live at /api-docs</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Embedded PostgreSQL fallback for zero-config run</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-400">
            Open-source college project demonstration repository.
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://tixora-6j4h.onrender.com/api-docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:border-amber-400 hover:text-amber-300 transition"
            >
              <Code2 className="h-3.5 w-3.5" />
              Swagger API Docs
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              onClick={onClose}
              className="rounded bg-amber-400 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition"
            >
              Close Showcase
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
