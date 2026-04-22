/**
 * Nexus Agents Studio — useNotifications Hook
 *
 * In-app notification management with unread count,
 * designed for the notification bell in the app header.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getInAppNotifications,
  markRead,
  markAllRead,
  type NotificationPayload,
} from '@/services/notificationEngineService';
import { useAuth } from '@/contexts/useAuth';

export function useNotifications(pollIntervalMs: number = 30000) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const data = await getInAppNotifications(user.id, false);
      setNotifications(data);
      setUnreadCount(data.filter((n) => n.status === 'sent' || n.status === 'delivered').length);
    } catch {
      // Table may not exist — silently return empty
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
    if (pollIntervalMs > 0) {
      const interval = setInterval(refresh, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [refresh, pollIntervalMs]);

  const markOneRead = useCallback(async (id: string) => {
    await markRead(id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, status: 'read' as const, read_at: new Date().toISOString() } : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    await markAllRead(user.id);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, status: 'read' as const, read_at: new Date().toISOString() })),
    );
    setUnreadCount(0);
  }, [user?.id]);

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markOneRead,
    markAllAsRead,
  };
}
