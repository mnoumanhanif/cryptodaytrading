'use client';

import React from 'react';
import WatchList from '@/components/WatchList';
import PortfolioNotifications from '@/components/PortfolioNotifications';
import { useDashboard } from '@/contexts/DashboardContext';

export default function WatchlistPage() {
  const {
    items,
    coins,
    removeCoin,
    unreadCount,
    notifications,
    markAsRead,
    markAllAsRead,
  } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Watchlist
        {items.length > 0 && (
          <span className="text-xs text-gray-500 font-normal">({items.length} coins)</span>
        )}
        {unreadCount > 0 && (
          <span className="text-xs text-cyan-300 font-normal">• {unreadCount} unread notifications</span>
        )}
      </h2>

      <div className="max-w-2xl">
        <WatchList items={items} coins={coins} onRemove={removeCoin} />
      </div>

      <PortfolioNotifications
        notifications={notifications}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        symbols={items.map((item) => item.symbol)}
      />
    </div>
  );
}
