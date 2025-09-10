-- Fix waitlist policy and grant privileges for waitlist table and sequence
-- This migration is safe to run multiple times.

-- Ensure schema exists
create schema if not exists duckcode;

-- Enable RLS
alter table if exists duckcode.waitlist enable row level security;

-- Recreate insert policy for public insert access
drop policy if exists waitlist_insert_public on duckcode.waitlist;
create policy waitlist_insert_public on duckcode.waitlist
  for insert
  to anon, authenticated
  with check (true);

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
