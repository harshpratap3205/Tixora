'use client';

import React, { useEffect } from 'react';
import { X, Film, AlertCircle } from 'lucide-react';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  trailerUrl?: string;
}

export function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube-nocookie.com/embed/${match[2]}?autoplay=1&rel=0&modestbranding=1`
    : null;
}

export default function TrailerModal({
  isOpen,
  onClose,
  title,
  trailerUrl,
}: TrailerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const embedUrl = getYouTubeEmbedUrl(trailerUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} Official Trailer`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/85 backdrop-blur-md transition-all animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-xl border border-amber-400/30 bg-[#0c0c0f] shadow-2xl shadow-amber-950/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-[#121217] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-400/10 border border-amber-400/30 text-amber-400">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
                Official Theatrical Trailer
              </p>
              <h3 className="font-display text-base font-semibold text-white">
                {title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close trailer modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video w-full bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center space-y-3 p-6 text-center text-zinc-400">
              <AlertCircle className="h-10 w-10 text-amber-400" />
              <p className="font-display text-base text-zinc-200">
                No playable YouTube trailer stream found for this presentation.
              </p>
              {trailerUrl && (
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded bg-amber-400 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-300 transition"
                >
                  Open External Link
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 bg-[#0d0d11] px-5 py-2.5 text-xs font-mono text-zinc-400">
          <span>Tixora Cinema Experience · 4K Digital Master</span>
          <span className="text-amber-400/80">Press ESC or click outside to dismiss</span>
        </div>
      </div>
    </div>
  );
}

