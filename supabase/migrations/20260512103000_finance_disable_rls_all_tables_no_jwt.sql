-- App đăng nhập qua bảng employees + storage, không bắt buộc JWT Supabase.
-- Anon key phải đọc/ghi được các bảng finance: tắt RLS (idempotent).

do $$
declare
  t text;
  tables text[] := array[
    'finance_projects',
    'finance_transactions',
    'finance_accounts',
    'finance_project_members',
    'finance_project_sub_categories',
    'finance_master_categories',
    'finance_master_sub_categories',
    'finance_funds',
    'finance_beneficiaries',
    'finance_fixed_costs',
    'finance_monthly_revenues',
    'finance_activity_logs',
    'finance_audit_logs',
    'budget_requests'
  ];
begin
  foreach t in array tables
  loop
    if exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      execute format('alter table public.%I disable row level security', t);
    end if;
  end loop;
end $$;

-- Gỡ policy cũ nếu từng bật lại RLS (tránh nhầm lẫn)
drop policy if exists "finance_projects_select" on public.finance_projects;
drop policy if exists "finance_tx_select" on public.finance_transactions;
drop policy if exists "finance_tx_insert" on public.finance_transactions;
drop policy if exists "finance_tx_update" on public.finance_transactions;
