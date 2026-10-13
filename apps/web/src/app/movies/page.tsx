'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, Filter, RotateCcw, ArrowRight, Play } from 'lucide-react';
import { apiFetch, Movie } from '@/lib/api';
import TrailerModal from '@/components/TrailerModal';

const LANGUAGES = ['', 'English', 'Hindi', 'French', 'Tamil', 'Telugu', 'Marathi'];
const GENRES = ['', 'Sci-Fi', 'Thriller', 'Noir', 'Drama', 'Romance', 'Action', 'Mystery'];
const STATUSES = [
  { label: 'All Releases', value: '' },
  { label: 'Now Showing', value: 'NOW_SHOWING' },
  { label: 'Upcoming', value: 'UPCOMING' },
];

function MoviesCatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [language, setLanguage] = useState(searchParams.get('language') || '');
  const [genre, setGenre] = useState(searchParams.get('genre') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [activeTrailerMovie, setActiveTrailerMovie] = useState<Movie | null>(null);
  const [sort, setSort] = useState(searchParams.get('sort') || 'rating');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (language) params.set('language', language);
    if (genre) params.set('genre', genre);
    if (status) params.set('status', status);
    if (sort) params.set('sort', sort);
    const qs = params.toString();
    router.replace(`/movies${qs ? `?${qs}` : ''}`, { scroll: false });
  }, [search, language, genre, status, sort, router]);

  const queryParams = new URLSearchParams();
  if (search) queryParams.set('search', search);
  if (language) queryParams.set('language', language);
  if (genre) queryParams.set('genre', genre);
  if (status) queryParams.set('status', status);
  if (sort) queryParams.set('sort', sort);

  const { data: movies, isLoading } = useQuery({
    queryKey: ['movies', search, language, genre, status, sort],
    queryFn: () => apiFetch<Movie[]>(`/movies?${queryParams.toString()}`),
  });

  const resetFilters = () => {
    setSearch('');
    setLanguage('');
    setGenre('');
    setStatus('');
    setSort('rating');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-10">
      <div className="border-b border-zinc-800 pb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-amber-400">
          Curated Repertoire
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold text-white">
          Film Catalog & Premieres
        </h1>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded border border-zinc-800 bg-[#111115] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400">
            <Filter className="h-3.5 w-3.5 text-amber-400" />
            Shareable URL Filter Controls
          </div>
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-amber-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or director..."
              className="w-full rounded border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-amber-400 focus:outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l || 'all'} value={l}>
                {l ? `Language: ${l}` : 'All Languages'}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-amber-400 focus:outline-none"
          >
            {GENRES.map((g) => (
              <option key={g || 'all'} value={g}>
                {g ? `Genre: ${g}` : 'All Genres'}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Release Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-amber-400 focus:outline-none"
          >
            {STATUSES.map((st) => (
              <option key={st.value || 'all'} value={st.value}>
                {st.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded border border-zinc-800 bg-zinc-900/40"
            />
          ))}
        </div>
      ) : !movies || movies.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-[#111115] p-12 text-center space-y-4">
          <p className="font-display text-xl text-zinc-200">
            No films match your current filter selection.
          </p>
          <button
            onClick={resetFilters}
            className="rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {movies.map((movie) => (
            <Link
              key={movie.id}
              href={`/movies/${movie.slug}`}
              className="group flex flex-col overflow-hidden rounded border border-zinc-800 bg-[#111115] transition hover:-translate-y-1 hover:border-amber-400/60"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-900">
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute top-3 left-3 rounded bg-zinc-950/90 border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-200">
                  {movie.releaseStatus === 'NOW_SHOWING' ? 'Now Showing' : 'Upcoming'}
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
                    {movie.genres.join(' · ')} · {movie.durationMinutes}m
                  </p>
                  <h2 className="mt-1 font-display text-lg font-bold text-zinc-100 group-hover:text-amber-400">
                    {movie.title}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-400">
                    Dir. {movie.director} · {movie.languages.join(', ')}
                  </p>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs font-semibold text-amber-400">
                  <span>View Details & Showtimes</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Trailer Modal */}
      <TrailerModal
        isOpen={!!activeTrailerMovie}
        onClose={() => setActiveTrailerMovie(null)}
        title={activeTrailerMovie?.title || ''}
        trailerUrl={activeTrailerMovie?.trailerUrl}
      />
    </div>
  );
}

export default function MoviesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-zinc-400">Loading catalog...</div>}>
      <MoviesCatalogContent />
    </Suspense>
  );
}

