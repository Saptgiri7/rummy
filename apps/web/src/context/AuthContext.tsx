import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  phone?: string | null;
  role?: 'USER' | 'ADMIN';
  isVerified?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  sendOtp: (identifier: string, type: 'EMAIL' | 'PHONE') => Promise<{ success: boolean; message?: string; devOtpCode?: string; previewUrl?: string; cooldownSeconds?: number; error?: string }>;
  registerWithOtp: (
    username: string,
    identifier: string,
    type: 'EMAIL' | 'PHONE',
    password: string,
    otp: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: (preferredName?: string) => Promise<void>;
  updateDisplayName: (newName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Using sessionStorage provides strict per-tab isolation.
// This allows multiple browser tabs to run independent players concurrently on localhost.
const TOKEN_KEY = 'rummy_tab_access_token';
const USER_KEY = 'rummy_tab_user_profile';

function isTokenExpired(jwtToken: string): boolean {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000 - 5000;
  } catch {
    return true;
  }
}

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

    if (savedToken && savedUser && !isTokenExpired(savedToken)) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        setIsLoading(false);
        return;
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
      }
    } else if (savedToken) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
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
          email: data.user.email,
          phone: data.user.phone ?? null,
          role: data.user.role ?? 'USER',
          isVerified: data.user.isVerified ?? false
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

  const login = useCallback(async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'Login failed' };
      }

      const authUser: AuthUser = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        phone: data.user.phone ?? null,
        role: data.user.role ?? 'USER',
        isVerified: data.user.isVerified ?? true
      };

      sessionStorage.setItem(TOKEN_KEY, data.accessToken);
      sessionStorage.setItem(USER_KEY, JSON.stringify(authUser));
      setToken(data.accessToken);
      setUser(authUser);

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message || 'Network error during login' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendOtp = useCallback(async (identifier: string, type: 'EMAIL' | 'PHONE') => {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, type })
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data.message || 'Failed to send verification code',
          cooldownSeconds: data.cooldownSeconds
        };
      }

      return {
        success: true,
        message: data.message,
        devOtpCode: data.devOtpCode,
        previewUrl: data.previewUrl
      };
    } catch (err) {
      return { success: false, error: (err as Error).message || 'Failed to send OTP' };
    }
  }, []);

  const registerWithOtp = useCallback(
    async (
      username: string,
      identifier: string,
      type: 'EMAIL' | 'PHONE',
      password: string,
      otp: string
    ) => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/register-with-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            identifier,
            type,
            password,
            otp
          })
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.message || 'Registration failed' };
        }

        const authUser: AuthUser = {
          id: data.user.id,
          username: data.user.username,
          email: data.user.email,
          phone: data.user.phone ?? null,
          role: data.user.role ?? 'USER',
          isVerified: true
        };

        sessionStorage.setItem(TOKEN_KEY, data.accessToken);
        sessionStorage.setItem(USER_KEY, JSON.stringify(authUser));
        setToken(data.accessToken);
        setUser(authUser);

        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message || 'Registration failed' };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

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

      // If another user logged in while this guest request was in flight, do not overwrite
      const activeToken = sessionStorage.getItem(TOKEN_KEY);
      if (activeToken && activeToken !== data.accessToken) {
        return;
      }

      const authUser: AuthUser = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        phone: null,
        role: 'USER',
        isVerified: false
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

  const updateDisplayName = useCallback(async (newName: string) => {
    const clean = newName.trim();
    if (!clean) return { success: false, error: 'Name cannot be empty' };
    if (!token) return { success: false, error: 'No active session' };

    try {
      const res = await fetch('/api/auth/profile/username', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ username: clean })
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'Failed to update name' };
      }

      const updatedUser: AuthUser = {
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        phone: data.user.phone ?? null,
        role: data.user.role ?? 'USER',
        isVerified: data.user.isVerified ?? false
      };

      if (data.accessToken) {
        sessionStorage.setItem(TOKEN_KEY, data.accessToken);
        setToken(data.accessToken);
      }
      sessionStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);

      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message || 'Network error updating name' };
    }
  }, [token]);

  const logout = useCallback(async () => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
    setToken(null);
    await loginAsGuest();
  }, [loginAsGuest]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        sendOtp,
        registerWithOtp,
        loginAsGuest,
        updateDisplayName,
        logout
      }}
    >
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
