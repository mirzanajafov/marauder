import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, checkSession, errorMessage, login as requestToken, logout as revokeToken } from './api';

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
  expired: (token: string) => void;
}

export const SessionContext = createContext<Session>({ token: null, expired: () => undefined });

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(readStoredToken);
  const currentToken = useRef(token);
  const [notice, setNotice] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const setToken = useCallback((next: string | null) => {
    currentToken.current = next;
    storeToken(next);
    setTokenState(next);
  }, []);

  const signOut = useCallback(
    (reason: string | null) => {
      setToken(null);
      setNotice(reason);
    },
    [setToken],
  );

  const expired = useCallback(
    (failed: string) => {
      if (failed === currentToken.current) {
        signOut('your session ended, log in again');
      }
    },
    [signOut],
  );

  useEffect(() => {
    if (token === null) {
      return;
    }
    checkSession(token).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        expired(token);
      }
    });
  }, [token, expired]);

  const login = async (password: string): Promise<void> => {
    setToken(await requestToken(password));
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
          : `logged out here, but the server could not end the session (${errorMessage(error)}), so it ends on its own`,
      );
    } finally {
      setLoggingOut(false);
    }
  };

  const session = useMemo(() => ({ token, expired }), [token, expired]);

  return { session, notice, login, logout, loggingOut };
}

export function useAction() {
  const { token, expired } = useContext(SessionContext);
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
        expired(token);
      } else {
        setError(errorMessage(failure));
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run, allowed: token !== null };
}
