'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ApiUser,
  apiFetch,
  clearStoredAuth,
  getStoredToken,
  setStoredAuth,
} from '@/lib/api';

interface AppContextType {
  user: ApiUser | null;
  city: string;
  setCity: (city: string) => void;
  loginWithCredentials: (email: string, password: string) => Promise<ApiUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isLoadingAuth: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside Providers');
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [user, setUser] = useState<ApiUser | null>(null);
  const [city, setCityState] = useState<string>('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const loadStoredUser = async () => {
    try {
      const savedCity = localStorage.getItem('tixora_city');
      if (savedCity !== null) {
        setCityState(savedCity);
      }

      const token = getStoredToken();
      const rawUser = localStorage.getItem('tixora_user');
      if (rawUser) {
        setUser(JSON.parse(rawUser));
      }

      if (token) {
        const freshProfile = await apiFetch<ApiUser>('/users/me');
        setUser(freshProfile);
      }
    } catch {
      clearStoredAuth();
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  useEffect(() => {
    loadStoredUser();
    const handler = () => {
      const rawUser = localStorage.getItem('tixora_user');
      setUser(rawUser ? JSON.parse(rawUser) : null);
    };
    window.addEventListener('tixora-auth-change', handler);
    return () => window.removeEventListener('tixora-auth-change', handler);
  }, []);

  const setCity = (newCity: string) => {
    setCityState(newCity);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tixora_city', newCity);
    }
  };

  const loginWithCredentials = async (email: string, password: string) => {
    const res = await apiFetch<{
      user: ApiUser;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredAuth(res.accessToken, res.refreshToken, res.user);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('tixora_refresh_token');
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore network error on logout
    }
    clearStoredAuth();
    setUser(null);
  };

  const refreshProfile = async () => {
    await loadStoredUser();
  };

  return (
    <QueryClientProvider client={queryClient}>
      <AppContext.Provider
        value={{
          user,
          city,
          setCity,
          loginWithCredentials,
          logout,
          refreshProfile,
          isLoadingAuth,
        }}
      >
        {children}
      </AppContext.Provider>
    </QueryClientProvider>
  );
}
