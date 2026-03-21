'use client';

// ============================================================
// Signal badge component – BUY / SELL / HOLD
// ============================================================

import { Signal } from '@/lib/types';

const badgeStyles: Record<Signal, string> = {
  BUY: 'bg-green-500/20 text-green-400 border-green-500/30',
  SELL: 'bg-red-500/20 text-red-400 border-red-500/30',
  HOLD: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export default function SignalBadge({ signal }: { signal: Signal }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeStyles[signal]}`}
    >
      {signal}
    </span>
  );
}
