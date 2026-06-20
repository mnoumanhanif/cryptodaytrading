'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { useWatchList } from '@/hooks/useWatchList';
import { useCustomMarketPairs } from '@/hooks/useCustomMarketPairs';
import { filterCoins, SignalFilter, SortField, useCoinSearch } from '@/hooks/useCoinSearch';
import { usePortfolioNotifications } from '@/hooks/usePortfolioNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { SupportedExchange } from '@/lib/exchangeMarket';
import { CoinAnalysis } from '@/lib/types';
import {
  DEFAULT_EXCHANGE,
  EXCHANGE_LABELS,
  DashboardTab,
  PrimaryNavGroup,
  ALL_DASHBOARD_TABS,
  PRIMARY_NAV_GROUPS,
  CandlePattern,
  PatternCoinMatches,
  PatternStatus,
  PatternPriority,
  PatternTimeframe,
  PatternBiasFilter,
  SuggestionBias,
  SuggestionTemplate,
  TradeSuggestion,
  NewsRiskItem,
  LiquidationHeatItem,
  WhaleActivityItem,
  QuickSignalBias,
  SignalStrength,
  TradeConfidenceBand,
  QuickSignalItem,
  PatternDecisionCard,
  getSignalStrength,
  getConfidenceBand,
  pressureLabel,
  signalLabelFromImbalance,
  pressureColorFromImbalance,
  liquidationVisualBar,
  matchesPattern,
  buildPatternCoinMatches,
  fetchBinancePatternMatches,
  CANDLE_PATTERNS,
  LONG_SUGGESTION_TEMPLATES,
  SHORT_SUGGESTION_TEMPLATES,
  PATTERN_BASE_WIN_PROBABILITY,
  PATTERN_DEFAULT_TIMEFRAME,
  DEFAULT_LONG_STOP_LOSS_FACTOR,
  DEFAULT_LONG_TARGET_FACTOR,
  DEFAULT_SHORT_BASE_MOVE_FACTOR,
  DEFAULT_SHORT_TARGET_MULTIPLIER,
  MIN_NOTIFICATION_MOVE_PERCENT,
  MAX_WATCHLIST_NOTIFICATIONS,
  VOLUME_RATIO_TO_CONFIDENCE_FACTOR,
  SENTIMENT_PRICE_CHANGE_WEIGHT,
  SENTIMENT_VOLUME_RATIO_WEIGHT,
  NEWS_IMPACT_PRICE_WEIGHT,
  NEWS_IMPACT_VOLUME_WEIGHT,
  NEWS_IMPACT_SENTIMENT_WEIGHT,
  SMART_WATCHLIST_VOLATILITY_WEIGHT,
  SMART_WATCHLIST_LIQUIDITY_WEIGHT,
  SMART_WATCHLIST_SENTIMENT_WEIGHT,
  LIQUIDATION_PRESSURE_HIGH_MULTIPLIER,
  LIQUIDATION_PRESSURE_LOW_MULTIPLIER,
  LIQUIDATION_INTENSITY_VOLUME_WEIGHT,
  LIQUIDATION_INTENSITY_VOLATILITY_WEIGHT,
  SMART_WATCHLIST_VOLATILITY_MULTIPLIER,
  SMART_WATCHLIST_LIQUIDITY_MULTIPLIER,
  LIQUIDATION_SIGNAL_THRESHOLD,
  HIGH_VOLUME_RATIO_THRESHOLD,
  HIGH_LIQUIDATION_INTENSITY_THRESHOLD,
  MAX_GENERATED_NOTIFICATIONS_PER_UPDATE,
  LIQUIDATION_CONFIDENCE_IMBALANCE_WEIGHT,
  LIQUIDATION_CONFIDENCE_INTENSITY_WEIGHT,
  MIN_PATTERN_WIN_PROBABILITY,
  MAX_PATTERN_WIN_PROBABILITY,
  PATTERN_BASE_WEIGHT,
  PATTERN_CONFIDENCE_WEIGHT,
  PATTERN_BULLISH_STOP_LOSS_FACTOR,
  PATTERN_BEARISH_STOP_LOSS_FACTOR,
  PATTERN_BULLISH_TAKE_PROFIT_FACTOR,
  PATTERN_BEARISH_TAKE_PROFIT_FACTOR,
  PATTERN_RSI_OVERBOUGHT_THRESHOLD,
  PATTERN_RSI_OVERSOLD_THRESHOLD,
  PATTERN_VOLUME_SPIKE_THRESHOLD,
  PATTERN_STRUCTURE_STRENGTH_THRESHOLD,
  SCANNER_PAGE_SIZE,
  DEFAULT_TOTAL_SCANNED,
} from '@/components/dashboard-pages/dashboardHelpers';

import { MIN_CONFIDENCE_THRESHOLD, MIN_RR_FIRST_TRADE, TRENDING_MARKET_REGIME } from '@/lib/tradeDecisionConfig';

export interface DashboardContextType {
  // Auth
  user: any;
  signOut: () => Promise<void>;

  // Market Hooks
  coins: CoinAnalysis[];
  loading: boolean;
  error: string | null;
  hasUnauthorizedError: boolean;
  lastUpdated: number;
  totalScanned: number;
  refetch: (customSymbols?: string[], forceRefresh?: boolean) => Promise<void>;

  // Watchlist Hooks
  items: any[];
  addCoin: (coin: CoinAnalysis) => void;
  removeCoin: (symbol: string) => void;
  isWatching: (symbol: string) => boolean;

  // Custom Pair Hooks
  customMarketPairs: ReturnType<typeof useCustomMarketPairs>;
  addMarketPairOpen: boolean;
  setAddMarketPairOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Exchange selection
  selectedExchanges: SupportedExchange[];
  setSelectedExchanges: React.Dispatch<React.SetStateAction<SupportedExchange[]>>;
  effectiveSelectedExchanges: SupportedExchange[];
  selectedExchangeLabels: string;
  handleSelectedExchangeChange: (exchange: SupportedExchange) => void;

  // Scanner filter & paginations
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  signalFilter: SignalFilter;
  setSignalFilter: React.Dispatch<React.SetStateAction<SignalFilter>>;
  sortBy: SortField;
  setSortBy: React.Dispatch<React.SetStateAction<SortField>>;
  scannerPage: number;
  setScannerPage: React.Dispatch<React.SetStateAction<number>>;
  scannerTotalPages: number;
  scannerCoins: CoinAnalysis[];
  displayCoins: CoinAnalysis[];
  localFilteredCoins: CoinAnalysis[];
  handleApiSearch: (searchQuery: string) => Promise<void>;
  apiSearchResults: CoinAnalysis[];
  apiSearching: boolean;
  apiSearchError: string | null;

  // Volume & Whales
  volumeSurgeCoins: CoinAnalysis[];
  whaleActivity: WhaleActivityItem[];

  // Liquidations
  liquidationTimeframe: '5m' | '15m' | '1h';
  setLiquidationTimeframe: React.Dispatch<React.SetStateAction<'5m' | '15m' | '1h'>>;
  liquidationMinImbalance: number;
  setLiquidationMinImbalance: React.Dispatch<React.SetStateAction<number>>;
  liquidationHighOnly: boolean;
  setLiquidationHighOnly: React.Dispatch<React.SetStateAction<boolean>>;
  liquidationHeatmap: LiquidationHeatItem[];
  liquidationIntelRows: any[];

  // News Warnings
  warningCoinFilter: 'all' | string;
  setWarningCoinFilter: React.Dispatch<React.SetStateAction<'all' | string>>;
  warningCoinOptions: string[];
  warningNews: NewsRiskItem[];

  // Smart Watchlist
  smartWatchlist: any[];

  // Patterns
  patternCoinMatches: PatternCoinMatches;
  patternMatchesLoading: boolean;
  patternMatchesError: string | null;
  setPatternCoinMatches: React.Dispatch<React.SetStateAction<PatternCoinMatches>>;
  patternBiasFilter: PatternBiasFilter;
  setPatternBiasFilter: React.Dispatch<React.SetStateAction<PatternBiasFilter>>;
  patternMinConfidence: number;
  setPatternMinConfidence: React.Dispatch<React.SetStateAction<number>>;
  patternTimeframeFilter: 'all' | PatternTimeframe;
  setPatternTimeframeFilter: React.Dispatch<React.SetStateAction<'all' | PatternTimeframe>>;
  patternConfirmedOnly: boolean;
  setPatternConfirmedOnly: React.Dispatch<React.SetStateAction<boolean>>;
  patternLearningMode: boolean;
  setPatternLearningMode: React.Dispatch<React.SetStateAction<boolean>>;
  patternCoinFilter: 'all' | string;
  setPatternCoinFilter: React.Dispatch<React.SetStateAction<'all' | string>>;
  patternDecisionCards: PatternDecisionCard[];
  filteredPatternCards: PatternDecisionCard[];
  patternOverviewStats: any;

  // Suggestion Memos
  suggestionData: { longSuggestions: TradeSuggestion[]; shortSuggestions: TradeSuggestion[] };

  // Notifications
  notifications: any[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  watchlistMoveNotifications: any[];
  notifySymbols: Record<string, boolean>;
  toggleNotify: (symbol: string) => void;

  // Standalone summary counts
  buyCount: number;
  sellCount: number;
  holdCount: number;
  trackedCustomSymbols: string[];
  handleAddMarketPair: (coin: CoinAnalysis, targets: { scanner: boolean; watchlist: boolean; signals: boolean }) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  
  const [selectedExchanges, setSelectedExchanges] = useState<SupportedExchange[]>([DEFAULT_EXCHANGE]);
  const effectiveSelectedExchanges = useMemo(
    () => (selectedExchanges.length > 0 ? [selectedExchanges[0]] : [DEFAULT_EXCHANGE]),
    [selectedExchanges]
  );
  
  const customMarketPairs = useCustomMarketPairs();
  const [addMarketPairOpen, setAddMarketPairOpen] = useState(false);

  const trackedCustomSymbols = useMemo(
    () => Array.from(new Set([...customMarketPairs.scannerSymbols, ...customMarketPairs.signalsSymbols])),
    [customMarketPairs.scannerSymbols, customMarketPairs.signalsSymbols]
  );

  const { coins, loading, error, hasUnauthorizedError, lastUpdated, totalScanned, refetch } = useMarketData(
    effectiveSelectedExchanges,
    { disabled: false }
  );

  const { items, addCoin, removeCoin, isWatching } = useWatchList();
  
  const { searchResults: apiSearchResults, searching: apiSearching, searchError: apiSearchError, searchCoins } = useCoinSearch();

  // State definitions from Dashboard.tsx
  const [query, setQuery] = useState('');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('score');
  const [scannerPage, setScannerPage] = useState(1);
  const [liquidationTimeframe, setLiquidationTimeframe] = useState<'5m' | '15m' | '1h'>('15m');
  const [liquidationMinImbalance, setLiquidationMinImbalance] = useState(0.3);
  const [liquidationHighOnly, setLiquidationHighOnly] = useState(false);
  const [patternCoinMatches, setPatternCoinMatches] = useState<PatternCoinMatches>(() => buildPatternCoinMatches(coins));
  const [patternMatchesLoading, setPatternMatchesLoading] = useState(false);
  const [patternMatchesError, setPatternMatchesError] = useState<string | null>(null);
  const [patternBiasFilter, setPatternBiasFilter] = useState<PatternBiasFilter>('all');
  const [patternMinConfidence, setPatternMinConfidence] = useState(70);
  const [patternTimeframeFilter, setPatternTimeframeFilter] = useState<'all' | PatternTimeframe>('all');
  const [patternConfirmedOnly, setPatternConfirmedOnly] = useState(true);
  const [patternLearningMode, setPatternLearningMode] = useState(false);
  const [patternCoinFilter, setPatternCoinFilter] = useState<'all' | string>('all');
  const [warningCoinFilter, setWarningCoinFilter] = useState<'all' | string>('all');
  const [notifySymbols, setNotifySymbols] = useState<Record<string, boolean>>({});

  const portfolioSignalStateRef = useRef<Record<string, { bias: QuickSignalBias; confidence: number }>>({});
  const portfolioRiskStateRef = useRef<Record<string, boolean>>({});
  const portfolioSqueezeStateRef = useRef<Record<string, string>>({});
  const { notifications, unreadCount, pushNotifications, markAsRead, markAllAsRead } = usePortfolioNotifications();

  const selectedExchangeLabels = effectiveSelectedExchanges
    .map((exchange) => EXCHANGE_LABELS[exchange])
    .join(', ');

  const handleSelectedExchangeChange = useCallback(
    (exchange: SupportedExchange) => {
      setSelectedExchanges([exchange]);
    },
    [setSelectedExchanges]
  );

  const handleAddMarketPair = useCallback(
    (coin: CoinAnalysis, targets: { scanner: boolean; watchlist: boolean; signals: boolean }) => {
      const alreadyTracked = customMarketPairs.hasPair(coin.symbol);
      customMarketPairs.addPair(coin.symbol, targets);
      if (targets.watchlist) {
        addCoin(coin);
      }

      if (!alreadyTracked && (targets.scanner || targets.signals)) {
        const requestSymbols = Array.from(
          new Set([
            ...trackedCustomSymbols,
            ...[coin.symbol],
          ])
        );
        void refetch(requestSymbols);
      }
    },
    [addCoin, customMarketPairs, refetch, trackedCustomSymbols]
  );

  useEffect(() => {
    void refetch(trackedCustomSymbols);
  }, [refetch, trackedCustomSymbols]);

  const suggestionData = useMemo(() => {
    const ranked = [...coins].sort((a, b) => b.score - a.score);
    const longCandidates = ranked.filter((coin) => coin.signal !== 'SELL');
    const shortCandidates = ranked.filter((coin) => coin.signal !== 'BUY');
    const fallbackPool = ranked.length > 0 ? ranked : [];

    const longSuggestions: TradeSuggestion[] = LONG_SUGGESTION_TEMPLATES.map((template, index) => {
      const coin = longCandidates[index] ?? fallbackPool[index % Math.max(fallbackPool.length, 1)];
      const entryPrice = coin?.price ?? 0;
      const defaultStopLoss = entryPrice > 0 ? entryPrice * DEFAULT_LONG_STOP_LOSS_FACTOR : 0;
      const defaultTargetPrice = entryPrice > 0 ? entryPrice * DEFAULT_LONG_TARGET_FACTOR : 0;
      const stopLoss =
        entryPrice > 0 && coin && coin.risk.stopLoss > 0 && coin.risk.stopLoss < entryPrice
          ? coin.risk.stopLoss
          : defaultStopLoss;
      const targetPrice =
        entryPrice > 0 && coin && coin.risk.targetPrice > entryPrice
          ? coin.risk.targetPrice
          : defaultTargetPrice;
      const risk = entryPrice > stopLoss ? entryPrice - stopLoss : 0;
      const reward = targetPrice > entryPrice ? targetPrice - entryPrice : 0;

      return {
        patternName: template.name,
        symbol: coin?.symbol ?? 'N/A',
        bias: 'LONG',
        entryPrice,
        stopLoss,
        targetPrice,
        riskRewardRatio: risk > 0 && reward > 0 ? reward / risk : 0,
        confidence: coin?.tradeSignal.confidence ?? 0,
        setup: template.setup,
        confirmation: template.confirmation,
        invalidation: template.invalidation,
        expectedProfitPercent: entryPrice > 0 && targetPrice >= entryPrice ? ((targetPrice - entryPrice) / entryPrice) * 100 : 0,
        expectedLossPercent: entryPrice > 0 && stopLoss > 0 ? ((entryPrice - stopLoss) / entryPrice) * 100 : 0,
      };
    });

    const shortSuggestions: TradeSuggestion[] = SHORT_SUGGESTION_TEMPLATES.map((template, index) => {
      const coin = shortCandidates[index] ?? fallbackPool[index % Math.max(fallbackPool.length, 1)];
      const entryPrice = coin?.price ?? 0;
      const baseMove = Math.max(
        entryPrice * DEFAULT_SHORT_BASE_MOVE_FACTOR,
        Math.abs((coin?.priceChangePercent ?? 0) / 100) * entryPrice
      );
      const stopLoss = entryPrice + baseMove;
      const targetPrice = Math.max(entryPrice - baseMove * DEFAULT_SHORT_TARGET_MULTIPLIER, 0);
      const risk = stopLoss > entryPrice ? stopLoss - entryPrice : 0;
      const reward = entryPrice > targetPrice ? entryPrice - targetPrice : 0;

      return {
        patternName: template.name,
        symbol: coin?.symbol ?? 'N/A',
        bias: 'SHORT',
        entryPrice,
        stopLoss,
        targetPrice,
        riskRewardRatio: risk > 0 && reward > 0 ? reward / risk : 0,
        confidence: coin?.tradeSignal.confidence ?? 0,
        setup: template.setup,
        confirmation: template.confirmation,
        invalidation: template.invalidation,
        expectedProfitPercent: entryPrice > 0 && targetPrice > 0 && targetPrice <= entryPrice ? ((entryPrice - targetPrice) / entryPrice) * 100 : 0,
        expectedLossPercent: entryPrice > 0 && stopLoss > 0 ? ((stopLoss - entryPrice) / entryPrice) * 100 : 0,
      };
    });

    return { longSuggestions, shortSuggestions };
  }, [coins]);

  const watchlistMoveNotifications = useMemo(() => {
    const alerts = items
      .map((item) => {
        const liveCoin = coins.find((coin) => coin.symbol === item.symbol);
        if (!liveCoin) return null;
        const movePercent = ((liveCoin.price - item.entryPrice) / item.entryPrice) * 100;
        const targetHit = liveCoin.price >= item.targetPrice;
        const stopHit = liveCoin.price <= item.stopLoss;

        if (!targetHit && !stopHit && Math.abs(movePercent) < MIN_NOTIFICATION_MOVE_PERCENT) return null;

        return {
          symbol: item.symbol,
          movePercent,
          livePrice: liveCoin.price,
          status: targetHit ? 'TARGET HIT' : stopHit ? 'STOP LOSS HIT' : movePercent > 0 ? 'UPTREND MOMENTUM' : 'DOWNTREND MOMENTUM',
          guidance: targetHit
            ? 'Target reached — keep entry fixed and close per plan.'
            : stopHit
            ? 'Stop loss breached — close position to protect capital.'
            : `Price moved ${movePercent.toFixed(2)}% from entry. Keep entry fixed until TP/SL trigger.`,
        };
      })
      .filter((alert): alert is NonNullable<typeof alert> => Boolean(alert))
      .sort((a, b) => Math.abs(b.movePercent) - Math.abs(a.movePercent))
      .slice(0, MAX_WATCHLIST_NOTIFICATIONS);

    return alerts;
  }, [items, coins]);

  const handleApiSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim()) {
        await searchCoins(searchQuery, effectiveSelectedExchanges);
      }
    },
    [searchCoins, effectiveSelectedExchanges]
  );

  const localFilteredCoins = useMemo(() => {
    return filterCoins(coins, query, signalFilter, sortBy);
  }, [coins, query, signalFilter, sortBy]);

  const displayCoins = useMemo(() => {
    if (!query.trim() || apiSearchResults.length === 0) {
      return localFilteredCoins;
    }
    const localSymbols = new Set(localFilteredCoins.map((c) => c.symbol));
    let apiCoinsFiltered = apiSearchResults.filter((c) => !localSymbols.has(c.symbol));
    if (signalFilter !== 'ALL') {
      apiCoinsFiltered = apiCoinsFiltered.filter((c) => c.signal === signalFilter);
    }
    return [...localFilteredCoins, ...apiCoinsFiltered];
  }, [localFilteredCoins, apiSearchResults, query, signalFilter]);

  const scannerTotalPages = useMemo(
    () => Math.max(1, Math.ceil(displayCoins.length / SCANNER_PAGE_SIZE)),
    [displayCoins.length]
  );

  const scannerCoins = useMemo(() => {
    const start = (scannerPage - 1) * SCANNER_PAGE_SIZE;
    return displayCoins.slice(start, start + SCANNER_PAGE_SIZE);
  }, [displayCoins, scannerPage]);

  useEffect(() => {
    setScannerPage(1);
  }, [query, signalFilter, sortBy, effectiveSelectedExchanges, coins.length]);

  useEffect(() => {
    if (scannerPage > scannerTotalPages) {
      setScannerPage(scannerTotalPages);
    }
  }, [scannerPage, scannerTotalPages]);

  const volumeSurgeCoins = useMemo(
    () =>
      [...coins]
        .filter((coin) => (coin.indicators.volume?.volumeRatio ?? 0) >= 1.8)
        .sort((a, b) => (b.indicators.volume?.volumeRatio ?? 0) - (a.indicators.volume?.volumeRatio ?? 0))
        .slice(0, 20),
    [coins]
  );

  const whaleActivity = useMemo<WhaleActivityItem[]>(
    () =>
      volumeSurgeCoins.slice(0, 10).map((coin) => {
        const estimatedUsd = (coin.indicators.volume?.currentVolume ?? 0) * coin.price;
        const confidence = Math.min(99, Math.round((coin.indicators.volume?.volumeRatio ?? 0) * VOLUME_RATIO_TO_CONFIDENCE_FACTOR));
        return {
          symbol: coin.symbol,
          side: coin.signal === 'SELL' ? 'SELL' : 'BUY',
          estimatedUsd,
          confidence,
        };
      }),
    [volumeSurgeCoins]
  );

  const warningCoinOptions = useMemo(
    () => [...new Set(coins.map((coin) => coin.symbol))].sort((a, b) => a.localeCompare(b)),
    [coins]
  );

  useEffect(() => {
    if (warningCoinFilter !== 'all' && !warningCoinOptions.includes(warningCoinFilter)) {
      setWarningCoinFilter('all');
    }
  }, [warningCoinFilter, warningCoinOptions]);

  useEffect(() => {
    if (patternCoinFilter !== 'all' && !warningCoinOptions.includes(patternCoinFilter)) {
      setPatternCoinFilter('all');
    }
  }, [patternCoinFilter, warningCoinOptions]);

  const warningNewsAll = useMemo<NewsRiskItem[]>(
    () =>
      [...coins]
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .map((coin, index) => {
          const sentimentScore = Math.max(-100, Math.min(100, Math.round((coin.signal === 'SELL' ? -1 : coin.signal === 'BUY' ? 1 : 0) * coin.score)));
          const twitterTrendScore = Math.min(
            100,
            Math.round(
              Math.abs(coin.priceChangePercent) * SENTIMENT_PRICE_CHANGE_WEIGHT +
                (coin.indicators.volume?.volumeRatio ?? 0) * SENTIMENT_VOLUME_RATIO_WEIGHT
            )
          );
          const newsImpactScore = Math.min(
            100,
            Math.round(
              Math.abs(coin.priceChangePercent) * NEWS_IMPACT_PRICE_WEIGHT +
                (coin.indicators.volume?.volumeRatio ?? 0) * NEWS_IMPACT_VOLUME_WEIGHT +
                Math.abs(sentimentScore) * NEWS_IMPACT_SENTIMENT_WEIGHT
            )
          );
          const sources: NewsRiskItem['source'][] = ['Crypto News', 'X (Twitter)', 'Market Wire'];
          const riskLevel: NewsRiskItem['riskLevel'] = sentimentScore <= -30 || newsImpactScore >= 80 ? 'High' : 'Medium';
          return {
            symbol: coin.symbol,
            source: sources[index % sources.length],
            headline:
              riskLevel === 'High'
                ? `${coin.symbol.replace('USDT', '')} flagged for fast move risk - protect capital with strict stops`
                : `${coin.symbol.replace('USDT', '')} attracting elevated attention - monitor confirmation before entry`,
            sentimentScore,
            twitterTrendScore,
            newsImpactScore,
            riskLevel,
          };
        }),
    [coins]
  );

  const warningNews = useMemo<NewsRiskItem[]>(
    () =>
      warningCoinFilter === 'all'
        ? warningNewsAll.slice(0, 12)
        : warningNewsAll.filter((item) => item.symbol === warningCoinFilter),
    [warningCoinFilter, warningNewsAll]
  );

  const liquidationHeatmap = useMemo<LiquidationHeatItem[]>(
    () =>
      [...coins]
        .slice(0, 60)
        .map((coin) => {
          const volumeRatio = coin.indicators.volume?.volumeRatio ?? 0;
          const volatility = Math.abs(coin.priceChangePercent);
          const longLiquidationPressureRaw = volatility * (coin.signal === 'SELL' ? LIQUIDATION_PRESSURE_HIGH_MULTIPLIER : LIQUIDATION_PRESSURE_LOW_MULTIPLIER);
          const shortLiquidationPressureRaw = volatility * (coin.signal === 'BUY' ? LIQUIDATION_PRESSURE_HIGH_MULTIPLIER : LIQUIDATION_PRESSURE_LOW_MULTIPLIER);
          const longLiquidationPressure = Math.max(0, Math.round(longLiquidationPressureRaw * 100) / 100);
          const shortLiquidationPressure = Math.max(0, Math.round(shortLiquidationPressureRaw * 100) / 100);
          const imbalance = Math.round((shortLiquidationPressure - longLiquidationPressure) * 100) / 100;
          const intensity = Math.min(
            100,
            Math.round((volumeRatio * LIQUIDATION_INTENSITY_VOLUME_WEIGHT + volatility * LIQUIDATION_INTENSITY_VOLATILITY_WEIGHT) * 100) / 100
          );
          return {
            symbol: coin.symbol,
            longLiquidationPressure,
            shortLiquidationPressure,
            imbalance,
            intensity,
          };
        })
        .sort((a, b) => b.intensity - a.intensity),
    [coins]
  );

  const quickTradeSignals = useMemo<QuickSignalItem[]>(() => {
    const scored = coins.map((coin) => {
      const rsi = coin.indicators.rsi.value;
      const volumeRatio = coin.indicators.volume?.volumeRatio ?? 0;
      const support = coin.indicators.fibonacci?.nearestSupport ?? coin.risk.stopLoss;
      const resistance = coin.indicators.fibonacci?.nearestResistance ?? coin.risk.targetPrice;
      const supportDistancePct = support > 0 ? Math.abs((coin.price - support) / support) * 100 : 100;
      const resistanceDistancePct = resistance > 0 ? Math.abs((resistance - coin.price) / resistance) * 100 : 100;
      const trendScore = coin.indicators.ma.trend === 'bullish' ? 100 : coin.indicators.ma.trend === 'bearish' ? 0 : 50;
      const bullishCandleProxy = coin.signal === 'BUY' ? 100 : coin.signal === 'HOLD' ? 45 : 20;
      const bearishCandleProxy = coin.signal === 'SELL' ? 100 : coin.signal === 'HOLD' ? 45 : 20;
      const volumeWeight = Math.min(100, volumeRatio * 50);
      const longRsiWeight = rsi < 30 ? 100 : rsi < 40 ? 70 : 25;
      const shortRsiWeight = rsi > 70 ? 100 : rsi > 60 ? 70 : 25;
      const longSupportDistanceWeight = supportDistancePct <= 1.2 ? 100 : supportDistancePct <= 2 ? 75 : 35;
      const shortResistanceWeight = resistanceDistancePct <= 1.2 ? 100 : resistanceDistancePct <= 2 ? 75 : 35;
      const longTrendWeight = trendScore;
      const shortTrendWeight = 100 - trendScore;

      const longScoreRaw = longRsiWeight * 0.32 + volumeWeight * 0.24 + longTrendWeight * 0.22 + longSupportDistanceWeight * 0.22;
      const shortScoreRaw = shortRsiWeight * 0.32 + volumeWeight * 0.24 + shortTrendWeight * 0.22 + shortResistanceWeight * 0.22;

      const longConfidence = Math.round(Math.min(99, longScoreRaw * (bullishCandleProxy >= 80 ? 1.06 : 0.98)));
      const shortConfidence = Math.round(Math.min(99, shortScoreRaw * (bearishCandleProxy >= 80 ? 1.06 : 0.98)));
      const bias: QuickSignalBias = longConfidence >= shortConfidence ? 'Long' : 'Short';
      const confidence = Math.max(longConfidence, shortConfidence);
      const signalStrength = getSignalStrength(confidence);
      const confidenceBand = getConfidenceBand(confidence);
      const entry = coin.price;
      const referenceEntry = coin.risk.entryPrice > 0 ? coin.risk.entryPrice : entry;
      const stopLoss = bias === 'Long'
        ? Math.min(entry * 0.985, coin.risk.stopLoss > 0 ? coin.risk.stopLoss : entry * 0.985)
        : Math.max(entry * 1.015, coin.risk.stopLoss > 0 ? coin.risk.stopLoss : entry * 1.015);
      const target = bias === 'Long'
        ? Math.max(entry * 1.03, coin.risk.targetPrice > 0 ? coin.risk.targetPrice : entry * 1.03)
        : Math.max(0, Math.min(entry * 0.97, coin.risk.targetPrice > 0 ? coin.risk.targetPrice : entry * 0.97));
      const riskAmount = bias === 'Long' ? entry - stopLoss : stopLoss - entry;
      const rewardAmount = bias === 'Long' ? target - entry : entry - target;
      const riskRewardRatio = riskAmount > 0 && rewardAmount > 0 ? rewardAmount / riskAmount : 0;

      return {
        symbol: coin.symbol,
        price: coin.price,
        bias,
        signalStrength,
        confidence,
        confidenceBand,
        entry,
        referenceEntry,
        stopLoss,
        target,
        volumeRatio,
        biggestMove: Math.abs(coin.priceChangePercent),
        riskRewardRatio,
        isVolumeHigh: volumeRatio >= HIGH_VOLUME_RATIO_THRESHOLD,
        marketRegime: coin.tradeSignal.market_regime,
        trend: coin.indicators.ma.trend,
        riskFlags: coin.tradeSignal.risk_flags ?? [],
      };
    });

    const filtered = scored.filter((item) => item.confidence >= 70);
    return filtered.sort((a, b) => b.confidence - a.confidence).slice(0, 30);
  }, [coins]);

  const patternDecisionCards = useMemo<PatternDecisionCard[]>(() => {
    const coinBySymbol = new Map(coins.map((coin) => [coin.symbol, coin]));

    return CANDLE_PATTERNS.map((pattern) => {
      const liveCoins = patternCoinMatches[pattern.name] ?? [];
      const rawSymbol = liveCoins[0] ? `${liveCoins[0]}USDT` : null;
      const leadCoin = rawSymbol ? coinBySymbol.get(rawSymbol) : undefined;
      const leadConfidence = Math.round(leadCoin?.tradeSignal.confidence ?? 58);
      const status: PatternStatus =
        leadConfidence >= 70 ? 'Confirmed' : leadConfidence >= 55 ? 'Forming' : 'Invalidated';
      const priority: PatternPriority =
        leadConfidence >= 80 ? 'High Opportunity' : leadConfidence >= 65 ? 'Medium' : 'Low Quality';
      const baseWin = PATTERN_BASE_WIN_PROBABILITY[pattern.name] ?? 70;
      const winProbability = Math.max(
        MIN_PATTERN_WIN_PROBABILITY,
        Math.min(
          MAX_PATTERN_WIN_PROBABILITY,
          Math.round(baseWin * PATTERN_BASE_WEIGHT + leadConfidence * PATTERN_CONFIDENCE_WEIGHT)
        )
      );
      const entry = leadCoin?.price ?? pattern.candles[pattern.candles.length - 1].close;
      const stopLoss = pattern.bias === 'Bearish' ? entry * PATTERN_BEARISH_STOP_LOSS_FACTOR : entry * PATTERN_BULLISH_STOP_LOSS_FACTOR;
      const takeProfit = pattern.bias === 'Bearish' ? entry * PATTERN_BEARISH_TAKE_PROFIT_FACTOR : entry * PATTERN_BULLISH_TAKE_PROFIT_FACTOR;
      const risk = Math.abs(entry - stopLoss);
      const reward = Math.abs(takeProfit - entry);
      const riskReward = risk > 0 ? reward / risk : 0;
      const trendContext =
        pattern.bias === 'Bullish'
          ? 'Downtrend → Reversal'
          : pattern.bias === 'Bearish'
          ? 'Uptrend → Reversal'
          : 'Range → Expansion setup';
      const volumeRatio = leadCoin?.indicators.volume?.volumeRatio ?? 1;
      const volumeContext = volumeRatio >= 1.8 ? 'Increasing (strong participation)' : volumeRatio >= 1.2 ? 'Stable to rising' : 'Weak participation';
      const locationContext =
        pattern.bias === 'Bullish'
          ? 'Support Zone'
          : pattern.bias === 'Bearish'
          ? 'Resistance Zone'
          : 'Key decision zone';
      const rsi = leadCoin?.indicators.rsi.value ?? 50;
      const confluence = [
        {
          label: pattern.bias === 'Bearish' ? 'RSI Overbought' : 'RSI Oversold',
          pass: pattern.bias === 'Bearish' ? rsi >= PATTERN_RSI_OVERBOUGHT_THRESHOLD : rsi <= PATTERN_RSI_OVERSOLD_THRESHOLD,
        },
        { label: 'Volume Spike', pass: volumeRatio >= PATTERN_VOLUME_SPIKE_THRESHOLD },
        { label: 'Structure Strength', pass: Math.abs(leadCoin?.priceChangePercent ?? 0) >= PATTERN_STRUCTURE_STRENGTH_THRESHOLD },
        {
          label: 'Trend Alignment',
          pass:
            pattern.bias === 'Reversal'
              ? leadCoin?.indicators.ma.trend !== 'neutral'
              : leadCoin?.indicators.ma.trend === (pattern.bias === 'Bearish' ? 'bearish' : 'bullish'),
        },
      ];
      const isBullishBias = pattern.bias === 'Bullish' || pattern.bias === 'Reversal';
      const actionLine =
        status === 'Confirmed'
          ? isBullishBias
            ? 'Wait for pullback → Enter LONG'
            : 'Wait for bounce into resistance → Enter SHORT'
          : status === 'Forming'
          ? 'Wait — confirmation candle required'
          : 'Avoid — weak confirmation';
      const liquidationInsight =
        isBullishBias
          ? 'Shorts getting liquidated → supports bullish move.'
          : 'Longs getting liquidated → supports bearish continuation.';
      const aiInsight =
        status === 'Confirmed'
          ? `Strong ${pattern.bias.toLowerCase()} structure with improving momentum and tradable risk profile.`
          : status === 'Forming'
          ? 'Setup is forming; let volume and close confirmation complete before entry.'
          : 'Pattern quality is weak right now; protect capital and wait for cleaner structure.';

      return {
        pattern,
        status,
        priority,
        timeframe: PATTERN_DEFAULT_TIMEFRAME[pattern.name] ?? '15m',
        confidence: leadConfidence,
        winProbability,
        trendContext,
        volumeContext,
        locationContext,
        confluence,
        entry,
        stopLoss,
        takeProfit,
        riskReward,
        liveCoins,
        aiInsight,
        liquidationInsight,
        actionLine,
      };
    });
  }, [coins, patternCoinMatches]);

  const filteredPatternCards = useMemo(() => {
    const selectedPatternBase = patternCoinFilter === 'all' ? null : patternCoinFilter.replace('USDT', '');
    return patternDecisionCards
      .filter((card) => (patternBiasFilter === 'all' ? true : card.pattern.bias === patternBiasFilter))
      .filter((card) => card.confidence >= patternMinConfidence)
      .filter((card) => (patternTimeframeFilter === 'all' ? true : card.timeframe === patternTimeframeFilter))
      .filter((card) => (!patternConfirmedOnly ? true : card.status === 'Confirmed'))
      .filter((card) => (selectedPatternBase ? card.liveCoins.includes(selectedPatternBase) : true))
      .sort((a, b) => b.winProbability - a.winProbability);
  }, [patternBiasFilter, patternCoinFilter, patternConfirmedOnly, patternDecisionCards, patternMinConfidence, patternTimeframeFilter]);

  const patternOverviewStats = useMemo(() => {
    const aggregate = patternDecisionCards.reduce(
      (acc, card) => {
        if (card.pattern.bias === 'Bullish') acc.bullish += 1;
        if (card.pattern.bias === 'Bearish') acc.bearish += 1;
        acc.totalRiskReward += card.riskReward;
        acc.totalWinProbability += card.winProbability;
        if (!acc.best || card.winProbability > acc.best.winProbability) acc.best = card;
        if (!acc.weakest || card.winProbability < acc.weakest.winProbability) acc.weakest = card;
        return acc;
      },
      {
        bullish: 0,
        bearish: 0,
        totalRiskReward: 0,
        totalWinProbability: 0,
        best: undefined as PatternDecisionCard | undefined,
        weakest: undefined as PatternDecisionCard | undefined,
      }
    );
    const avgRR = patternDecisionCards.length > 0 ? aggregate.totalRiskReward / patternDecisionCards.length : 0;
    const winRateLive = patternDecisionCards.length > 0 ? aggregate.totalWinProbability / patternDecisionCards.length : 0;
    const marketBias = aggregate.bullish >= aggregate.bearish ? 'Bullish' : 'Bearish';
    const marketQuality = winRateLive >= 75 ? 'HIGH' : winRateLive >= 65 ? 'MEDIUM' : 'LOW';

    return {
      bullish: aggregate.bullish,
      bearish: aggregate.bearish,
      activePatterns: patternDecisionCards.length,
      best: aggregate.best,
      weakest: aggregate.weakest,
      avgRR,
      winRateLive,
      marketBias,
      marketQuality,
    };
  }, [patternDecisionCards]);

  const liquidationIntelRows = useMemo(() => {
    const timeframeFactor = liquidationTimeframe === '5m' ? 0.85 : liquidationTimeframe === '1h' ? 1.15 : 1;
    return liquidationHeatmap
      .map((item) => {
        const normalizedImbalance = Math.round(item.imbalance * timeframeFactor * 100) / 100;
        const signal = signalLabelFromImbalance(normalizedImbalance);
        const pressure = normalizedImbalance > LIQUIDATION_SIGNAL_THRESHOLD
          ? 'Bullish'
          : normalizedImbalance < -LIQUIDATION_SIGNAL_THRESHOLD
          ? 'Bearish'
          : 'Neutral';
        const action = signal === 'LONG' ? 'Buy dip' : signal === 'SHORT' ? 'Sell rally' : 'Wait';
        const strength = getSignalStrength(Math.round(Math.min(99, Math.abs(normalizedImbalance) * 100)));
        const confidence = Math.round(
          Math.min(
            99,
            Math.abs(normalizedImbalance) * LIQUIDATION_CONFIDENCE_IMBALANCE_WEIGHT +
              item.intensity * LIQUIDATION_CONFIDENCE_INTENSITY_WEIGHT
          )
        );
        return {
          ...item,
          normalizedImbalance,
          signal,
          pressure,
          action,
          strength,
          confidence,
          trap: normalizedImbalance > LIQUIDATION_SIGNAL_THRESHOLD ? 'SHORTS' : normalizedImbalance < -LIQUIDATION_SIGNAL_THRESHOLD ? 'LONGS' : 'NONE',
          squeezeType:
            item.shortLiquidationPressure > item.longLiquidationPressure * 1.2
              ? 'Short Squeeze'
              : item.longLiquidationPressure > item.shortLiquidationPressure * 1.2
              ? 'Long Squeeze'
              : 'None',
        };
      })
      .filter((item) => Math.abs(item.normalizedImbalance) >= liquidationMinImbalance)
      .filter((item) => !liquidationHighOnly || item.intensity >= HIGH_LIQUIDATION_INTENSITY_THRESHOLD)
      .sort((a, b) => Math.abs(b.normalizedImbalance) - Math.abs(a.normalizedImbalance))
      .slice(0, 30);
  }, [liquidationHeatmap, liquidationHighOnly, liquidationMinImbalance, liquidationTimeframe]);

  const smartWatchlist = useMemo(
    () =>
      [...coins]
        .slice(0, 25)
        .map((coin) => {
          const volatilityScore = Math.min(100, Math.abs(coin.priceChangePercent) * SMART_WATCHLIST_VOLATILITY_MULTIPLIER);
          const liquidityScore = Math.min(100, (coin.indicators.volume?.volumeRatio ?? 0) * SMART_WATCHLIST_LIQUIDITY_MULTIPLIER);
          const sentimentProxy = Math.max(0, Math.min(100, coin.signal === 'SELL' ? 100 - coin.score : coin.score));
          const aiScore = Math.round(
            volatilityScore * SMART_WATCHLIST_VOLATILITY_WEIGHT +
              liquidityScore * SMART_WATCHLIST_LIQUIDITY_WEIGHT +
              sentimentProxy * SMART_WATCHLIST_SENTIMENT_WEIGHT
          );
          return {
            coin,
            aiScore,
            volatilityScore: Math.round(volatilityScore),
            liquidityScore: Math.round(liquidityScore),
            sentimentScore: Math.round(sentimentProxy),
          };
        })
        .sort((a, b) => b.aiScore - a.aiScore),
    [coins]
  );

  const toggleNotify = (symbol: string) => {
    setNotifySymbols((prev) => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  // Background pattern matches fetching (replaces tab dependency effect)
  useEffect(() => {
    let cancelled = false;
    setPatternMatchesLoading(true);
    setPatternMatchesError(null);
    fetchBinancePatternMatches()
      .then((matches) => {
        if (!cancelled) {
          setPatternCoinMatches(matches);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPatternMatchesError(err instanceof Error ? err.message : 'Failed to fetch Binance pattern matches');
          setPatternCoinMatches(buildPatternCoinMatches(coins));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPatternMatchesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [coins]);

  // Notifications logic
  useEffect(() => {
    const now = Date.now();
    const previousSignals = portfolioSignalStateRef.current;
    const previousRisks = portfolioRiskStateRef.current;
    const previousSqueezes = portfolioSqueezeStateRef.current;

    const nextSignals: Record<string, { bias: QuickSignalBias; confidence: number }> = {};
    const nextRisks: Record<string, boolean> = {};
    const nextSqueezes: Record<string, string> = {};
    const generated: any[] = [];

    for (const signal of quickTradeSignals) {
      const previous = previousSignals[signal.symbol];
      const signalType = signal.bias === 'Long' ? 'LONG' : 'SHORT';
      const confidence = signal.confidence;
      nextSignals[signal.symbol] = { bias: signal.bias, confidence };
      const isQualified = confidence > 75;
      if (!isQualified) continue;

      if (!previous) {
        generated.push({
          id: `${signal.symbol}-new-${now}`,
          symbol: signal.symbol,
          type: signalType,
          priority: confidence >= 85 ? 'HIGH' : 'MEDIUM',
          confidence,
          message: `${signal.bias} signal appeared with high confidence.`,
          reason: 'New signal detected and confidence is above 75%.',
          createdAt: now,
          read: false,
        });
        continue;
      }

      if (previous.bias !== signal.bias) {
        generated.push({
          id: `${signal.symbol}-flip-${now}`,
          symbol: signal.symbol,
          type: signalType,
          priority: 'HIGH',
          confidence,
          message: `Signal flipped from ${previous.bias} to ${signal.bias}.`,
          reason: 'Signal direction changed, indicating a potential trend reversal.',
          createdAt: now,
          read: false,
        });
      } else if (confidence > previous.confidence) {
        generated.push({
          id: `${signal.symbol}-confidence-${now}`,
          symbol: signal.symbol,
          type: signalType,
          priority: confidence >= 85 ? 'HIGH' : 'MEDIUM',
          confidence,
          message: `${signal.bias} confidence increased from ${previous.confidence}% to ${confidence}%.`,
          reason: 'Confidence increased versus previous update.',
          createdAt: now,
          read: false,
        });
      }
    }

    for (const coin of coins) {
      const extremeRisk = coin.indicators.rsi.value > 80 || coin.indicators.rsi.value < 20;
      nextRisks[coin.symbol] = extremeRisk;
      if (extremeRisk && !previousRisks[coin.symbol]) {
        generated.push({
          id: `${coin.symbol}-risk-${now}`,
          symbol: coin.symbol,
          type: 'RISK',
          priority: 'HIGH',
          confidence: Math.round(coin.tradeSignal.confidence),
          message: `RSI at ${coin.indicators.rsi.value.toFixed(1)} indicates extreme market condition.`,
          reason:
            coin.indicators.rsi.value > 80
              ? 'Overbought risk: possible reversal.'
              : 'Oversold risk: possible sharp counter move.',
          createdAt: now,
          read: false,
        });
      }
    }

    for (const card of liquidationIntelRows.slice(0, 15)) {
      if (card.squeezeType === 'None') continue;
      nextSqueezes[card.symbol] = card.squeezeType;
      if (previousSqueezes[card.symbol] !== card.squeezeType) {
        generated.push({
          id: `${card.symbol}-squeeze-${now}`,
          symbol: card.symbol,
          type: 'SQUEEZE',
          priority: card.confidence >= 80 ? 'HIGH' : 'MEDIUM',
          confidence: card.confidence,
          message: `${card.squeezeType} conditions detected (${card.pressure} pressure).`,
          reason:
            card.squeezeType === 'Short Squeeze'
              ? 'Short squeeze can force upside continuation.'
              : card.squeezeType === 'Long Squeeze'
              ? 'Long squeeze can force downside continuation.'
              : 'Squeeze pressure changed.',
          createdAt: now,
          read: false,
        });
      }
    }

    portfolioSignalStateRef.current = nextSignals;
    portfolioRiskStateRef.current = nextRisks;
    portfolioSqueezeStateRef.current = nextSqueezes;

    if (generated.length > 0) {
      pushNotifications(generated.slice(0, MAX_GENERATED_NOTIFICATIONS_PER_UPDATE));
    }
  }, [coins, liquidationIntelRows, pushNotifications, quickTradeSignals]);

  const { buyCount, sellCount, holdCount } = useMemo(() => {
    let buy = 0, sell = 0, hold = 0;
    for (const c of coins) {
      if (c.signal === 'BUY') buy++;
      else if (c.signal === 'SELL') sell++;
      else hold++;
    }
    return { buyCount: buy, sellCount: sell, holdCount: hold };
  }, [coins]);

  const value: DashboardContextType = {
    user,
    signOut,
    coins,
    loading,
    error,
    hasUnauthorizedError,
    lastUpdated,
    totalScanned,
    refetch,
    items,
    addCoin,
    removeCoin,
    isWatching,
    customMarketPairs,
    addMarketPairOpen,
    setAddMarketPairOpen,
    selectedExchanges,
    setSelectedExchanges,
    effectiveSelectedExchanges,
    selectedExchangeLabels,
    handleSelectedExchangeChange,
    query,
    setQuery,
    signalFilter,
    setSignalFilter,
    sortBy,
    setSortBy,
    scannerPage,
    setScannerPage,
    scannerTotalPages,
    scannerCoins,
    displayCoins,
    localFilteredCoins,
    handleApiSearch,
    apiSearchResults,
    apiSearching,
    apiSearchError,
    volumeSurgeCoins,
    whaleActivity,
    liquidationTimeframe,
    setLiquidationTimeframe,
    liquidationMinImbalance,
    setLiquidationMinImbalance,
    liquidationHighOnly,
    setLiquidationHighOnly,
    liquidationHeatmap,
    liquidationIntelRows,
    warningCoinFilter,
    setWarningCoinFilter,
    warningCoinOptions,
    warningNews,
    smartWatchlist,
    patternCoinMatches,
    patternMatchesLoading,
    patternMatchesError,
    setPatternCoinMatches,
    patternBiasFilter,
    setPatternBiasFilter,
    patternMinConfidence,
    setPatternMinConfidence,
    patternTimeframeFilter,
    setPatternTimeframeFilter,
    patternConfirmedOnly,
    setPatternConfirmedOnly,
    patternLearningMode,
    setPatternLearningMode,
    patternCoinFilter,
    setPatternCoinFilter,
    patternDecisionCards,
    filteredPatternCards,
    patternOverviewStats,
    suggestionData,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    watchlistMoveNotifications,
    notifySymbols,
    toggleNotify,
    buyCount,
    sellCount,
    holdCount,
    trackedCustomSymbols,
    handleAddMarketPair,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
