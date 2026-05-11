-- Tên người duyệt hiển thị (không phụ thuộc FK profiles) — đồng bộ với phiên employees đăng nhập
do $$
begin
  if to_regclass('public.finance_transactions') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'finance_transactions'
        and column_name = 'approver_display_name'
    ) then
      alter table public.finance_transactions
        add column approver_display_name text;
      comment on column public.finance_transactions.approver_display_name is
        'Tên hiển thị người duyệt (từ session), bổ sung cho approved_by khi không map được profiles';
    end if;
  end if;
end $$;
