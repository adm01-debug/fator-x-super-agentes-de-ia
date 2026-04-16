/**
 * Nexus Agents Studio — useNotifications Hook
 *
 * In-app notification management using the zustand notification store.
 * Does NOT depend on a database 'notifications' table — uses in-memory store only.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNotificationStore, type Notification } from '@/stores/notificationStore';
import { useAuth } from '@/contexts/AuthContext';

export function useNotifications(_pollIntervalMs: number = 30000) {
  const storeNotifs = useNotificationStore((s) => s.notifications);
  const storeUnread = useNotificationStore((s) => s.unreadCount);
  const storeMarkRead = useNotificationStore((s) => s.markRead);
  const storeMarkAllRead = useNotificationStore((s) => s.markAllRead);
  const { user } = useAuth();
  const [loading] = useState(false);

  const refresh = useCallback(async () => {
    // No-op: notifications come from the zustand store reactively
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    storeMarkRead(id);
  }, [storeMarkRead]);

  const markAllAsRead = useCallback(async () => {
    storeMarkAllRead();
  }, [storeMarkAllRead]);

  // Map store Notification type to the shape expected by consumers
  const notifications = storeNotifs.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.message,
    message: n.message,
    channel: 'in_app' as const,
    priority: (n.type === 'error' ? 'critical' : 'normal') as 'critical' | 'normal',
    status: (n.read ? 'read' : 'sent') as 'read' | 'sent',
    recipient_id: user?.id ?? '',
    created_at: n.timestamp,
    read_at: n.read ? n.timestamp : undefined,
    type: n.type,
  }));

  return {
    notifications,
    unreadCount: storeUnread,
    loading,
    refresh,
    markOneRead,
    markAllAsRead,
  };
}
