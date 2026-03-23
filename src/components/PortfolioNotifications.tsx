'use client';

import { useMemo, useState } from 'react';
import {
  PortfolioNotification,
  PortfolioNotificationFilter,
  PortfolioNotificationPriority,
  PortfolioNotificationType,
} from '@/lib/types';

function typeMeta(type: PortfolioNotificationType): { icon: string; label: string } {
  if (type === 'LONG') return { icon: '🟢', label: 'LONG Signal' };
  if (type === 'SHORT') return { icon: '🔴', label: 'SHORT Signal' };
  if (type === 'RISK') return { icon: '⚠️', label: 'Risk Alert' };
  return { icon: '💣', label: 'Squeeze Alert' };
}

function priorityBadge(priority: PortfolioNotificationPriority): string {
  return priority === 'HIGH'
    ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
    : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200';
}

export default function PortfolioNotifications({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: {
  notifications: PortfolioNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}) {
  const [filter, setFilter] = useState<PortfolioNotificationFilter>('ALL');

  const filtered = useMemo(() => {
    if (filter === 'ALL') return notifications;
    return notifications.filter((item) => item.type === filter);
  }, [filter, notifications]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 md:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm md:text-base font-semibold text-white">🔔 Notifications</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as PortfolioNotificationFilter)}
            className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100"
          >
            <option value="ALL">All</option>
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
            <option value="RISK">RISK</option>
            <option value="SQUEEZE">SQUEEZE</option>
          </select>
          <button
            onClick={onMarkAllAsRead}
            className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:border-gray-600"
          >
            Mark all read
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-gray-400">No notifications yet.</p>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {filtered.slice(0, 50).map((item) => {
            const meta = typeMeta(item.type);
            return (
              <div
                key={item.id}
                className={`rounded-lg border p-2.5 ${item.read ? 'border-gray-800 bg-gray-900/60' : 'border-cyan-700/40 bg-cyan-900/10'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-gray-400">{new Date(item.createdAt).toLocaleTimeString()}</p>
                    <p className="text-sm text-gray-100">
                      {meta.icon} {meta.label} — {item.symbol.replace('USDT', '')}
                      {typeof item.confidence === 'number' ? ` (${item.confidence}%)` : ''}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5">{item.reason}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityBadge(item.priority)}`}>
                      {item.priority === 'HIGH' ? '🔥 High' : '⚡ Medium'}
                    </span>
                    {!item.read && (
                      <button
                        onClick={() => onMarkAsRead(item.id)}
                        className="text-[11px] px-1.5 py-0.5 rounded border border-gray-700 text-gray-300 hover:border-gray-600"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">{item.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
