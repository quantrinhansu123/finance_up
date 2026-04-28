-- Idempotent creation of all enum types used in the schema
-- Safe to run multiple times

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'staff', 'teacher', 'student');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'position') then
    create type public.position as enum (
      'Nhân viên', 'Trưởng nhóm', 'Phó phòng', 'Trưởng phòng',
      'Phó giám đốc', 'Giám đốc'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'finance_role') then
    create type public.finance_role as enum (
      'ADMIN', 'ACCOUNTANT', 'TREASURER', 'MANAGER', 'STAFF', 'NONE'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'course_level') then
    create type public.course_level as enum ('beginner', 'intermediate', 'advanced');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present', 'late', 'absent', 'half-day');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'permission_action') then
    create type public.permission_action as enum (
      'view_dashboard', 'view_users', 'manage_users', 'view_courses', 'manage_courses',
      'view_departments', 'manage_departments', 'view_salary', 'manage_salary',
      'view_own_department', 'manage_own_department'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'currency') then
    create type public.currency as enum (
      'VND', 'USD', 'KHR', 'TRY', 'MMK', 'THB', 'LAK', 'MYR', 'IDR', 'PHP', 'SGD'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum ('IN', 'OUT');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    create type public.transaction_status as enum (
      'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'COMPLETED'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_type') then
    create type public.account_type as enum ('BANK', 'CASH', 'E-WALLET');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('ACTIVE', 'COMPLETED', 'PAUSED');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_role') then
    create type public.project_role as enum ('OWNER', 'MANAGER', 'MEMBER', 'VIEWER');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'master_category_type') then
    create type public.master_category_type as enum ('INCOME', 'EXPENSE');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'fixed_cost_cycle') then
    create type public.fixed_cost_cycle as enum ('MONTHLY', 'QUARTERLY', 'YEARLY');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'fixed_cost_status') then
    create type public.fixed_cost_status as enum ('ON', 'OFF');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'expense_category') then
    create type public.expense_category as enum (
      'Lương nhân sự', 'Thuê văn phòng', 'Cước vận chuyển', 'Marketing/Ads',
      'Vận hành', 'SIM', 'Thuế', 'Chi phí cố định', 'Khác'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_type') then
    create type public.payment_type as enum ('FULL', 'PARTIAL');
  end if;
end
$$;

