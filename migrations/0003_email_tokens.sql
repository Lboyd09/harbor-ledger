-- One-time links for password reset and email confirmation.
-- Tokens are stored as sha256 hashes. The raw token only travels in the email.

create table if not exists email_tokens (
  token_hash text primary key,
  user_id    text not null,
  email      text not null,
  purpose    text not null,
  expires_at timestamptz not null,
  used_at    timestamptz
);

create index if not exists email_tokens_user_idx on email_tokens (user_id);
