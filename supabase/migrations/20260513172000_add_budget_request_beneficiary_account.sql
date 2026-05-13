do $$
begin
  if to_regclass('public.finance_transactions') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'finance_transactions'
        and column_name = 'beneficiary_account_id'
    ) then
      alter table public.finance_transactions
        add column beneficiary_account_id uuid references public.finance_accounts (id) on delete set null;
    end if;

    create index if not exists idx_finance_transactions_beneficiary_account
      on public.finance_transactions (beneficiary_account_id)
      where beneficiary_account_id is not null;

    comment on column public.finance_transactions.beneficiary_account_id is
      'Tai khoan noi bo nhan tien trong luong xin ngan sach / nap quy.';
  end if;
end $$;
