'use client';

// ============================================================
// Progress tracker – visual P&L with progress bar toward target/stop
// ============================================================

interface ProgressTrackerProps {
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
}

export default function ProgressTracker({
  entryPrice,
  currentPrice,
  targetPrice,
  stopLoss,
}: ProgressTrackerProps) {
  const low = Math.min(targetPrice, stopLoss);
  const high = Math.max(targetPrice, stopLoss);
  const totalRange = high - low;
  const currentPosition = currentPrice - low;
  const entryPosition = entryPrice - low;

  const progressPercent = totalRange > 0 ? Math.max(0, Math.min(100, (currentPosition / totalRange) * 100)) : 50;
  const entryPercent = totalRange > 0 ? Math.max(0, Math.min(100, (entryPosition / totalRange) * 100)) : 50;

  const pnl = currentPrice - entryPrice;
  const pnlPercent = entryPrice > 0 ? (pnl / entryPrice) * 100 : 0;
  const isProfit = pnl >= 0;

  return (
    <div className="space-y-1">
      {/* P&L */}
      <div className="flex justify-between text-xs">
        <span className={isProfit ? 'text-green-400' : 'text-red-400'}>
          {isProfit ? '+' : ''}
          {pnlPercent.toFixed(2)}%
        </span>
        <span className="text-gray-500">
          {isProfit ? '+' : ''}${pnl.toFixed(4)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
        {/* Stop loss zone */}
        <div className="absolute inset-y-0 left-0 bg-red-500/20 rounded-l-full" style={{ width: `${entryPercent}%` }} />
        {/* Target zone */}
        <div className="absolute inset-y-0 right-0 bg-green-500/20 rounded-r-full" style={{ width: `${100 - entryPercent}%` }} />
        {/* Current position */}
        <div
          className={`absolute top-0 h-full w-1 ${isProfit ? 'bg-green-400' : 'bg-red-400'}`}
          style={{ left: `${progressPercent}%` }}
        />
        {/* Entry marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gray-300"
          style={{ left: `${entryPercent}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>SL</span>
        <span>Entry</span>
        <span>Target</span>
      </div>
    </div>
  );
}
