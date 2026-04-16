/**
 * Nexus Agents Studio — useNotifications Hook
 *
 * In-app notification management using the zustand notification store.
 * Does NOT depend on a database 'notifications' table — uses in-memory store only.
 */

import { useCallback } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuth } from '@/contexts/AuthContext';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  subject: string;
  message: string;
  channel: 'in_app';
  priority: string;
  status: 'read' | 'sent';
  recipient_id: string;
  created_at: string;
  read_at?: string;
  type: string;
}

export function useNotifications(_pollIntervalMs: number = 30000) {
  const storeNotifs = useNotificationStore((s) => s.notifications);
  const storeUnread = useNotificationStore((s) => s.unreadCount);
  const storeMarkRead = useNotificationStore((s) => s.markRead);
  const storeMarkAllRead = useNotificationStore((s) => s.markAllRead);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    // No-op: notifications come from the zustand store reactively
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    storeMarkRead(id);
  }, [storeMarkRead]);

  const markAllAsRead = useCallback(async () => {
    storeMarkAllRead();
  }, [storeMarkAllRead]);

  const notifications: NotificationItem[] = storeNotifs.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.message,
    subject: n.title,
    message: n.message,
    channel: 'in_app' as const,
    priority: n.priority,
    status: (n.read ? 'read' : 'sent') as 'read' | 'sent',
    recipient_id: user?.id ?? '',
    created_at: n.createdAt,
    read_at: n.read ? n.createdAt : undefined,
    type: n.type,
  }));

  return {
    notifications,
    unreadCount: storeUnread,
    loading: false,
    refresh,
    markOneRead,
    markAllAsRead,
  };
}
