import React, { createContext, useContext, useState, useEffect } from 'react';

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

const TOKEN_KEY = 'rummy_access_token';
const USER_KEY = 'rummy_user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const loginAsGuest = async (preferredName?: string) => {
    setIsLoading(true);
    try {
      const ts = Date.now().toString().slice(-4);
      const guestName = preferredName?.trim() || `Player_${ts}`;
      const email = `guest_${Date.now()}@rummy.local`;
      const password = `GuestPass${Date.now()}!`;

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

      setToken(data.accessToken);
      setUser(authUser);
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    } catch (err) {
      console.error('Guest login failed:', err);
      // Fallback local mock if backend is momentarily unreachable
      const mockId = `guest_${Math.random().toString(36).slice(2, 10)}`;
      const fallbackUser: AuthUser = {
        id: mockId,
        username: preferredName || `Player_${mockId.slice(-4)}`
      };
      setUser(fallbackUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

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
