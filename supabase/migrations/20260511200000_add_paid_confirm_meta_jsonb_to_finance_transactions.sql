-- Một cột jsonb: ngày giờ + tên người xác nhận "Đã thu" (phiên thu nhập)
-- Cấu trúc: { "at": "<ISO8601>", "byName": "<tên đăng nhập / hiển thị>" }
do $$
begin
  if to_regclass('public.finance_transactions') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'finance_transactions'
        and column_name = 'paid_confirm_meta'
    ) then
      alter table public.finance_transactions
        add column paid_confirm_meta jsonb;
      comment on column public.finance_transactions.paid_confirm_meta is
        'Xác nhận Đã thu: { at, byName }';
    end if;
  end if;
end $$;
