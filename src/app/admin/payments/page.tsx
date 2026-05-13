'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AuthGuard from '@/components/AuthGuard';

type ApprovalRecord = {
  id: number;
  workspace_id: string;
  status: 'approved' | 'rejected';
  reason: string | null;
  reviewed_by_user_id: string;
  reviewed_at: string;
};

type BillingPayload = {
  workspaceId: string;
  billing: {
    tier: 'free' | 'pro';
    hasActiveSubscription: boolean;
    latestSubscriptionStatus: string | null;
  } | null;
  approvals: ApprovalRecord[];
};

export default function AdminPaymentsPage() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [reason, setReason] = useState('');
  const [data, setData] = useState<BillingPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = useCallback(async (targetWorkspaceId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const query = targetWorkspaceId ? `?workspaceId=${encodeURIComponent(targetWorkspaceId)}` : '';
      const response = await fetch(`/api/admin/payment-approvals${query}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? 'Failed to load payment approvals');
      setData(payload);
      setWorkspaceId((current) => current || payload.workspaceId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchApprovals();
  }, [fetchApprovals]);

  const selectedWorkspace = useMemo(() => workspaceId.trim() || data?.workspaceId || '', [workspaceId, data?.workspaceId]);

  const submitAction = async (action: 'approve' | 'reject') => {
    if (!selectedWorkspace) {
      setError('Workspace ID is required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/payment-approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          workspaceId: selectedWorkspace,
          reason: reason.trim() || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? 'Failed to process payment action');
      await fetchApprovals(selectedWorkspace);
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment action');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-950 p-6 text-white">
        <div className="mx-auto max-w-4xl space-y-6">
          <h1 className="text-2xl font-bold">Admin Payment Approvals</h1>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-4">
            <label className="block text-sm text-gray-300">
              Workspace ID
              <input
                value={workspaceId}
                onChange={(event) => setWorkspaceId(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                placeholder="ws_..."
              />
            </label>

            <label className="block text-sm text-gray-300">
              Reason (optional)
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-white"
                rows={3}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => void fetchApprovals(selectedWorkspace || undefined)}
                className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Refresh
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void submitAction('approve')}
                className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Approve Payment
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void submitAction('reject')}
                className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Reject Payment
              </button>
            </div>

            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
            <h2 className="text-lg font-semibold">Current Billing State</h2>
            <p className="text-sm text-gray-300">Tier: {data?.billing?.tier ?? 'unknown'}</p>
            <p className="text-sm text-gray-300">
              Active Subscription: {data?.billing?.hasActiveSubscription ? 'yes' : 'no'}
            </p>
            <p className="text-sm text-gray-300">
              Latest Subscription Status: {data?.billing?.latestSubscriptionStatus ?? 'n/a'}
            </p>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
            <h2 className="text-lg font-semibold">Manual Approval History</h2>
            <div className="space-y-2">
              {(data?.approvals ?? []).map((entry) => (
                <div key={entry.id} className="rounded border border-gray-800 bg-gray-950 p-3 text-sm text-gray-200">
                  <p>
                    <span className="font-semibold">{entry.status.toUpperCase()}</span> for <span className="font-mono">{entry.workspace_id}</span>
                  </p>
                  <p>Reviewed by: {entry.reviewed_by_user_id}</p>
                  <p>Reviewed at: {new Date(entry.reviewed_at).toLocaleString()}</p>
                  {entry.reason ? <p>Reason: {entry.reason}</p> : null}
                </div>
              ))}
              {data && data.approvals.length === 0 ? <p className="text-sm text-gray-400">No manual approvals yet.</p> : null}
            </div>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
