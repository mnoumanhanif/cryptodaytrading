'use client';

import Link from 'next/link';
import { useState } from 'react';

// ─── Feature definitions ─────────────────────────────────────
const NAV_GROUPS = [
  {
    id: 'markets',
    label: 'Markets',
    icon: '📊',
    color: 'from-blue-500 to-cyan-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/10',
    tabs: [
      {
        name: 'Top 500',
        desc: 'Track the top 500 crypto pairs by volume, price change and market rank in real time.',
      },
      {
        name: 'Heatmap',
        desc: 'Visualise the entire market at a glance — colour-coded by momentum and volatility.',
      },
      {
        name: 'Scanner',
        desc: 'Auto-scan every USDT pair across Binance, Bybit and Bitget for 10–25% gain setups.',
      },
    ],
  },
  {
    id: 'signals',
    label: 'Signals',
    icon: '⚡',
    color: 'from-yellow-500 to-amber-400',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/10',
    tabs: [
      {
        name: 'Quick Signals',
        desc: 'Instant BUY / SELL / HOLD signals with entry, stop-loss and target prices.',
      },
      {
        name: 'Trade Suggestions',
        desc: 'AI-generated long/short setups scored by confidence, risk-reward ratio and pattern strength.',
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    icon: '🧠',
    color: 'from-purple-500 to-violet-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/10',
    tabs: [
      {
        name: 'Liquidations',
        desc: 'Real-time liquidation cascade detection — know when leverage is about to unwind.',
      },
      {
        name: 'Liquidation Intel',
        desc: 'Deep-dive heatmaps and imbalance scores to predict the next high-conviction move.',
      },
      {
        name: 'Volume Whales',
        desc: 'Spot abnormal volume spikes and whale accumulation before the crowd reacts.',
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: '🔬',
    color: 'from-emerald-500 to-teal-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/10',
    tabs: [
      {
        name: 'Patterns',
        desc: 'Automated candlestick pattern recognition across 5m, 15m and 1h timeframes.',
      },
      {
        name: 'Risk Warnings',
        desc: 'News sentiment and Twitter trend alerts scored for market risk before you trade.',
      },
    ],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: '💼',
    color: 'from-rose-500 to-pink-400',
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/10',
    tabs: [
      {
        name: 'Watchlist',
        desc: 'Build a personal watchlist with live price alerts and portfolio-level notifications.',
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI Tools',
    icon: '🤖',
    color: 'from-sky-500 to-indigo-400',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/10',
    tabs: [
      {
        name: 'AI Decision Board',
        desc: 'GPT-powered trade decision engine that weighs all signals and outputs a clear action plan.',
        href: '/decisions',
      },
      {
        name: 'High Opportunity Board',
        desc: 'Curated list of the highest-conviction setups right now — filtered by edge score.',
        href: '/opportunities',
      },
    ],
  },
];

const STATS = [
  { value: '500+', label: 'Pairs Scanned' },
  { value: '3', label: 'Exchanges' },
  { value: '12+', label: 'Dashboard Tabs' },
  { value: '24/7', label: 'Live Data' },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: '/ month',
    highlight: false,
    cta: 'Get Started Free',
    href: '/login',
    features: [
      '60 API requests / min',
      '50 scanner scans / day',
      'Up to 100 symbols per scan',
      'All dashboard tabs',
      'Live signal marquee',
      'Basic watchlist',
    ],
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/ month',
    highlight: true,
    cta: 'Start Pro Trial',
    href: '/login',
    badge: 'Most Popular',
    features: [
      '600 API requests / min',
      '1,000 scanner scans / day',
      'Up to 500 symbols per scan',
      'AI Decision Board',
      'High Opportunity Board',
      'Liquidation Intel',
      'Volume Whale tracker',
      'Priority support',
    ],
  },
];

const FAQS = [
  {
    q: 'Which exchanges are supported?',
    a: 'CryptoScanner connects to Binance, Bybit and Bitget. You can switch between exchanges with a single click on the dashboard.',
  },
  {
    q: 'Do I need an API key to start?',
    a: 'No. The platform works out of the box using public market data endpoints. Your own API keys are only required for private order management features.',
  },
  {
    q: 'What does the AI Decision Board do?',
    a: 'It aggregates signals from every tab — patterns, liquidations, volume, news sentiment — and outputs a single high-confidence trade action with entry, stop-loss and target.',
  },
  {
    q: 'How real-time is the data?',
    a: 'Market data refreshes every few seconds using exchange WebSocket feeds. Scanner results update every minute automatically.',
  },
  {
    q: 'Can I cancel my Pro plan at any time?',
    a: 'Yes. Pro is billed monthly with no lock-in. Cancel any time from your account settings.',
  },
];

// ─── Sub-components ───────────────────────────────────────────
function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">₿</span>
          <span className="text-lg font-bold text-white">
            Crypto<span className="text-cyan-400">Scanner</span>
          </span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-gray-400 md:flex">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:border-cyan-500 hover:text-white transition-colors"
          >
            Log In
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-cyan-500 px-4 py-1.5 text-sm font-semibold text-gray-950 hover:bg-cyan-400 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 text-center">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[600px] w-[800px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-0">
        <div className="h-[300px] w-[600px] rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-sm text-cyan-400">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          Live market data across 500+ pairs
        </div>

        <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
          The All-in-One{' '}
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Crypto Day Trading
          </span>{' '}
          Platform
        </h1>

        <p className="mt-6 text-lg text-gray-400 sm:text-xl">
          Auto-scan every USDT pair, detect high-confidence setups, track liquidations and whale moves —
          all in a single real-time dashboard powered by AI.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-cyan-500 px-8 py-3 text-base font-bold text-gray-950 shadow-lg shadow-cyan-500/30 hover:bg-cyan-400 transition-colors"
          >
            Get Started Free →
          </Link>
          <a
            href="#features"
            className="rounded-xl border border-gray-700 px-8 py-3 text-base font-semibold text-gray-300 hover:border-cyan-500 hover:text-white transition-colors"
          >
            Explore Features
          </a>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              <p className="text-2xl font-extrabold text-white">{s.value}</p>
              <p className="mt-1 text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const [active, setActive] = useState(NAV_GROUPS[0].id);
  const group = NAV_GROUPS.find((g) => g.id === active)!;

  return (
    <section id="features" className="py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Every Tool a Day Trader Needs
          </h2>
          <p className="mt-3 text-gray-400">
            Twelve specialised tabs across six categories — all in one place.
          </p>
        </div>

        {/* Category nav */}
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          {NAV_GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => setActive(g.id)}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold border transition-all ${
                active === g.id
                  ? `border-transparent bg-gradient-to-r ${g.color} text-gray-950`
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
            >
              <span>{g.icon}</span>
              {g.label}
            </button>
          ))}
        </div>

        {/* Tab cards */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {group.tabs.map((tab) => (
            <div
              key={tab.name}
              className={`rounded-2xl border ${group.border} ${group.bg} p-6 transition-transform hover:-translate-y-1`}
            >
              <div className={`mb-3 inline-block rounded-lg bg-gradient-to-br ${group.color} px-3 py-1 text-xs font-bold text-gray-950`}>
                {group.label}
              </div>
              <h3 className="text-lg font-bold text-white">{tab.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{tab.desc}</p>
              {'href' in tab && tab.href ? (
                <Link
                  href={tab.href}
                  className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold bg-gradient-to-r ${group.color} bg-clip-text text-transparent hover:opacity-80`}
                >
                  Open tab →
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className={`mt-4 inline-flex items-center gap-1 text-sm font-semibold bg-gradient-to-r ${group.color} bg-clip-text text-transparent hover:opacity-80`}
                >
                  Open tab →
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Connect your exchange',
      desc: 'Choose Binance, Bybit or Bitget. No API key needed to start — public data works instantly.',
    },
    {
      num: '02',
      title: 'Scan the market',
      desc: 'The scanner analyses all USDT pairs and surfaces coins with 10–25% gain potential in one click.',
    },
    {
      num: '03',
      title: 'Review signals & patterns',
      desc: 'Check Quick Signals and Pattern tabs for high-confidence entries with clear stop-loss and target levels.',
    },
    {
      num: '04',
      title: 'Execute with confidence',
      desc: 'Use the AI Decision Board to get a single, consensus trade action before you place your order.',
    },
  ];

  return (
    <section className="py-20 bg-gray-900/40">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">How It Works</h2>
          <p className="mt-3 text-gray-400">From market open to trade execution in four steps.</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.num} className="relative rounded-2xl border border-gray-800 bg-gray-900 p-6">
              {i < steps.length - 1 && (
                <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 text-gray-700 lg:block text-2xl">→</div>
              )}
              <span className="text-4xl font-extrabold text-gray-800">{s.num}</span>
              <h3 className="mt-2 text-base font-bold text-white">{s.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Simple, Transparent Pricing</h2>
          <p className="mt-3 text-gray-400">Start free. Upgrade when you need more power.</p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 transition-transform hover:-translate-y-1 ${
                plan.highlight
                  ? 'border-cyan-500 bg-gray-900 shadow-xl shadow-cyan-500/10'
                  : 'border-gray-800 bg-gray-900/60'
              }`}
            >
              {'badge' in plan && plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-500 px-4 py-0.5 text-xs font-bold text-gray-950">
                  {plan.badge}
                </div>
              )}
              <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              <div className="mt-3 flex items-end gap-1">
                <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                <span className="mb-1 text-gray-400">{plan.period}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-0.5 text-cyan-400">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`mt-8 block w-full rounded-xl py-3 text-center text-sm font-bold transition-colors ${
                  plan.highlight
                    ? 'bg-cyan-500 text-gray-950 hover:bg-cyan-400'
                    : 'border border-gray-700 text-gray-300 hover:border-cyan-500 hover:text-white'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 bg-gray-900/40">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((item, i) => (
            <div key={i} className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
              <button
                className="flex w-full items-center justify-between p-5 text-left"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="font-semibold text-white">{item.q}</span>
                <span className="ml-4 text-gray-400 text-lg">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBanner() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-4xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-gray-900 to-gray-950 p-12 text-center shadow-xl shadow-cyan-500/10">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-96 w-96 rounded-full bg-cyan-500/10 blur-[80px]" />
          </div>
          <h2 className="relative text-3xl font-extrabold text-white sm:text-4xl">
            Ready to trade smarter?
          </h2>
          <p className="relative mt-4 text-lg text-gray-400">
            Join traders worldwide using CryptoScanner to find high-confidence setups every day.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-xl bg-cyan-500 px-10 py-3 text-base font-bold text-gray-950 shadow-lg shadow-cyan-500/30 hover:bg-cyan-400 transition-colors"
            >
              Get Started — It&apos;s Free
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-gray-500 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="text-xl">₿</span>
          <span className="font-bold text-white">
            Crypto<span className="text-cyan-400">Scanner</span>
          </span>
          <span className="ml-2">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex gap-6">
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <Link href="/decisions" className="hover:text-white transition-colors">AI Decisions</Link>
          <Link href="/opportunities" className="hover:text-white transition-colors">Opportunities</Link>
        </div>
      </div>
    </footer>
  );
}

// ─── Main export ─────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main>
        <Hero />
        <FeaturesSection />
        <HowItWorks />
        <PricingSection />
        <FaqSection />
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
}
