-- Đăng nhập dùng bảng employees; FK cũ trỏ profiles gây lỗi 400 khi tạo giao dịch.
do $$
begin
  if to_regclass('public.employees') is null or to_regclass('public.finance_transactions') is null then
    raise notice 'Skip finance_transactions user FK migration: missing employees or finance_transactions';
    return;
  end if;

  alter table public.finance_transactions
    drop constraint if exists finance_transactions_created_by_fkey,
    drop constraint if exists finance_transactions_owner_user_id_fkey,
    drop constraint if exists finance_transactions_approved_by_fkey,
    drop constraint if exists finance_transactions_rejected_by_fkey,
    drop constraint if exists finance_transactions_paid_by_fkey,
    drop constraint if exists finance_transactions_confirmed_by_fkey;

  alter table public.finance_transactions
    add constraint finance_transactions_created_by_fkey
      foreign key (created_by) references public.employees (id) on delete restrict,
    add constraint finance_transactions_owner_user_id_fkey
      foreign key (owner_user_id) references public.employees (id) on delete restrict;

  -- Cột duyệt/thanh toán: tùy chọn, không bắt buộc map profiles
  alter table public.finance_transactions
    add constraint finance_transactions_approved_by_fkey
      foreign key (approved_by) references public.employees (id) on delete set null,
    add constraint finance_transactions_rejected_by_fkey
      foreign key (rejected_by) references public.employees (id) on delete set null,
    add constraint finance_transactions_paid_by_fkey
      foreign key (paid_by) references public.employees (id) on delete set null,
    add constraint finance_transactions_confirmed_by_fkey
      foreign key (confirmed_by) references public.employees (id) on delete set null;
exception
  when others then
    raise notice 'finance_transactions user FK migration: %', sqlerrm;
end
$$;
