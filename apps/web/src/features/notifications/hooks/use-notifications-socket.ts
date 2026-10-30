'use client';

import { NotificationEvents, SOCKET_NAMESPACES } from '@ruet-chottor/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { notificationKeys } from './use-notifications';

/**
 * Keeps `/notifications` connected while a member is logged in (used once, by the header bell).
 * Events only say "something changed": the list and count are refetched over HTTP, so a
 * reconnect after missed events is handled the same way (CLAUDE.md §10).
 */
export function useNotificationsSocket({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket(SOCKET_NAMESPACES.notifications);
    let wasConnected = socket.connected;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    const onConnect = () => {
      if (wasConnected) refresh();
      wasConnected = true;
    };

    socket.on('connect', onConnect);
    socket.on(NotificationEvents.New, refresh);
    socket.on(NotificationEvents.ReadChanged, refresh);
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off(NotificationEvents.New, refresh);
      socket.off(NotificationEvents.ReadChanged, refresh);
      socket.disconnect();
    };
  }, [enabled, queryClient]);
}
