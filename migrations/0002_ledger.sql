-- Harbor Ledger per-user snapshot + password-recovery codes.
-- user_id is TEXT (Better Auth ids / preview 'dev-user').

create table if not exists ledgers (
  user_id    text primary key,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists ledger_recovery (
  email      text primary key,
  user_id    text not null,
  code_hash  text not null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_recovery_user_idx on ledger_recovery (user_id);
