'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useDashboard } from '@/contexts/DashboardContext';

export default function MenuBar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    signOut,
    loading,
    refetch,
    trackedCustomSymbols,
    buyCount,
    sellCount,
    holdCount,
  } = useDashboard();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setActiveDropdown((prev) => (prev === name ? null : name));
  };

  const handleRefresh = async () => {
    await refetch(trackedCustomSymbols, true);
  };

  // Helper to determine if a route is active
  const isRouteActive = (route: string) => pathname === route;
  
  // Helper to check if any child of a dropdown is active
  const isDropdownActive = (routes: string[]) => routes.some(route => pathname === route);

  const navigationItems = [
    {
      id: 'markets',
      label: 'Markets',
      routes: ['/dashboard/scanner', '/dashboard/suggestions'],
      items: [
        { label: '🔍 Market Scanner', href: '/dashboard/scanner', desc: 'Scan top pairs with live indicator feeds' },
        { label: '💡 Trade Suggestions', href: '/dashboard/suggestions', desc: 'AI-generated setup entry & targets' },
      ],
    },
    {
      id: 'intelligence',
      label: 'Intelligence',
      routes: ['/dashboard/liquidations', '/dashboard/liquidationintel', '/dashboard/volumewhales'],
      items: [
        { label: '💣 Liquidation Cascades', href: '/dashboard/liquidations', desc: 'Real-time leverage cascades and imbalances' },
        { label: '🧠 Liquidation Intel', href: '/dashboard/liquidationintel', desc: 'Multi-coin squeeze and trap metrics' },
        { label: '🐳 Volume & Whales', href: '/dashboard/volumewhales', desc: 'Spot smart money activity and volume surges' },
      ],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      routes: ['/dashboard/patterns', '/dashboard/warnings'],
      items: [
        { label: '📊 Candlestick Patterns', href: '/dashboard/patterns', desc: 'Automated pattern confirmation feeds' },
        { label: '⚠️ Risk Warnings', href: '/dashboard/warnings', desc: 'Social trend and sentiment proxy scores' },
      ],
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      routes: ['/dashboard/watchlist'],
      items: [
        { label: '💼 Watchlist', href: '/dashboard/watchlist', desc: 'Tracked custom pairs and live target hits' },
      ],
    },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-950/85 backdrop-blur-md">
      <div ref={menuRef} className="max-w-7xl mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold shadow-md shadow-cyan-500/20">
                C
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse border border-gray-950" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent group-hover:from-white group-hover:to-white transition-all duration-300">
                  CryptoScanner
                </span>
                <span className="text-[10px] text-gray-500 font-medium -mt-1 tracking-wider uppercase">
                  Technical Core
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Items */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link
                href="/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isRouteActive('/dashboard')
                    ? 'text-cyan-400 bg-cyan-950/20 font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
                }`}
              >
                Overview
              </Link>

              {navigationItems.map((group) => {
                const isOpen = activeDropdown === group.id;
                const isActive = isDropdownActive(group.routes);
                return (
                  <div key={group.id} className="relative">
                    <button
                      onClick={() => toggleDropdown(group.id)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer select-none ${
                        isActive
                          ? 'text-cyan-400 font-semibold bg-cyan-950/10'
                          : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
                      }`}
                    >
                      <span>{group.label}</span>
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyan-400' : 'text-gray-500'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                      <div className="absolute left-0 mt-2 w-72 rounded-xl border border-gray-800 bg-gray-900/95 p-2 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setActiveDropdown(null)}
                            className={`flex flex-col p-2.5 rounded-lg transition-colors ${
                              isRouteActive(item.href)
                                ? 'bg-cyan-950/30 text-cyan-400'
                                : 'text-gray-300 hover:bg-gray-800/60 hover:text-white'
                            }`}
                          >
                            <span className="text-xs font-semibold">{item.label}</span>
                            <span className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{item.desc}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Right Header Stats & Actions */}
          <div className="hidden md:flex items-center gap-4">
            
            {/* Live Stats */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-gray-800/80 bg-gray-900/30 text-[11px] font-medium tracking-wide">
              <span className="text-gray-500 font-mono text-[9px] uppercase tracking-wider mr-1">Regime Stats</span>
              <span className="text-emerald-400 flex items-center gap-1">
                {buyCount} <span className="text-[10px] text-gray-500">BUY</span>
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-yellow-400 flex items-center gap-1">
                {holdCount} <span className="text-[10px] text-gray-500">HOLD</span>
              </span>
              <span className="text-gray-600">•</span>
              <span className="text-rose-400 flex items-center gap-1">
                {sellCount} <span className="text-[10px] text-gray-500">SELL</span>
              </span>
            </div>

            {/* Page Buttons */}
            <div className="flex gap-2">
              <Link
                href="/decisions"
                className="px-2.5 py-1.5 rounded-lg border border-cyan-800/50 bg-cyan-950/20 text-cyan-300 hover:bg-cyan-950/40 text-xs font-medium transition-all duration-200 hover:border-cyan-600/70"
                title="AI Decisions Engine"
              >
                AI Decisions
              </Link>
              <Link
                href="/opportunities"
                className="px-2.5 py-1.5 rounded-lg border border-emerald-800/50 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/40 text-xs font-medium transition-all duration-200 hover:border-emerald-600/70"
                title="High Conviction Opportunities"
              >
                High Opportunity
              </Link>
            </div>

            {/* Refresh Controls */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-800 bg-gray-900/60 hover:bg-gray-800 hover:text-cyan-400 transition-colors disabled:opacity-40 cursor-pointer"
              title="Refresh Market Scanner Feed"
            >
              <svg
                className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin text-cyan-400' : 'hover:text-cyan-400'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Profile pill */}
            {user && (
              <div className="flex items-center gap-2.5 pl-2 border-l border-gray-800">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-medium text-gray-300 truncate max-w-[110px]" title={user.email}>
                    {user.email.split('@')[0]}
                  </span>
                  <span className="text-[9px] text-cyan-500 font-semibold uppercase tracking-widest leading-none mt-0.5">
                    Pro Trader
                  </span>
                </div>
                <button
                  onClick={() => void signOut()}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-800 bg-gray-900/60 text-gray-400 hover:bg-red-950/20 hover:text-red-300 hover:border-red-900/50 text-xs font-medium transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            )}

          </div>

          {/* Mobile hamburger menu */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-1.5 rounded bg-gray-900 border border-gray-800 text-gray-400"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded bg-gray-900 border border-gray-800 text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-800 bg-gray-950 p-4 space-y-4 animate-in slide-in-from-top-4 duration-200">
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-lg border text-center ${isRouteActive('/dashboard') ? 'border-cyan-600 bg-cyan-950/20 text-cyan-400' : 'border-gray-800 text-gray-300'}`}
            >
              Overview
            </Link>
            <Link
              href="/dashboard/scanner"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-lg border text-center ${isRouteActive('/dashboard/scanner') ? 'border-cyan-600 bg-cyan-950/20 text-cyan-400' : 'border-gray-800 text-gray-300'}`}
            >
              Scanner
            </Link>
            <Link
              href="/dashboard/suggestions"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-lg border text-center ${isRouteActive('/dashboard/suggestions') ? 'border-cyan-600 bg-cyan-950/20 text-cyan-400' : 'border-gray-800 text-gray-300'}`}
            >
              Suggestions
            </Link>
            <Link
              href="/dashboard/watchlist"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-lg border text-center ${isRouteActive('/dashboard/watchlist') ? 'border-cyan-600 bg-cyan-950/20 text-cyan-400' : 'border-gray-800 text-gray-300'}`}
            >
              Watchlist
            </Link>
          </div>

          <div className="border-t border-gray-900 pt-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-2">Market Signals</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link href="/dashboard/liquidations" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white">💣 Liquidations</Link>
              <Link href="/dashboard/liquidationintel" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white">🧠 Liquidation Intel</Link>
              <Link href="/dashboard/volumewhales" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white">🐳 Volume & Whales</Link>
              <Link href="/dashboard/patterns" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white">📊 Patterns</Link>
              <Link href="/dashboard/warnings" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white">⚠️ Risk Warnings</Link>
            </div>
          </div>

          <div className="border-t border-gray-900 pt-3 flex items-center justify-between gap-4">
            <Link href="/decisions" className="flex-1 text-center py-2 rounded-lg border border-cyan-800/40 text-cyan-300 bg-cyan-950/10 text-xs">AI Decisions</Link>
            <Link href="/opportunities" className="flex-1 text-center py-2 rounded-lg border border-emerald-800/40 text-emerald-300 bg-emerald-950/10 text-xs">Opportunities</Link>
          </div>

          {user && (
            <div className="border-t border-gray-900 pt-3 flex items-center justify-between text-xs">
              <span className="text-gray-400 truncate max-w-[180px]">{user.email}</span>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  void signOut();
                }}
                className="px-3 py-1.5 rounded-lg border border-gray-800 text-gray-300 bg-gray-900/60"
              >
                Sign Out
              </button>
            </div>
          )}
          
        </div>
      )}
    </header>
  );
}
