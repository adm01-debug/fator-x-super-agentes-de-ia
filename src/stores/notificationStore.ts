/**
 * Nexus Agents Studio — Notification Store (Zustand)
 * In-app notifications with priority and read state.
 */

import { create } from 'zustand';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'medium' | 'high' | 'critical';
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  add: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,

  add: (notification) =>
    set((s) => {
      const newNotification: Notification = {
        ...notification,
        id: crypto.randomUUID(),
        read: false,
        createdAt: new Date().toISOString(),
      };
      const updated = [newNotification, ...s.notifications].slice(0, 100);
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.read).length,
      };
    }),

  markRead: (id) =>
    set((s) => {
      const updated = s.notifications.map(n => n.id === id ? { ...n, read: true } : n);
      return { notifications: updated, unreadCount: updated.filter(n => !n.read).length };
    }),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  remove: (id) =>
    set((s) => {
      const updated = s.notifications.filter(n => n.id !== id);
      return { notifications: updated, unreadCount: updated.filter(n => !n.read).length };
    }),

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
