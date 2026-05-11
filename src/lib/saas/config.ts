export type SaaSRole = 'admin' | 'user';
export type SaaSTier = 'free' | 'pro';

export type TierLimits = {
  apiRequestsPerMinute: number;
  scannerRequestsPerDay: number;
  maxSymbolsPerRequest: number;
};

export const TIER_LIMITS: Record<SaaSTier, TierLimits> = {
  free: {
    apiRequestsPerMinute: 60,
    scannerRequestsPerDay: 50,
    maxSymbolsPerRequest: 100,
  },
  pro: {
    apiRequestsPerMinute: 600,
    scannerRequestsPerDay: 1000,
    maxSymbolsPerRequest: 500,
  },
};

export const ADMIN_ONLY_RULES: Array<{ path: string; method: string }> = [
  { path: '/api/portfolio-risk', method: 'POST' },
];

export const AUTH_EXCLUDED_PATHS = new Set<string>(['/api/stripe/webhook']);

export const SCANNER_PATHS = new Set<string>([
  '/api/scanner',
  '/api/market-analysis/top-500',
]);
