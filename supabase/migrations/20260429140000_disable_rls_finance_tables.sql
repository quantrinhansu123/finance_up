-- Disable RLS for finance tables
-- NOTE:
-- The frontend app uses custom login (localStorage/sessionStorage) rather than Supabase Auth JWT.
-- Existing RLS policies for `to authenticated` can block reads/writes and cause ERROR_NOT_LOGGED_IN / empty data.

-- Drop existing policies (if any) to avoid confusion
drop policy if exists "finance_projects_select" on public.finance_projects;

drop policy if exists "finance_tx_select" on public.finance_transactions;
drop policy if exists "finance_tx_insert" on public.finance_transactions;
drop policy if exists "finance_tx_update" on public.finance_transactions;

-- Disable RLS
alter table public.finance_projects disable row level security;
alter table public.finance_transactions disable row level security;

