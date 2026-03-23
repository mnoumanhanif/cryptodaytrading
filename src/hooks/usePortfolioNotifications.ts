'use client';

import { useEffect, useMemo, useState } from 'react';
import { PortfolioNotification } from '@/lib/types';

const STORAGE_KEY = 'crypto-portfolio-notifications';
const MAX_NOTIFICATIONS = 200;

export function usePortfolioNotifications() {
  const [notifications, setNotifications] = useState<PortfolioNotification[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PortfolioNotification[];
      setNotifications(Array.isArray(parsed) ? parsed : []);
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  }, [mounted, notifications]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const pushNotifications = (items: PortfolioNotification[]) => {
    if (items.length === 0) return;
    setNotifications((prev) => {
      const merged = [...items, ...prev];
      return merged.slice(0, MAX_NOTIFICATIONS);
    });
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  };

  return { notifications, unreadCount, pushNotifications, markAsRead, markAllAsRead };
}
