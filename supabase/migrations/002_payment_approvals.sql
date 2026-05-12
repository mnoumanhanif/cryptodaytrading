create table if not exists payment_approvals (
  id bigserial primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  status text not null check (status in ('approved', 'rejected')),
  reason text,
  reviewed_by_user_id text not null,
  reviewed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payment_approvals_workspace_created
  on payment_approvals (workspace_id, created_at desc);
