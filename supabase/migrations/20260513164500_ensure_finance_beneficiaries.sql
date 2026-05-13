-- Danh sách đơn vị thụ hưởng (Xin ngân sách / Beneficiaries)
do $$
begin
  if to_regclass('public.finance_beneficiaries') is null then
    create table public.finance_beneficiaries (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      platforms text[] not null default '{}',
      bank_accounts jsonb not null default '[]',
      description text,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'finance_beneficiaries_updated_at') then
    create trigger finance_beneficiaries_updated_at
      before update on public.finance_beneficiaries
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.finance_beneficiaries disable row level security;
