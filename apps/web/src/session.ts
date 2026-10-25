import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, checkSession, describeError, login as requestToken, logout as revokeToken } from './api';

const STORAGE_KEY = 'marauder_token';

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, token);
    }
  } catch {
    return;
  }
}

export interface Session {
  token: string | null;
  expired: () => void;
}

export const SessionContext = createContext<Session>({ token: null, expired: () => undefined });

function useSession(): Session {
  return useContext(SessionContext);
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [notice, setNotice] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const signOut = useCallback((reason: string | null) => {
    storeToken(null);
    setToken(null);
    setNotice(reason);
  }, []);

  const expired = useCallback(() => signOut('your session ended, log in again'), [signOut]);

  useEffect(() => {
    if (token === null) {
      return;
    }
    let current = true;
    checkSession(token).catch((error: unknown) => {
      if (current && error instanceof ApiError && error.status === 401) {
        expired();
      }
    });
    return () => {
      current = false;
    };
  }, [token, expired]);

  const login = async (password: string): Promise<void> => {
    const next = await requestToken(password);
    storeToken(next);
    setToken(next);
    setNotice(null);
  };

  const logout = async (): Promise<void> => {
    if (token === null) {
      return;
    }
    setLoggingOut(true);
    try {
      await revokeToken(token);
      signOut(null);
    } catch (error) {
      const alreadyEnded = error instanceof ApiError && error.status === 401;
      signOut(
        alreadyEnded
          ? null
          : `logged out here, but the server could not end the session (${describeError(error)}), so it ends on its own`,
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return { session: { token, expired }, notice, login, logout, loggingOut };
}

export function useAction() {
  const { token, expired } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: (token: string) => Promise<void>): Promise<boolean> => {
    if (token === null) {
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await action(token);
      return true;
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) {
        expired();
      } else {
        setError(describeError(failure));
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run, allowed: token !== null };
}
