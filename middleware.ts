import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { type SaaSRole, type SaaSTier } from '@/lib/saas/config';

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

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const auth = (await authenticate(request).catch(() => null)) ?? {
    userId: 'public-user',
    role: 'user' as const,
    workspaceId: 'public-workspace',
    tier: 'free' as const,
  };

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
