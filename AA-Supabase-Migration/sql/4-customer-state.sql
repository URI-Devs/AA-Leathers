-- AA LEATHERS - CUSTOMER STATE MIGRATION
-- Run once after 1-schema.sql to sync authenticated carts and wishlists.

create table if not exists public.customer_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cart jsonb not null default '[]',
  wishlist jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.customer_state enable row level security;

drop policy if exists customer_state_select_own on public.customer_state;
drop policy if exists customer_state_insert_own on public.customer_state;
drop policy if exists customer_state_update_own on public.customer_state;

create policy customer_state_select_own on public.customer_state
  for select using (user_id = auth.uid());
create policy customer_state_insert_own on public.customer_state
  for insert with check (user_id = auth.uid());
create policy customer_state_update_own on public.customer_state
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
