-- duckcode.waitlist schema for controlled access onboarding
-- Creates a waitlist table with plan selection and agent interest, plus admin approval flow

-- Ensure schema exists
create schema if not exists duckcode;

-- Enumerated types for plan and interests
create type duckcode.plan_choice as enum ('own_api_key', 'free_50_pro');
create type duckcode.agent_interest as enum ('data_architect', 'data_developer', 'data_troubleshooter', 'platform_dba', 'all');

-- Waitlist table
create table if not exists duckcode.waitlist (
  id           bigserial primary key,
  email        text not null,
  full_name    text,
  plan_choice  duckcode.plan_choice not null default 'own_api_key',
  agent_interests duckcode.agent_interest[] not null default array['all']::duckcode.agent_interest[],
  source       text, -- e.g., 'web' | 'ide'
  metadata     jsonb not null default '{}'::jsonb,
  status       text not null default 'pending', -- pending | approved | rejected
  notes        text,
  approved_at  timestamptz,
  approved_by  uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint waitlist_unique_email unique(email)
);

-- Indexes
create index if not exists idx_waitlist_status on duckcode.waitlist(status);
create index if not exists idx_waitlist_created_at on duckcode.waitlist(created_at);

-- Row Level Security
alter table duckcode.waitlist enable row level security;

-- Allow anonymous and authenticated to insert (for direct client-side submissions if needed)
-- Note: CREATE POLICY does not support IF NOT EXISTS; drop first to be idempotent
drop policy if exists waitlist_insert_public on duckcode.waitlist;
create policy waitlist_insert_public on duckcode.waitlist
  for insert
  to anon, authenticated
  with check (true);

-- Grants: allow roles to access schema/table/sequence as needed
-- Schema usage for PostgREST roles
grant usage on schema duckcode to anon, authenticated, service_role;

-- Table privileges
grant select, insert on table duckcode.waitlist to anon, authenticated;
grant select, insert, update, delete on table duckcode.waitlist to service_role;

-- Sequence privileges for bigserial id generation
do $$
begin
  if exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'S' and n.nspname = 'duckcode' and c.relname = 'waitlist_id_seq'
  ) then
    execute 'grant usage, select on sequence duckcode.waitlist_id_seq to anon, authenticated, service_role';
  end if;
end $$;

-- Helper function to maintain updated_at
create or replace function duckcode.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to update updated_at on change
create or replace trigger trg_waitlist_set_updated_at
before update on duckcode.waitlist
for each row execute function duckcode.set_updated_at();
