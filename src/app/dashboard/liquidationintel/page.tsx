'use client';

import React from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import {
  UI_HEADING_CLASS,
  UI_SMALL_LABEL_CLASS,
  UI_DATA_TEXT_CLASS,
  UI_SECTION_TITLE_CLASS,
  pressureColorFromImbalance,
  pressureLabel,
  liquidationVisualBar,
  LIQUIDATION_SIGNAL_THRESHOLD,
} from '@/components/dashboard-pages/dashboardHelpers';

export default function LiquidationIntelPage() {
  const {
    liquidationTimeframe,
    setLiquidationTimeframe,
    liquidationMinImbalance,
    setLiquidationMinImbalance,
    liquidationHighOnly,
    setLiquidationHighOnly,
    liquidationIntelRows,
  } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className={`${UI_HEADING_CLASS} flex items-center gap-2`}>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Liquidation Intelligence
        </h2>
        <p className={`${UI_SMALL_LABEL_CLASS} text-gray-400`}>Clear pressure, signal, and action</p>
      </div>

      <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 cursor-pointer">
            <span className={`${UI_SMALL_LABEL_CLASS} text-gray-500`}>Timeframe</span>
            <select
              value={liquidationTimeframe}
              onChange={(event) => setLiquidationTimeframe(event.target.value as '5m' | '15m' | '1h')}
              className={`${UI_DATA_TEXT_CLASS} bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white cursor-pointer`}
            >
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 cursor-pointer">
            <span className={`${UI_SMALL_LABEL_CLASS} text-gray-500`}>Imbalance threshold</span>
            <select
              value={liquidationMinImbalance}
              onChange={(event) => setLiquidationMinImbalance(Number(event.target.value))}
              className={`${UI_DATA_TEXT_CLASS} bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white cursor-pointer`}
            >
              <option value={0.3}>0.3+ only</option>
              <option value={0.5}>0.5+ only</option>
              <option value={0.8}>0.8+ only</option>
            </select>
          </label>
          <label className="flex items-center gap-2 mt-5 md:mt-0 cursor-pointer">
            <input
              type="checkbox"
              checked={liquidationHighOnly}
              onChange={(event) => setLiquidationHighOnly(event.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-cyan-500 cursor-pointer"
            />
            <span className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>High liquidation size only</span>
          </label>
        </div>
      </div>

      {liquidationIntelRows.length > 0 && (
        <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
          {(() => {
            const top = liquidationIntelRows[0];
            const topSignal = top.signal;
            const isBullish = top.normalizedImbalance > LIQUIDATION_SIGNAL_THRESHOLD;
            const maxLiq = Math.max(top.longLiquidationPressure, top.shortLiquidationPressure, 1);
            const longBar = liquidationVisualBar(top.longLiquidationPressure, maxLiq);
            const shortBar = liquidationVisualBar(top.shortLiquidationPressure, maxLiq);
            return (
              <div className="space-y-2">
                <h3 className={`${UI_SECTION_TITLE_CLASS} text-white`}>
                  🧠 Liquidation Overview Card · {top.symbol.replace('USDT', '')}
                </h3>
                <p className={`${UI_DATA_TEXT_CLASS} ${pressureColorFromImbalance(top.normalizedImbalance)}`}>
                  Market Pressure: {top.pressure} · {top.squeezeType === 'Short Squeeze' ? '🔥 Short Squeeze Detected' : top.squeezeType === 'Long Squeeze' ? '💣 Long Squeeze Detected' : '🟡 No squeeze'}
                </p>
                <p className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>
                  Short Liquidations: {top.shortLiquidationPressure.toFixed(2)} · Long Liquidations: {top.longLiquidationPressure.toFixed(2)}
                </p>
                <p className={`${UI_DATA_TEXT_CLASS} ${pressureColorFromImbalance(top.normalizedImbalance)}`}>
                  {pressureLabel(top.normalizedImbalance)}
                </p>
                <p className={`${UI_DATA_TEXT_CLASS} text-gray-300`}>
                  💡 Insight: {isBullish ? 'More short traders are getting liquidated → price moving up strongly' : 'More long traders are getting liquidated → downside pressure is dominant'}
                </p>
                <p className={`${UI_DATA_TEXT_CLASS} text-gray-300`}>
                  📈 Bias: {isBullish ? 'Bullish (Short-term)' : 'Bearish (Short-term)'}
                </p>
                <p className={`${UI_DATA_TEXT_CLASS} text-gray-300`}>
                  ⚠️ Strategy: {isBullish ? 'Look for LONG opportunities on pullbacks' : 'Look for SHORT opportunities on relief rallies'}
                </p>
                <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
                  <p className={`${UI_SECTION_TITLE_CLASS} text-cyan-200 mb-1`}>🚀 Trade Signal</p>
                  <p className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>
                    Type: {topSignal === 'LONG' ? '🟢 LONG' : topSignal === 'SHORT' ? '🔴 SHORT' : '🟡 WAIT'} · Strength: {top.strength} · Confidence: {top.confidence}%
                  </p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
                  <p className={`${UI_DATA_TEXT_CLASS} text-gray-200 font-mono`}>Long Liq&nbsp;&nbsp;&nbsp;{longBar} ({top.longLiquidationPressure.toFixed(2)})</p>
                  <p className={`${UI_DATA_TEXT_CLASS} text-gray-200 font-mono`}>Short Liq&nbsp;&nbsp;{shortBar} ({top.shortLiquidationPressure.toFixed(2)})</p>
                </div>
                <p className={`${UI_DATA_TEXT_CLASS} text-yellow-200`}>
                  {top.trap === 'SHORTS'
                    ? '⚠️ Traders Trapped: SHORTS · Market likely to continue upward'
                    : top.trap === 'LONGS'
                    ? '⚠️ Traders Trapped: LONGS · Market likely to drop further'
                    : '⚠️ No strong trap detected'}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-3 overflow-x-auto">
        <h3 className={`${UI_SECTION_TITLE_CLASS} text-white mb-2`}>🧾 Multi-Coin Liquidation Scan</h3>
        <table className={`w-full min-w-[920px] ${UI_DATA_TEXT_CLASS}`}>
          <thead>
            <tr className={`${UI_SMALL_LABEL_CLASS} text-gray-400 border-b border-gray-800`}>
              <th className="text-left py-1.5">Coin</th>
              <th className="text-left py-1.5">Pressure</th>
              <th className="text-left py-1.5">Signal</th>
              <th className="text-right py-1.5">Imbalance</th>
              <th className="text-left py-1.5">Action</th>
              <th className="text-left py-1.5">Alert Type</th>
              <th className="text-left py-1.5">Trap Detection</th>
            </tr>
          </thead>
          <tbody>
            {liquidationIntelRows.map((item) => (
              <tr key={`intel-${item.symbol}`} className="border-b border-gray-800/60">
                <td className="py-1.5 text-gray-100">{item.symbol.replace('USDT', '')}</td>
                <td className={`py-1.5 ${pressureColorFromImbalance(item.normalizedImbalance)}`}>
                  {item.normalizedImbalance > LIQUIDATION_SIGNAL_THRESHOLD ? '🟢 Bullish' : item.normalizedImbalance < -LIQUIDATION_SIGNAL_THRESHOLD ? '🔴 Bearish' : '🟡 Neutral'}
                </td>
                <td className={`py-1.5 ${pressureColorFromImbalance(item.normalizedImbalance)}`}>
                  {item.signal === 'LONG' ? 'LONG' : item.signal === 'SHORT' ? 'SHORT' : 'WAIT'}
                </td>
                <td className={`py-1.5 text-right ${pressureColorFromImbalance(item.normalizedImbalance)}`}>
                  {item.normalizedImbalance >= 0 ? '+' : ''}{item.normalizedImbalance.toFixed(2)}
                </td>
                <td className="py-1.5 text-gray-200">{item.action}</td>
                <td className="py-1.5 text-gray-200">
                  {item.squeezeType === 'Short Squeeze' ? '🔥 Short Squeeze' : item.squeezeType === 'Long Squeeze' ? '💣 Long Squeeze' : '—'}
                </td>
                <td className="py-1.5 text-yellow-200">
                  {item.trap === 'SHORTS' ? 'SHORTS trapped' : item.trap === 'LONGS' ? 'LONGS trapped' : 'No trap'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
