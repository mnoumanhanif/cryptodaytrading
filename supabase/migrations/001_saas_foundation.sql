create table if not exists workspaces (
  id text primary key,
  name text,
  tier text not null default 'free',
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists subscriptions (
  workspace_id text not null references workspaces(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text primary key,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists portfolio_state (
  workspace_id text primary key references workspaces(id) on delete cascade,
  daily_realized_pnl_pct double precision not null default 0,
  open_position_count integer not null default 0,
  consecutive_losses integer not null default 0,
  trading_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists trade_journal (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  symbol text not null,
  signal text not null,
  entry_price double precision,
  stop_loss double precision,
  take_profit_1 double precision,
  take_profit_2 double precision,
  take_profit_3 double precision,
  score double precision,
  confidence double precision,
  regime text,
  net_rr double precision,
  cost_assumptions jsonb,
  rationale jsonb,
  indicators jsonb,
  created_at_ms bigint,
  outcome text,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_journal_workspace_created
  on trade_journal (workspace_id, created_at desc);

create index if not exists idx_audit_logs_workspace_created
  on audit_logs (workspace_id, created_at desc);
