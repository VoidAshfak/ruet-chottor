'use client';

import { useCallback, useSyncExternalStore } from 'react';

// TODO(phase-1): store dismissals per user on the server (PATCH /api/v1/users/me/guides)
// so a guide never shows again on any device (CLAUDE.md §8). localStorage stays as a fast cache.
const storageKey = (moduleKey: string) => `chottor:guide-dismissed:${moduleKey}`;
const listeners = new Set<() => void>();

function readDismissed(moduleKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(moduleKey)) === '1';
  } catch {
    return false; // storage blocked (private mode): just show the guide
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGuideDismissal(moduleKey: string) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => readDismissed(moduleKey),
    () => true, // never render the guide on the server
  );

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey(moduleKey), '1');
    } catch {
      // Ignore: the guide will show again next visit, which is harmless.
    }
    listeners.forEach((listener) => listener());
  }, [moduleKey]);

  return { dismissed, dismiss };
}
