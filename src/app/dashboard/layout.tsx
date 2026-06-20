'use client';

import React from 'react';
import AuthGuard from '@/components/AuthGuard';
import { DashboardProvider, useDashboard } from '@/contexts/DashboardContext';
import MenuBar from '@/components/dashboard-pages/MenuBar';
import { ExchangeSelector } from '@/components/dashboard-pages/dashboardHelpers';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { effectiveSelectedExchanges, handleSelectedExchangeChange } = useDashboard();
  
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans">
      <MenuBar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <ExchangeSelector
            selectedExchanges={effectiveSelectedExchanges}
            onSelectedExchangeChange={handleSelectedExchangeChange}
          />
        </div>
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardProvider>
        <DashboardContent>{children}</DashboardContent>
      </DashboardProvider>
    </AuthGuard>
  );
}
