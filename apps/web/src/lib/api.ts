export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api/v1';

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  managedCinemaIds: string[];
  phone?: string;
  preferredCity?: string;
}

export interface Movie {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  synopsis: string;
  durationMinutes: number;
  releaseDate: string;
  releaseStatus: 'NOW_SHOWING' | 'UPCOMING' | 'ARCHIVED';
  ageRating: string;
  languages: string[];
  genres: string[];
  director: string;
  castMembers: Array<{ name: string; role: string }>;
  posterUrl: string;
  backdropUrl: string;
  trailerUrl?: string;
  imdbRating: number;
  isFeatured: boolean;
}

export interface Cinema {
  id: string;
  name: string;
  slug: string;
  city: string;
  neighborhood: string;
  address: string;
  facilities: string[];
  status: string;
  screenCount?: number;
}

export interface Showtime {
  id: string;
  movieId: string;
  cinemaId: string;
  screenId: string;
  language: string;
  format: string;
  startTime: string;
  endTime: string;
  currency: string;
  categoryPrices: Record<string, number>;
  status: string;
  movieTitle?: string;
  posterUrl?: string;
  backdropUrl?: string;
  durationMinutes?: number;
  ageRating?: string;
  cinemaName?: string;
  cinemaCity?: string;
  cinemaNeighborhood?: string;
  cinemaAddress?: string;
  cinemaFacilities?: string[];
  screenName?: string;
  screenFormat?: string;
  soundSystem?: string;
  availableSeats?: number;
  totalSeats?: number;
}

export interface ShowSeat {
  id: string;
  showId: string;
  seatId: string;
  seatCode: string;
  rowLabel: string;
  seatNumber: number;
  category: 'STANDARD' | 'PRIME' | 'RECLINER' | 'IMAX_VIP';
  seatType: 'REGULAR' | 'ACCESSIBLE' | 'COUPLE' | 'AISLE_GAP' | 'DISABLED';
  gridRow: number;
  gridCol: number;
  price: number;
  currency: string;
  status: 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED';
  holdExpiresAt?: string | null;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tixora_access_token');
}

export function setStoredAuth(accessToken: string, refreshToken: string, user: ApiUser) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('tixora_access_token', accessToken);
  localStorage.setItem('tixora_refresh_token', refreshToken);
  localStorage.setItem('tixora_user', JSON.stringify(user));
  window.dispatchEvent(new Event('tixora-auth-change'));
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('tixora_access_token');
  localStorage.removeItem('tixora_refresh_token');
  localStorage.removeItem('tixora_user');
  window.dispatchEvent(new Event('tixora-auth-change'));
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const errMessage =
      json?.error?.message || `Request failed with status ${res.status}`;
    const err = new Error(errMessage) as Error & { status?: number; code?: string; details?: any };
    err.status = res.status;
    err.code = json?.error?.code;
    err.details = json?.error?.details;
    throw err;
  }

  return json.data as T;
}

