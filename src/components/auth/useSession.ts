'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CurrentUser } from '@/lib/auth/session';

export type Session = {
  /** null once loaded and nobody is signed in (a guest on a public site, or logged out). */
  user: CurrentUser | null;
  isLoading: boolean;
  /** True when the account exists but was disabled/not yet approved: the caller should sign out. */
  isBlocked: boolean;
  refresh: () => Promise<void>;
};

export function useSession(): Session {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (response.ok) {
        setUser((await response.json()) as CurrentUser);
        setIsBlocked(false);
      } else {
        setUser(null);
        setIsBlocked(response.status === 403);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, isLoading, isBlocked, refresh };
}
