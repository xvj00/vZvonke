import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, setAuthToken } from '../lib/api';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'livekit.auth';

const readStoredAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const data = JSON.parse(raw);
    return { token: data?.token || null, user: data?.user || null };
  } catch (error) {
    return { token: null, user: null };
  }
};

export const AuthProvider = ({ children }) => {
  const stored = readStoredAuth();
  const [user, setUser] = useState(stored.user);
  const [token, setToken] = useState(stored.token);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = useCallback(async (payload) => {
    const data = await authApi.login(payload);
    const nextToken = data?.token || null;
    const nextUser = data?.user || null;
    setToken(nextToken);
    setUser(nextUser);
    setAuthToken(nextToken);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    const nextToken = data?.token || null;
    const nextUser = data?.user || null;
    setToken(nextToken);
    setUser(nextUser);
    setAuthToken(nextToken);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // noop: if token is invalid, just clear client state
    }
    setAuthToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
