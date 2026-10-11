'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, Ticket, Film, Layers } from 'lucide-react';
import { apiFetch, Cinema, Showtime } from '@/lib/api';
import { useApp } from '@/components/Providers';

interface CinemaDetail extends Cinema {
  screens: Array<{
    id: string;
    name: string;
    formatType: string;
    soundSystem: string;
    totalRows: number;
    totalCols: number;
  }>;
  shows: Showtime[];
}

export default function CinemasPage() {
  const { city, setCity } = useApp();
  const [search, setSearch] = useState('');
  const [selectedCinemaId, setSelectedCinemaId] = useState<string>('');

  const { data: cinemas, isLoading } = useQuery({
    queryKey: ['cinemas', city, search],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (city) qs.set('city', city);
      if (search) qs.set('search', search);
      return apiFetch<Cinema[]>(`/cinemas?${qs.toString()}`);
    },
  });

  const activeCinemaId = selectedCinemaId || cinemas?.[0]?.id || '';

  const { data: cinemaDetail } = useQuery({
    queryKey: ['cinema-detail', activeCinemaId],
    queryFn: () => apiFetch<CinemaDetail>(`/cinemas/${activeCinemaId}`),
    enabled: Boolean(activeCinemaId),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
            Architectural Exhibition Network
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold text-white">
            Tixora Cinema Houses
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cinema or neighborhood..."
              className="rounded border border-zinc-800 bg-[#111115] py-2 pl-9 pr-3 text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded border border-zinc-800 bg-[#111115] px-3 py-2 text-xs">
            <MapPin className="h-3.5 w-3.5 text-amber-400" />
            <select
              aria-label="Filter by City"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setSelectedCinemaId('');
              }}
              className="bg-transparent text-zinc-200 focus:outline-none"
            >
              <option value="" className="bg-zinc-900">
                All Cities
              </option>
              <option value="Mumbai" className="bg-zinc-900">
                Mumbai
              </option>
              <option value="New Delhi" className="bg-zinc-900">
                New Delhi
              </option>
              <option value="Bengaluru" className="bg-zinc-900">
                Bengaluru
              </option>
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded border border-zinc-800 bg-zinc-900/40" />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column: Cinema Directory */}
          <div className="lg:col-span-5 space-y-4">
            {(cinemas || []).map((c) => {
              const isSelected = c.id === activeCinemaId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCinemaId(c.id)}
                  className={`w-full text-left rounded border p-5 transition ${
                    isSelected
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-zinc-800 bg-[#111115] hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
                      {c.city} · {c.neighborhood}
                    </span>
                    <span className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] text-zinc-300">
                      {c.screenCount || 1} Screens
                    </span>
                  </div>
                  <h2 className="mt-1.5 font-display text-lg font-bold text-white">
                    {c.name}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">{c.address}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.facilities.map((fac) => (
                      <span
                        key={fac}
                        className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300"
                      >
                        {fac}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Selected Cinema Screens & Scheduled Showtimes */}
          <div className="lg:col-span-7">
            {cinemaDetail ? (
              <div className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-8">
                <div className="border-b border-zinc-800 pb-5">
                  <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
                    {cinemaDetail.city} · {cinemaDetail.neighborhood}
                  </span>
                  <h2 className="mt-1 font-display text-2xl font-bold text-white">
                    {cinemaDetail.name}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">{cinemaDetail.address}</p>
                </div>

                {/* Auditoriums / Screens */}
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-300">
                    <Layers className="h-4 w-4 text-amber-400" />
                    Configured Auditoriums ({cinemaDetail.screens.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {cinemaDetail.screens.map((sc) => (
                      <div
                        key={sc.id}
                        className="rounded border border-zinc-800 bg-zinc-950 p-3.5"
                      >
                        <p className="font-semibold text-sm text-zinc-100">{sc.name}</p>
                        <p className="mt-1 font-mono text-[11px] text-amber-400">
                          {sc.formatType} · {sc.soundSystem}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-zinc-500">
                          Grid: {sc.totalRows} Rows × {sc.totalCols} Cols ({sc.totalRows * sc.totalCols} Seats)
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Showtimes */}
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-300">
                    <Film className="h-4 w-4 text-amber-400" />
                    Scheduled Screenings ({cinemaDetail.shows.length})
                  </h3>

                  {cinemaDetail.shows.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      No published screenings currently scheduled at this house.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cinemaDetail.shows.map((sh) => {
                        const start = new Date(sh.startTime);
                        return (
                          <div
                            key={sh.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded border border-zinc-800 bg-zinc-950 p-4"
                          >
                            <div className="flex items-center gap-4">
                              {sh.posterUrl && (
                                <img
                                  src={sh.posterUrl}
                                  alt={sh.movieTitle}
                                  className="h-16 w-12 rounded object-cover"
                                />
                              )}
                              <div>
                                <h4 className="font-display text-base font-bold text-zinc-100">
                                  {sh.movieTitle}
                                </h4>
                                <p className="text-xs text-zinc-400">
                                  {sh.screenName} · {sh.format} · {sh.language}
                                </p>
                                <p className="mt-1 font-mono text-xs text-amber-400">
                                  {start.toLocaleDateString([], {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}{' '}
                                  at{' '}
                                  {start.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>

                            <Link
                              href={`/shows/${sh.id}/seats`}
                              className="inline-flex items-center justify-center gap-1.5 rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
                            >
                              <Ticket className="h-3.5 w-3.5" />
                              Select Seats ({sh.availableSeats} Open)
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

