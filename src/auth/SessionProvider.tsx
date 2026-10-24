import React, { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'userToken';
const SESSION_CHECK_TIMEOUT_MS = 10_000;

type SessionContextValue = {
  token: string | null;
  isLoading: boolean;
  restoreError: boolean;
  retryRestore: () => void;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [restoreError, setRestoreError] = useState(false);
  const [restoreAttempt, setRestoreAttempt] = useState(0);

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function restoreSession() {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!isActive || !savedToken?.trim()) return;

        timeout = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
          signal: controller.signal,
        });

        if (!isActive) return;

        // Лише 401 підтверджує, що збережений вхід більше не чинний.
        if (response.status === 401) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          return;
        }

        if (!response.ok) throw new Error('Session verification failed');

        const data: { user?: { id?: unknown; email?: unknown } } | null = await response.json();
        const user = data?.user;
        if (
          typeof user?.id !== 'number' ||
          !Number.isSafeInteger(user.id) ||
          user.id <= 0 ||
          typeof user.email !== 'string' ||
          !user.email.trim()
        ) {
          throw new Error('Invalid session response');
        }

        if (isActive) setToken(savedToken);
      } catch {
        // Збій мережі, сервера чи сховища не означає недійсний токен.
        if (isActive) setRestoreError(true);
      } finally {
        clearTimeout(timeout);
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      isActive = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [restoreAttempt]);

  function retryRestore() {
    setRestoreError(false);
    setIsLoading(true);
    setRestoreAttempt((attempt) => attempt + 1);
  }

  async function signIn(newToken: string) {
    // Спочатку зберігаємо токен; лише після успіху відкриваємо головний екран.
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
  }

  return (
    <SessionContext.Provider value={{ token, isLoading, restoreError, retryRestore, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);

  if (!session) {
    throw new Error('useSession потрібно викликати всередині SessionProvider.');
  }

  return session;
}
