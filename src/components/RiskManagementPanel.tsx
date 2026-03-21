'use client';

// ============================================================
// Risk Management Panel – position sizing calculator + display
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { CoinAnalysis } from '@/lib/types';
import { calculateNetRiskReward, calculatePositionSize } from '@/lib/risk';

interface Props {
  coin: CoinAnalysis;
}

export default function RiskManagementPanel({ coin }: Props) {
  const [accountSize, setAccountSize] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [simEntryPrice, setSimEntryPrice] = useState(0);
  const [simTargetPrice, setSimTargetPrice] = useState(0);
  const [simStopLoss, setSimStopLoss] = useState(0);
  const [simQuantity, setSimQuantity] = useState(1);

  useEffect(() => {
    setSimEntryPrice(coin.risk.entryPrice);
    setSimTargetPrice(coin.risk.takeProfit3);
    setSimStopLoss(coin.risk.stopLoss);
    setSimQuantity(1);
  }, [coin.symbol, coin.risk.entryPrice, coin.risk.takeProfit3, coin.risk.stopLoss]);

  const positionSize = calculatePositionSize(
    accountSize,
    riskPercent,
    coin.risk.entryPrice,
    coin.risk.stopLoss
  );
  const positionValue = positionSize * coin.risk.entryPrice;
  const maxLoss = accountSize * (riskPercent / 100);
  const simulated = useMemo(() => {
    const entry = Math.max(0, simEntryPrice || 0);
    const target = Math.max(0, simTargetPrice || 0);
    const stop = Math.max(0, simStopLoss || 0);
    const qty = Math.max(0, simQuantity || 0);
    const isShort = target < entry;

    const grossProfit = qty > 0 && entry > 0
      ? (isShort ? entry - target : target - entry) * qty
      : 0;
    const grossLoss = qty > 0 && entry > 0
      ? (isShort ? stop - entry : entry - stop) * qty
      : 0;

    const netRisk = calculateNetRiskReward(entry, stop, target);
    const grossRewardRiskRatio = grossLoss > 0 ? grossProfit / grossLoss : 0;
    const requiredWinRate = grossRewardRiskRatio > 0 ? 100 / (1 + grossRewardRiskRatio) : 0;
    const riskPctOfAccount = accountSize > 0 ? (Math.max(0, grossLoss) / accountSize) * 100 : 0;

    return {
      isShort,
      grossProfit,
      grossLoss,
      grossRewardRiskRatio,
      requiredWinRate,
      riskPctOfAccount,
      breakEvenMovePct: netRisk.breakEvenMovePct,
      netRR: netRisk.netRR,
      totalCostPct: netRisk.totalCostPct,
      entryValid: entry > 0 && qty > 0,
      setupValid: grossProfit > 0 && grossLoss > 0,
    };
  }, [simEntryPrice, simTargetPrice, simStopLoss, simQuantity, accountSize]);

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
        Risk Management
      </h3>

      {/* Position size inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Account Size (USD)</label>
          <input
            type="number"
            min={1}
            value={accountSize}
            onChange={(e) => setAccountSize(Math.max(1, parseFloat(e.target.value) || 0))}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Risk per Trade (%)</label>
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.1}
            value={riskPercent}
            onChange={(e) => setRiskPercent(Math.max(0.1, parseFloat(e.target.value) || 1))}
            className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Calculated results */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/60 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Position Size</div>
          <div className="text-sm font-mono text-white font-semibold">
            {positionSize > 0 ? positionSize.toFixed(4) : '—'} units
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Position Value</div>
          <div className="text-sm font-mono text-blue-300 font-semibold">
            ${positionValue > 0 ? positionValue.toFixed(2) : '—'}
          </div>
        </div>
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3">
          <div className="text-xs text-red-400/80 mb-1">Max Loss</div>
          <div className="text-sm font-mono text-red-400 font-semibold">
            −${maxLoss.toFixed(2)}
          </div>
        </div>
        <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-3">
          <div className="text-xs text-green-400/80 mb-1">Max Gain (TP3)</div>
          <div className="text-sm font-mono text-green-400 font-semibold">
            +${positionSize > 0
              ? (Math.abs(coin.risk.takeProfit3 - coin.risk.entryPrice) * positionSize).toFixed(2)
              : '—'}
          </div>
        </div>
      </div>

      {/* Simulated P/L calculator */}
      <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Simulated Profit / Loss
          </h4>
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/30 text-cyan-300 bg-cyan-500/10">
            {simulated.isShort ? 'Short setup' : 'Long setup'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Entry Price</label>
            <input
              type="number"
              min={0}
              step="any"
              value={simEntryPrice}
              onChange={(e) => setSimEntryPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Target Price</label>
            <input
              type="number"
              min={0}
              step="any"
              value={simTargetPrice}
              onChange={(e) => setSimTargetPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Stop Loss</label>
            <input
              type="number"
              min={0}
              step="any"
              value={simStopLoss}
              onChange={(e) => setSimStopLoss(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Quantity</label>
            <input
              type="number"
              min={0}
              step="any"
              value={simQuantity}
              onChange={(e) => setSimQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg p-3 bg-green-900/20 border border-green-500/20">
            <div className="text-[11px] text-green-300/80 mb-1">Profit at Target</div>
            <div className="text-sm font-semibold font-mono text-green-300">
              +${Math.max(0, simulated.grossProfit).toFixed(2)}
            </div>
          </div>
          <div className="rounded-lg p-3 bg-red-900/20 border border-red-500/20">
            <div className="text-[11px] text-red-300/80 mb-1">Loss at Stop</div>
            <div className="text-sm font-semibold font-mono text-red-300">
              −${Math.max(0, simulated.grossLoss).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <StatTile
            label="Reward/Risk Ratio"
            value={simulated.setupValid ? `${simulated.grossRewardRiskRatio.toFixed(2)}:1` : '—'}
          />
          <StatTile
            label="Required Win Rate"
            value={simulated.setupValid ? `${simulated.requiredWinRate.toFixed(1)}%` : '—'}
          />
          <StatTile
            label="Risk / Account"
            value={simulated.setupValid ? `${simulated.riskPctOfAccount.toFixed(2)}%` : '—'}
          />
          <StatTile
            label="Break-even Move"
            value={simulated.entryValid ? `${simulated.breakEvenMovePct.toFixed(2)}%` : '—'}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <StatTile
            label="Net R:R (after cost)"
            value={simulated.setupValid ? `${simulated.netRR.toFixed(2)}R` : '—'}
          />
          <StatTile
            label="Round-trip Cost"
            value={simulated.entryValid ? `${simulated.totalCostPct.toFixed(2)}%` : '—'}
          />
        </div>
        {!simulated.setupValid && (
          <p className="text-[11px] text-amber-300/80">
            Enter a valid setup where target favors your trade direction and stop-loss defines positive risk.
          </p>
        )}
      </div>

      {/* Visual TP/SL bar */}
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Price Levels</div>
        <PriceLevelBar coin={coin} />
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <dl className="rounded-lg bg-gray-800/60 border border-gray-700/70 p-2.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-200 font-semibold mt-0.5">{value}</dd>
    </dl>
  );
}

function PriceLevelBar({ coin }: { coin: CoinAnalysis }) {
  const { risk } = coin;
  const low = Math.min(risk.stopLoss, risk.takeProfit3);
  const high = Math.max(risk.stopLoss, risk.takeProfit3);
  const range = high - low || 1;

  const toPercent = (p: number) => ((p - low) / range) * 100;

  const levels = [
    { price: risk.stopLoss, label: 'SL', color: 'bg-red-500', textColor: 'text-red-400' },
    { price: risk.entryPrice, label: 'Entry', color: 'bg-blue-500', textColor: 'text-blue-400' },
    { price: risk.takeProfit1, label: 'TP1', color: 'bg-green-400', textColor: 'text-green-400' },
    { price: risk.takeProfit2, label: 'TP2', color: 'bg-green-500', textColor: 'text-green-400' },
    { price: risk.takeProfit3, label: 'TP3', color: 'bg-green-600', textColor: 'text-green-300' },
  ];

  return (
    <div className="relative h-6 bg-gray-700/50 rounded-full overflow-visible">
      {/* Gradient fill from SL to TP3 */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-red-500/20 via-blue-500/20 to-green-500/20" />
      {levels.map(({ price, label, color, textColor }) => (
        <div
          key={label}
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
          style={{ left: `${toPercent(price)}%` }}
        >
          <div className={`w-2 h-4 ${color} rounded-sm`} />
          <span className={`text-[9px] ${textColor} absolute -bottom-4 whitespace-nowrap`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
