'use client';

import React from 'react';
import MarketOverviewPanel from '@/components/MarketOverviewPanel';
import { useDashboard } from '@/contexts/DashboardContext';

export default function OverviewPage() {
  const { effectiveSelectedExchanges } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          Market Overview
        </h2>
        <span className="text-xs text-gray-500">Multi-exchange snapshot</span>
      </div>
      <MarketOverviewPanel selectedExchanges={effectiveSelectedExchanges} />
    </div>
  );
}
