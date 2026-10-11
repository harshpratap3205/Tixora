'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  Clock,
  Calendar,
  MapPin,
  Play,
  Users,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { apiFetch, Movie, Showtime } from '@/lib/api';
import { useApp } from '@/components/Providers';

export default function MovieDetailPage() {
  const params = useParams<{ id: string }>();
  const { city, setCity } = useApp();
  const [selectedFormat, setSelectedFormat] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['movie-shows', params.id, city],
    queryFn: () =>
      apiFetch<{ movie: Movie; shows: Showtime[] }>(
        `/movies/${params.id}/shows${city ? `?city=${encodeURIComponent(city)}` : ''}`
      ),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="h-96 animate-pulse rounded border border-zinc-800 bg-zinc-900/50" />
      </div>
    );
  }

  if (!data?.movie) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="font-display text-2xl text-zinc-200">Movie not found</h1>
      </div>
    );
  }

  const { movie, shows } = data;
  const filteredShows = selectedFormat
    ? shows.filter((s) => s.format === selectedFormat)
    : shows;

  // Group showtimes by cinema
  const cinemaGroups = new Map<
    string,
    {
      cinemaId: string;
      cinemaName: string;
      cinemaCity: string;
      cinemaNeighborhood: string;
      cinemaAddress: string;
      cinemaFacilities: string[];
      shows: Showtime[];
    }
  >();

  for (const sh of filteredShows) {
    const existing = cinemaGroups.get(sh.cinemaId);
    if (existing) {
      existing.shows.push(sh);
    } else {
      cinemaGroups.set(sh.cinemaId, {
        cinemaId: sh.cinemaId,
        cinemaName: sh.cinemaName || 'Tixora Cinema',
        cinemaCity: sh.cinemaCity || '',
        cinemaNeighborhood: sh.cinemaNeighborhood || '',
        cinemaAddress: sh.cinemaAddress || '',
        cinemaFacilities: sh.cinemaFacilities || [],
        shows: [sh],
      });
    }
  }

  const formats = Array.from(new Set(shows.map((s) => s.format)));

  return (
    <div className="pb-20 space-y-12">
      {/* Movie Backdrop Hero */}
      <section className="relative border-b border-zinc-800 bg-[#09090B] py-12 lg:py-16 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={movie.backdropUrl}
            alt={movie.title}
            className="h-full w-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-[#09090B]/50" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-start">
            <div className="md:col-span-3">
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full max-w-[260px] rounded border border-zinc-700 shadow-2xl"
              />
            </div>

            <div className="md:col-span-9 space-y-5">
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider">
                <span className="rounded bg-amber-400/15 border border-amber-400/40 px-2.5 py-0.5 text-amber-300">
                  {movie.releaseStatus === 'NOW_SHOWING' ? 'Now Showing' : 'Upcoming Release'}
                </span>
                <span className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-0.5 text-zinc-200">
                  {movie.ageRating}
                </span>
                <span className="flex items-center gap-1 rounded border border-amber-400/40 bg-zinc-900 px-2.5 py-0.5 text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  {movie.imdbRating.toFixed(1)}
                </span>
              </div>

              <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">
                {movie.title}
              </h1>

              {movie.tagline && (
                <p className="font-display text-lg italic text-amber-300">
                  “{movie.tagline}”
                </p>
              )}

              <p className="max-w-3xl text-sm leading-relaxed text-zinc-300 sm:text-base">
                {movie.synopsis}
              </p>

              <div className="flex flex-wrap gap-6 pt-2 text-xs text-zinc-300 font-mono">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span>{movie.durationMinutes} Minutes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-amber-400" />
                  <span>Release: {movie.releaseDate}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Director:</span>{' '}
                  <span className="text-zinc-100">{movie.director}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Languages:</span>{' '}
                  <span className="text-zinc-100">{movie.languages.join(', ')}</span>
                </div>
              </div>

              {/* Cast Pills */}
              {movie.castMembers && movie.castMembers.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-zinc-400">
                    <Users className="h-3.5 w-3.5 text-amber-400" />
                    Principal Cast
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {movie.castMembers.map((c) => (
                      <div
                        key={c.name}
                        className="rounded border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs"
                      >
                        <span className="font-semibold text-zinc-100">{c.name}</span>
                        <span className="text-zinc-400"> as {c.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {movie.trailerUrl && (
                <div className="pt-2">
                  <a
                    href={movie.trailerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/90 px-4 py-2 text-xs font-mono uppercase tracking-wider text-zinc-200 hover:border-amber-400 hover:text-amber-300"
                  >
                    <Play className="h-3.5 w-3.5 text-amber-400" />
                    Watch Official Trailer
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Showtimes Selection Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
              Real-Time Auditorium Inventory
            </p>
            <h2 className="font-display text-2xl font-bold text-white mt-1">
              Select Showtime & Auditorium
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded border border-zinc-800 bg-[#111115] px-3 py-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              <select
                aria-label="City filter"
                value={city}
                onChange={(e) => setCity(e.target.value)}
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

            {formats.length > 1 && (
              <select
                aria-label="Format filter"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="rounded border border-zinc-800 bg-[#111115] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              >
                <option value="">All Formats</option>
                {formats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {cinemaGroups.size === 0 ? (
          <div className="rounded border border-zinc-800 bg-[#111115] p-10 text-center space-y-3">
            <p className="font-display text-lg text-zinc-200">
              No published showtimes found for this filter.
            </p>
            {city && (
              <button
                onClick={() => setCity('')}
                className="rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950"
              >
                Show All Cities
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(cinemaGroups.values()).map((cg) => (
              <div
                key={cg.cinemaId}
                className="rounded border border-zinc-800 bg-[#111115] p-6 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-zinc-800/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 font-mono text-[10px] uppercase text-amber-300">
                        {cg.cinemaCity} · {cg.cinemaNeighborhood}
                      </span>
                    </div>
                    <h3 className="mt-1.5 font-display text-xl font-bold text-white">
                      {cg.cinemaName}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{cg.cinemaAddress}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {cg.cinemaFacilities.map((fac) => (
                      <span
                        key={fac}
                        className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-[10px] text-zinc-400"
                      >
                        {fac}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Showtime Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {cg.shows.map((sh) => {
                    const startDate = new Date(sh.startTime);
                    const timeStr = startDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const dateStr = startDate.toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    });
                    const prices = Object.entries(sh.categoryPrices || {});

                    return (
                      <Link
                        key={sh.id}
                        href={`/shows/${sh.id}/seats`}
                        className="group flex flex-col justify-between rounded border border-zinc-800 bg-zinc-950/90 p-4 transition hover:border-amber-400"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-lg font-bold text-amber-400 group-hover:text-amber-300">
                              {timeStr}
                            </p>
                            <p className="font-mono text-[11px] text-zinc-400">
                              {dateStr} · {sh.language}
                            </p>
                          </div>
                          <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-200">
                            {sh.format}
                          </span>
                        </div>

                        <div className="my-3 text-xs text-zinc-400">
                          <p className="font-medium text-zinc-300">{sh.screenName}</p>
                          <div className="mt-1.5 flex flex-wrap gap-2 font-mono text-[11px]">
                            {prices.map(([cat, pr]) => (
                              <span key={cat} className="text-zinc-400">
                                {cat}: <strong className="text-zinc-200">₹{pr}</strong>
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-zinc-900 pt-2.5 text-[11px] font-mono">
                          <span className="text-emerald-400">
                            {sh.availableSeats ?? '60+'} / {sh.totalSeats ?? 84} Seats Open
                          </span>
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                            <Ticket className="h-3 w-3" />
                            Select Seats
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

