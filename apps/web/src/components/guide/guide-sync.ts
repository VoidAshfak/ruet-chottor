'use client';

import { createContext } from 'react';

/**
 * Server-side memory of closed first-visit guides, so a guide never shows again on any device
 * (CLAUDE.md §8). Provided by the users feature for logged-in members; without a provider
 * (visitors, or the users module switched off) guides fall back to localStorage only.
 */
export type GuideSync = {
  /** `loading`: guides stay hidden until the server answers, so they do not flash. */
  status: 'loading' | 'ready';
  dismissed: readonly string[];
  dismiss: (moduleKey: string) => void;
};

export const GuideSyncContext = createContext<GuideSync | null>(null);
