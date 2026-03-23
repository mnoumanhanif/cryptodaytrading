'use client';

import { useMemo } from 'react';

type MarqueeSignal = {
  symbol: string;
  confidence: number;
  bias: 'Long' | 'Short';
  isNew: boolean;
};

function formatSignal(signal: MarqueeSignal) {
  const symbol = signal.symbol.replace('USDT', '');
  const sign = signal.bias === 'Long' ? '+' : '-';
  const tags: string[] = [];
  if (signal.confidence > 85) tags.push('🔥');
  if (signal.isNew) tags.push('⚡');
  return `${symbol} ${sign}${signal.confidence}%${tags.length > 0 ? ` ${tags.join(' ')}` : ''}`;
}

export default function LiveSignalMarquee({
  longSignals,
  shortSignals,
}: {
  longSignals: MarqueeSignal[];
  shortSignals: MarqueeSignal[];
}) {
  const longText = useMemo(
    () =>
      longSignals.length > 0
        ? `🟢 LONG: ${longSignals.map((signal) => formatSignal(signal)).join(' | ')}`
        : '🟢 LONG: Waiting for live opportunities...',
    [longSignals]
  );

  const shortText = useMemo(
    () =>
      shortSignals.length > 0
        ? `🔴 SHORT: ${shortSignals.map((signal) => formatSignal(signal)).join(' | ')}`
        : '🔴 SHORT: Waiting for live opportunities...',
    [shortSignals]
  );

  const line = `${longText}      ${shortText}      `;

  return (
    <div className="marquee border-b border-gray-800 bg-[#0b1220]">
      <div className="marquee-track" aria-live="polite">
        <span className="long">{line}</span>
        <span className="short">{line}</span>
        <span className="long">{line}</span>
      </div>
    </div>
  );
}
