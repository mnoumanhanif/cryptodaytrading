import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { ADMIN_ONLY_RULES, AUTH_EXCLUDED_PATHS, SCANNER_PATHS, TIER_LIMITS, type SaaSRole, type SaaSTier } from '@/lib/saas/config';
import { enforceApiRateLimit, enforceScannerRateLimit } from '@/lib/saas/rateLimit';

const jwks = process.env.CLERK_JWKS_URL ? createRemoteJWKSet(new URL(process.env.CLERK_JWKS_URL)) : null;
const clerkIssuer = process.env.CLERK_ISSUER;
const clerkAudience = process.env.CLERK_AUDIENCE;

type AuthResult = {
  userId: string;
  role: SaaSRole;
  workspaceId: string;
  tier: SaaSTier;
};

function parseRole(payload: JWTPayload): SaaSRole {
  const role = String(payload.role ?? payload.org_role ?? payload['https://example.com/role'] ?? 'user').toLowerCase();
  return role.includes('admin') ? 'admin' : 'user';
}

function parseTier(payload: JWTPayload): SaaSTier {
  const tier = String(payload.tier ?? payload.plan ?? payload['https://example.com/tier'] ?? 'free').toLowerCase();
  return tier === 'pro' ? 'pro' : 'free';
}

function parseWorkspaceId(payload: JWTPayload, userId: string): string {
  const workspace = payload.org_id ?? payload.workspace_id ?? payload['https://example.com/workspace_id'];
  if (workspace && String(workspace).trim()) {
    return String(workspace);
  }
  return `ws_${userId}`;
}

function parseToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }

  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) return apiKeyHeader.trim();
  return null;
}

async function authenticate(request: NextRequest): Promise<AuthResult | null> {
  const token = parseToken(request);
  if (!token) return null;

  if (process.env.SAAS_SERVICE_API_KEY && token === process.env.SAAS_SERVICE_API_KEY) {
    return {
      userId: 'service-account',
      role: 'admin',
      workspaceId: 'service-workspace',
      tier: 'pro',
    };
  }

  if (!jwks) return null;
  if (!clerkIssuer || !clerkAudience) return null;

  const verifyResult = await jwtVerify(token, jwks, {
    issuer: clerkIssuer,
    audience: clerkAudience,
  });

  const payload = verifyResult.payload;
  const userId = String(payload.sub ?? '').trim();
  if (!userId) return null;

  return {
    userId,
    role: parseRole(payload),
    workspaceId: parseWorkspaceId(payload, userId),
    tier: parseTier(payload),
  };
}

function isAdminRoute(pathname: string, method: string): boolean {
  return ADMIN_ONLY_RULES.some((rule) => pathname === rule.path && method.toUpperCase() === rule.method);
}

function exceedsSymbolLimit(pathname: string, request: NextRequest, tier: SaaSTier): boolean {
  const limits = TIER_LIMITS[tier];
  const url = new URL(request.url);

  const scanLike = pathname === '/api/scanner' || pathname === '/api/coins/search' || pathname === '/api/market-analysis/top-500';
  if (scanLike) {
    const limitParam = Number(url.searchParams.get('limit') ?? '0');
    if (Number.isFinite(limitParam) && limitParam > limits.maxSymbolsPerRequest) {
      return true;
    }
  }

  if (pathname === '/api/coins/top') {
    const totalParam = Number(url.searchParams.get('total') ?? '0');
    if (Number.isFinite(totalParam) && totalParam > limits.maxSymbolsPerRequest) {
      return true;
    }
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (AUTH_EXCLUDED_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const auth = await authenticate(request).catch(() => null);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized: missing or invalid token' }, { status: 401 });
  }

  if (isAdminRoute(pathname, request.method) && auth.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }

  if (exceedsSymbolLimit(pathname, request, auth.tier)) {
    return NextResponse.json(
      { error: `Tier limit exceeded: max symbols per request is ${TIER_LIMITS[auth.tier].maxSymbolsPerRequest}` },
      { status: 403 }
    );
  }

  const apiRate = await enforceApiRateLimit(auth.workspaceId, auth.tier);
  if (!apiRate.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded: ${apiRate.limit} requests/min for ${auth.tier} tier` },
      { status: 429 }
    );
  }

  if (SCANNER_PATHS.has(pathname)) {
    const scannerRate = await enforceScannerRateLimit(auth.workspaceId, auth.tier);
    if (!scannerRate.allowed) {
      return NextResponse.json(
        { error: `Scanner quota exceeded: ${scannerRate.limit} requests/day for ${auth.tier} tier` },
        { status: 429 }
      );
    }
  }

  const forwardedHeaders = new Headers(request.headers);
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();

  forwardedHeaders.set('x-saas-user-id', auth.userId);
  forwardedHeaders.set('x-saas-role', auth.role);
  forwardedHeaders.set('x-saas-workspace-id', auth.workspaceId);
  forwardedHeaders.set('x-saas-tier', auth.tier);
  forwardedHeaders.set('x-saas-request-id', requestId);

  return NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*'],
};
