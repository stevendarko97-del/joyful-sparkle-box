-- Add verification_codes table for 6-digit email codes
create table if not exists public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code varchar(6) not null,
  type text not null check (type in ('signup', 'reset_password')),
  payload jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used boolean not null default false
);

create index if not exists verification_codes_email_type_idx on public.verification_codes (email, type);
create index if not exists verification_codes_expires_at_idx on public.verification_codes (expires_at);
