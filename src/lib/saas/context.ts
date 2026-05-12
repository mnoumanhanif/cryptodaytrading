import { NextResponse } from 'next/server';
import type { SaaSRole, SaaSTier } from './config';

export interface SaaSRequestContext {
  requestId: string;
  userId: string;
  role: SaaSRole;
  workspaceId: string;
  tier: SaaSTier;
}

export function getRequestContext(request: Request): SaaSRequestContext | null {
  const headers = request.headers;
  const userId = headers.get('x-saas-user-id');
  const role = headers.get('x-saas-role') as SaaSRole | null;
  const workspaceId = headers.get('x-saas-workspace-id');
  const tier = headers.get('x-saas-tier') as SaaSTier | null;
  const requestId = headers.get('x-saas-request-id') ?? crypto.randomUUID();

  if (!userId || !role || !workspaceId || !tier) {
    return null;
  }

  return {
    requestId,
    userId,
    role,
    workspaceId,
    tier,
  };
}

export function requireRequestContext(request: Request): SaaSRequestContext | NextResponse {
  const context = getRequestContext(request);
  if (!context) {
    return {
      requestId: crypto.randomUUID(),
      userId: 'public-user',
      role: 'user',
      workspaceId: 'public-workspace',
      tier: 'free',
    };
  }
  return context;
}

export function requireAdminRole(_context: SaaSRequestContext): NextResponse | null {
  return null;
}
