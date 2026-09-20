import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  loginAsGuest: (preferredName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Using sessionStorage provides strict per-tab isolation.
// This allows multiple browser tabs to run independent players concurrently on localhost.
const TOKEN_KEY = 'rummy_tab_access_token';
const USER_KEY = 'rummy_tab_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitializingRef = useRef(false);

  const initAuth = useCallback(async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    // Clear legacy cross-tab storage
    try {
      localStorage.removeItem('rummy_access_token');
      localStorage.removeItem('rummy_user_profile');
    } catch {}

    const savedToken = sessionStorage.getItem(TOKEN_KEY);
    const savedUser = sessionStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setIsLoading(false);
        return;
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
      }
    }

    // Auto-create unique guest ONCE for this tab
    try {
      const randTag = Math.floor(1000 + Math.random() * 9000);
      const guestName = `Player_${randTag}`;
      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const email = `guest_${uniqueSuffix}@rummy.local`;
      const password = `GuestPass${uniqueSuffix}!`;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: guestName,
          email,
          password
        })
      });

      const data = await res.json();
      if (res.ok && data.accessToken) {
        const authUser: AuthUser = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email
        };

        sessionStorage.setItem(TOKEN_KEY, data.accessToken);
        sessionStorage.setItem(USER_KEY, JSON.stringify(authUser));
        setToken(data.accessToken);
        setUser(authUser);
      }
    } catch (err) {
      console.error('Initial guest registration error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const loginAsGuest = useCallback(async (preferredName?: string) => {
    setIsLoading(true);
    try {
      const randTag = Math.floor(1000 + Math.random() * 9000);
      const guestName = preferredName?.trim() || `Player_${randTag}`;
      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const email = `guest_${uniqueSuffix}@rummy.local`;
      const password = `GuestPass${uniqueSuffix}!`;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: guestName,
          email,
          password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      const authUser: AuthUser = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email
      };

      sessionStorage.setItem(TOKEN_KEY, data.accessToken);
      sessionStorage.setItem(USER_KEY, JSON.stringify(authUser));
      setToken(data.accessToken);
      setUser(authUser);
    } catch (err) {
      console.error('Guest login failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
