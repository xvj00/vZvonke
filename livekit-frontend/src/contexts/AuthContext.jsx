/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, setAuthToken } from '../lib/api';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'mediasoup.auth';

const readStoredAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const data = JSON.parse(raw);
    return { token: data?.token || null, user: data?.user || null };
  } catch {
    return { token: null, user: null };
  }
};

export const AuthProvider = ({ children }) => {
  const stored = readStoredAuth();
  const [user, setUser] = useState(stored.user);
  const [token, setToken] = useState(stored.token);
  const [loading, setLoading] = useState(false);

  const persistAuth = useCallback((nextToken, nextUser) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  }, []);

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  const login = useCallback(async (payload) => {
    setLoading(true);
    try {
      const data = await authApi.login(payload);
      const nextToken = data?.token || null;
      const nextUser = data?.user || null;
      setToken(nextToken);
      setUser(nextUser);
      setAuthToken(nextToken);
      persistAuth(nextToken, nextUser);
    } finally {
      setLoading(false);
    }
  }, [persistAuth]);

  const register = useCallback(async (payload) => {
    setLoading(true);
    try {
      const data = await authApi.register(payload);
      const nextToken = data?.token || null;
      const nextUser = data?.user || null;
      setToken(nextToken);
      setUser(nextUser);
      setAuthToken(nextToken);
      persistAuth(nextToken, nextUser);
    } finally {
      setLoading(false);
    }
  }, [persistAuth]);

  const refreshProfile = useCallback(async () => {
    const profile = await authApi.getProfile();
    setUser(profile);
    persistAuth(token, profile);
    return profile;
  }, [token, persistAuth]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authApi.logout();
    } catch {
      // noop: if token is invalid, just clear client state
    }
    setAuthToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, refreshProfile }),
    [user, token, loading, login, register, logout, refreshProfile],
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
