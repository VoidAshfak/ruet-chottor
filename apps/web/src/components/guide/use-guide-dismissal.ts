'use client';

import { useCallback, useContext, useSyncExternalStore } from 'react';
import { GuideSyncContext } from './guide-sync';

// localStorage is a fast per-device cache; the server copy (GuideSyncContext) follows the user.
const PREFIX = 'chottor:guide-dismissed:';
const storageKey = (moduleKey: string) => `${PREFIX}${moduleKey}`;
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

function notify() {
  listeners.forEach((listener) => listener());
}

/** Forget every guide closed on this device ("Show tips again"). */
export function clearLocalGuideDismissals() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(PREFIX)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: nothing was cached here anyway.
  }
  notify();
}

export function useGuideDismissal(moduleKey: string) {
  const sync = useContext(GuideSyncContext);
  const dismissedHere = useSyncExternalStore(
    subscribe,
    () => readDismissed(moduleKey),
    () => true, // never render the guide on the server
  );
  const dismissedOnServer = sync
    ? sync.status === 'loading' || sync.dismissed.includes(moduleKey)
    : false;

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(storageKey(moduleKey), '1');
    } catch {
      // Ignore: the server copy (if any) still remembers it.
    }
    sync?.dismiss(moduleKey);
    notify();
  }, [moduleKey, sync]);

  return { dismissed: dismissedHere || dismissedOnServer, dismiss };
}
