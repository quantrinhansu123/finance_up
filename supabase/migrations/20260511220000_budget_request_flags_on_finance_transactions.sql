-- Xin ngân sách vs phiếu chi sinh sau khi admin duyệt
do $$
begin
  if to_regclass('public.finance_transactions') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'finance_transactions' and column_name = 'is_budget_request'
    ) then
      alter table public.finance_transactions add column is_budget_request boolean not null default false;
    end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'finance_transactions' and column_name = 'budget_request_source_id'
    ) then
      alter table public.finance_transactions
        add column budget_request_source_id uuid references public.finance_transactions (id) on delete set null;
      create index if not exists idx_finance_transactions_budget_source
        on public.finance_transactions (budget_request_source_id)
        where budget_request_source_id is not null;
    end if;
    comment on column public.finance_transactions.is_budget_request is 'true = yêu cầu trong mục Xin ngân sách (chưa là phiếu chi kế toán)';
    comment on column public.finance_transactions.budget_request_source_id is 'Phiếu chi được tạo từ yêu cầu xin ngân sách (id giao dịch gốc)';
  end if;
end $$;
