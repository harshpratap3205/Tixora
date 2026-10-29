'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Star,
  Clock,
  ArrowRight,
  Sparkles,
  Film,
  MapPin,
  Shield,
  Ticket,
  Play,
} from 'lucide-react';
import { apiFetch, Cinema, Movie } from '@/lib/api';
import { useApp } from '@/components/Providers';
import TrailerModal from '@/components/TrailerModal';

export default function HomePage() {
  const router = useRouter();
  const { city, setCity } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTrailerMovie, setActiveTrailerMovie] = useState<Movie | null>(null);
  const [selectedFeaturedIndex, setSelectedFeaturedIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const { data: movies, isLoading: loadingMovies } = useQuery({
    queryKey: ['movies', 'home'],
    queryFn: () => apiFetch<Movie[]>('/movies?limit=20'),
  });

  const { data: cinemas } = useQuery({
    queryKey: ['cinemas', city],
    queryFn: () =>
      apiFetch<Cinema[]>(`/cinemas${city ? `?city=${encodeURIComponent(city)}` : ''}`),
  });

  const featuredCandidates =
    movies?.filter((m) => m.isFeatured && m.releaseStatus === 'NOW_SHOWING') || [];
  const featuredList = featuredCandidates.length > 0 ? featuredCandidates : (movies || []);
  const featuredMovie = featuredList[selectedFeaturedIndex] || featuredList[0];

  const nowShowing =
    movies?.filter((m) => {
      if (m.releaseStatus !== 'NOW_SHOWING') return false;
      if (selectedCategory === 'ALL') return true;
      if (selectedCategory === 'IMAX') return m.title.includes('IMAX') || m.genres.includes('Sci-Fi') || m.genres.includes('Action');
      if (selectedCategory === 'ACTION') return m.genres.includes('Action') || m.genres.includes('Thriller');
      if (selectedCategory === 'DRAMA') return m.genres.includes('Drama') || m.genres.includes('Crime');
      return true;
    }) || [];

  const upcoming = movies?.filter((m) => m.releaseStatus === 'UPCOMING') || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/movies?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/movies');
    }
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Editorial Hero Section */}
      <section className="relative min-h-[560px] flex items-end overflow-hidden border-b border-zinc-800/80 bg-[#09090B]">
        {featuredMovie && (
          <div className="absolute inset-0">
            <img
              src={featuredMovie.backdropUrl}
              alt={featuredMovie.title}
              className="h-full w-full object-cover object-center opacity-35 scale-105 transition duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/60 to-transparent" />
          </div>
        )}

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-mono uppercase tracking-widest text-amber-300">
              <Sparkles className="h-3.5 w-3.5" />
              Premiere Feature Presentation · IMAX Dual Laser
            </div>

            {featuredMovie ? (
              <>
                <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-6xl">
                  {featuredMovie.title}
                </h1>
                {featuredMovie.tagline && (
                  <p className="font-display text-lg italic text-amber-300/90">
                    “{featuredMovie.tagline}”
                  </p>
                )}
                <p className="text-sm leading-relaxed text-zinc-300 sm:text-base line-clamp-3">
                  {featuredMovie.synopsis}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-zinc-300">
                  <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900/90 px-2.5 py-1 text-amber-400">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    {featuredMovie.imdbRating.toFixed(1)} IMDb
                  </span>
                  <span className="inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/80 px-2.5 py-1">
                    <Clock className="h-3.5 w-3.5 text-zinc-400" />
                    {featuredMovie.durationMinutes} MIN
                  </span>
                  <span className="rounded border border-zinc-800 bg-zinc-900/80 px-2.5 py-1">
                    {featuredMovie.ageRating}
                  </span>
                  <span className="text-zinc-400">
                    {featuredMovie.genres.join(' · ')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link
                    href={`/movies/${featuredMovie.slug}`}
                    className="inline-flex items-center gap-2 rounded bg-amber-400 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
                  >
                    <Ticket className="h-4 w-4" />
                    Reserve Seats Now
                  </Link>
                  {featuredMovie.trailerUrl && (
                    <button
                      type="button"
                      onClick={() => setActiveTrailerMovie(featuredMovie)}
                      className="inline-flex items-center gap-2 rounded border border-amber-400/50 bg-amber-400/10 px-5 py-3 text-sm font-medium text-amber-300 transition hover:bg-amber-400/20 hover:border-amber-400"
                    >
                      <Play className="h-4 w-4 fill-amber-400 text-amber-400" />
                      Watch Official Trailer
                    </button>
                  )}
                  <Link
                    href="/movies"
                    className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/80 px-5 py-3 text-sm font-medium text-zinc-200 transition hover:border-amber-400/60 hover:text-white"
                  >
                    Explore Full Catalog
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Featured Movie Quick Switcher Tabs */}
                {featuredList.length > 1 && (
                  <div className="pt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 mr-1">
                      Featured Slate:
                    </span>
                    {featuredList.slice(0, 4).map((fMovie, idx) => (
                      <button
                        key={fMovie.id}
                        type="button"
                        onClick={() => setSelectedFeaturedIndex(idx)}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                          selectedFeaturedIndex === idx
                            ? 'bg-amber-400 text-zinc-950 font-bold shadow'
                            : 'bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:border-amber-400/50'
                        }`}
                      >
                        {fMovie.title}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="h-64 animate-pulse rounded bg-zinc-900/50" />
            )}
          </div>
        </div>
      </section>

      {/* Engineering Integrity & Architecture Ribbon */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 -mt-10 relative z-30">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-zinc-800/80 bg-[#111115]/95 backdrop-blur-md p-4 shadow-xl text-xs">
          <div className="flex items-center gap-2.5 p-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-400">
              <Shield className="h-4 w-4" />
            </span>
            <div>
              <span className="block font-semibold text-zinc-100">Zero Double-Booking</span>
              <span className="text-[11px] text-zinc-400">PostgreSQL Row Locks (FOR UPDATE)</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-400">
              <Ticket className="h-4 w-4" />
            </span>
            <div>
              <span className="block font-semibold text-zinc-100">Cryptographic QR Passes</span>
              <span className="text-[11px] text-zinc-400">HMAC-SHA256 Gate Verification</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <span className="block font-semibold text-zinc-100">Dual-Token JWT Security</span>
              <span className="text-[11px] text-zinc-400">Rotating Refresh Token Sessions</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-400">
              <Film className="h-4 w-4" />
            </span>
            <div>
              <span className="block font-semibold text-zinc-100">15 Modular Domains</span>
              <span className="text-[11px] text-zinc-400">21 Relational Database Tables</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Discovery & Search Bar */}
      <section className="mx-auto mt-4 relative z-20 max-w-7xl px-4 sm:px-6">
        <div className="rounded-lg border border-zinc-800 bg-[#111115] p-5 shadow-2xl">
          <form
            onSubmit={handleSearch}
            className="grid grid-cols-1 gap-4 md:grid-cols-12 items-center"
          >
            <div className="md:col-span-6 relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by film title, director, or format (e.g., Solaris, Noir, Monsoon)..."
                className="w-full rounded border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2 rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5">
              <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
              <select
                aria-label="Filter by City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none"
              >
                <option value="" className="bg-zinc-900">
                  All Metro Cities
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

            <div className="md:col-span-3">
              <button
                type="submit"
                className="w-full rounded bg-amber-400 py-2.5 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"
              >
                Find Showtimes
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Now Showing Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
              In Theatres Today
            </p>
            <h2 className="font-display text-3xl font-bold text-white mt-1">
              Now Showing
            </h2>
          </div>
          <Link
            href="/movies?status=NOW_SHOWING"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-zinc-400 hover:text-amber-400"
          >
            View All Releases <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'All Films' },
            { id: 'IMAX', label: 'IMAX Laser & Sci-Fi' },
            { id: 'ACTION', label: 'Action & Thriller' },
            { id: 'DRAMA', label: 'Drama & Crime' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-amber-400 text-zinc-950 font-bold shadow-md'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loadingMovies ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-96 animate-pulse rounded border border-zinc-800 bg-zinc-900/50"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {nowShowing.map((movie) => (
              <Link
                key={movie.id}
                href={`/movies/${movie.slug}`}
                className="group flex flex-col overflow-hidden rounded border border-zinc-800/90 bg-[#111115] transition hover:-translate-y-1 hover:border-amber-400/60"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3 rounded bg-zinc-950/90 border border-zinc-700 px-2 py-0.5 font-mono text-[11px] text-zinc-200">
                    {movie.ageRating}
                  </div>
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded bg-zinc-950/90 border border-amber-400/40 px-2 py-0.5 font-mono text-xs text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400" />
                    {movie.imdbRating.toFixed(1)}
                  </div>
                  {movie.trailerUrl && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTrailerMovie(movie);
                      }}
                      aria-label={`Watch trailer for ${movie.title}`}
                      className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 rounded bg-black/85 border border-amber-400/40 px-2.5 py-1 text-[11px] font-mono text-amber-300 hover:bg-amber-400 hover:text-black transition shadow-lg"
                    >
                      <Play className="h-3 w-3 fill-current" />
                      Trailer
                    </button>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-4 space-y-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                      {movie.genres.slice(0, 2).join(' · ')} · {movie.durationMinutes}m
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold text-zinc-100 group-hover:text-amber-400">
                      {movie.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400">
                      {movie.languages.join(', ')}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
                    <span>Book Showtimes</span>
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Curated Flagship Cinemas */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
              Architectural Auditoriums {city ? `· ${city}` : ''}
            </p>
            <h2 className="font-display text-3xl font-bold text-white mt-1">
              Flagship Tixora Houses
            </h2>
          </div>
          <Link
            href="/cinemas"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-zinc-400 hover:text-amber-400"
          >
            All Locations <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {(cinemas || []).slice(0, 4).map((c) => (
            <Link
              key={c.id}
              href={`/cinemas?cinemaId=${c.id}`}
              className="group rounded border border-zinc-800 bg-[#111115] p-6 transition hover:border-amber-400/60"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block rounded bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                    {c.city} · {c.neighborhood}
                  </span>
                  <h3 className="mt-2 font-display text-xl font-bold text-zinc-100 group-hover:text-amber-400">
                    {c.name}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">{c.address}</p>
                </div>
                <span className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-300">
                  {c.screenCount || 2} Screens
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {c.facilities.map((fac) => (
                  <span
                    key={fac}
                    className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300"
                  >
                    {fac}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming Releases */}
      {upcoming.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
          <div className="border-b border-zinc-800/80 pb-4">
            <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
              Advance Slate
            </p>
            <h2 className="font-display text-3xl font-bold text-white mt-1">
              Upcoming Premieres
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((movie) => (
              <Link
                key={movie.id}
                href={`/movies/${movie.slug}`}
                className="group flex gap-4 rounded border border-zinc-800 bg-[#111115] p-4 transition hover:border-amber-400/50"
              >
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="h-32 w-24 shrink-0 rounded object-cover"
                />
                <div className="flex flex-col justify-between">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                      Releases {movie.releaseDate}
                    </span>
                    <h3 className="mt-1 font-display text-lg font-bold text-zinc-100 group-hover:text-amber-400">
                      {movie.title}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                      {movie.synopsis}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-xs font-mono">
                    <span className="text-zinc-500">
                      Dir. {movie.director}
                    </span>
                    {movie.trailerUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveTrailerMovie(movie);
                        }}
                        className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition"
                      >
                        <Play className="h-3 w-3 fill-amber-400" />
                        Watch Teaser
                      </button>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Architectural Guarantees Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-6 rounded border border-zinc-800 bg-[#111115] p-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase">
              <Shield className="h-4 w-4" />
              PostgreSQL Row Locking
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">
              Zero Double-Booked Seats
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Every multi-seat reservation claims inventory atomically using deterministic PostgreSQL row locks (`FOR UPDATE`) and server-authoritative countdowns.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase">
              <Ticket className="h-4 w-4" />
              HMAC-SHA256 QR Tickets
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">
              Cryptographic Gate Verification
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Confirmed bookings generate signed `TXQR` tokens verified at cinema gates with strict duplicate check-in rejection.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase">
              <Film className="h-4 w-4" />
              Webhook Reconciliation
            </div>
            <h3 className="font-semibold text-zinc-100 text-sm">
              Late-Payment Safety Net
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Idempotent webhook processing separates payment state from seat confirmation, automatically routing late expired holds to `REFUND_REQUIRED`.
            </p>
          </div>
        </div>
      </section>

      {/* Fullscreen HD Trailer Modal */}
      <TrailerModal
        isOpen={!!activeTrailerMovie}
        onClose={() => setActiveTrailerMovie(null)}
        title={activeTrailerMovie?.title || ''}
        trailerUrl={activeTrailerMovie?.trailerUrl}
      />
    </div>
  );
}

