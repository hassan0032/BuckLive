-- Add sharable columns to communities
alter table if exists public.communities
  add column if not exists is_sharable boolean not null default false;

alter table if exists public.communities
  add column if not exists sharable_token text;


