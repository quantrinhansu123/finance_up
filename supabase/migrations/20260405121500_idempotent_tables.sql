-- Idempotent creation of tables, triggers, and indexes (safe to re-run)
-- Assumes enums already exist (see 20260405121000_idempotent_enums.sql)

-- Utility updated_at trigger function is expected to exist from original schema
-- If missing, uncomment below:
-- create or replace function public.set_updated_at()
-- returns trigger
-- language plpgsql
-- as $$
-- begin
--   new.updated_at = now();
--   return new;
-- end;
-- $$;

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  role public.user_role not null default 'student',
  position public.position,
  department_id uuid,
  monthly_salary numeric,
  total_learning_hours numeric,
  approved boolean not null default false,
  photo_url text,
  date_of_birth date,
  address text,
  country text,
  phone_number text,
  work_location text,
  employment_status text,
  employment_start_date date,
  employment_marital_status text,
  employment_branch text,
  employment_team text,
  employment_salary_percentage numeric,
  employment_active boolean,
  employment jsonb,
  finance_role public.finance_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_department_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_department_id_fkey
      foreign key (department_id) references public.departments (id) on delete set null;
  end if;
end
$$;

-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_updated_at') then
    create trigger profiles_updated_at
      before update on public.profiles
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- departments
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  manager_id uuid references public.profiles (id) on delete set null,
  manager_name text,
  permissions public.permission_action[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'departments_updated_at') then
    create trigger departments_updated_at
      before update on public.departments
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- roles
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  permissions public.permission_action[] not null default '{}',
  department_id uuid references public.departments (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'roles_updated_at') then
    create trigger roles_updated_at
      before update on public.roles
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- user_permissions
create table if not exists public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  custom_permissions public.permission_action[] default '{}',
  primary key (user_id, role_id)
);

-- company_settings
create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  allowed_ips text[] not null default '{}',
  work_start_time text not null,
  work_end_time text not null,
  late_threshold_minutes integer not null default 15,
  working_days_per_month integer not null default 26,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'company_settings_updated_at') then
    create trigger company_settings_updated_at
      before update on public.company_settings
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  teacher_id uuid not null references public.profiles (id) on delete restrict,
  teacher_name text not null default '',
  category text not null default '',
  level public.course_level not null default 'beginner',
  duration numeric not null default 0,
  price numeric not null default 0,
  thumbnail text not null default '',
  banner text,
  demo_video_id text,
  department_id uuid references public.departments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'courses_updated_at') then
    create trigger courses_updated_at
      before update on public.courses
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- course_students
create table if not exists public.course_students (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pending boolean not null default false,
  enrolled_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

-- lessons
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  video_id text,
  video_url text,
  duration_seconds integer,
  document_url text,
  document_name text,
  has_quiz boolean default false,
  quiz_duration integer,
  quiz_document_url text,
  quiz_document_name text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'lessons_updated_at') then
    create trigger lessons_updated_at
      before update on public.lessons
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  question text not null,
  options text[] not null,
  correct_answer smallint not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- quiz_results
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text,
  user_email text,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  answers integer[] not null,
  correct_count integer not null,
  total_questions integer not null,
  score numeric not null,
  time_spent integer,
  completed_at timestamptz not null default now()
);

-- lesson_progress
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  watched_seconds numeric not null default 0,
  total_seconds numeric not null default 0,
  completed boolean not null default false,
  last_watched_at timestamptz not null default now(),
  unique (user_id, course_id, lesson_id)
);

-- enrollments
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'active',
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

-- attendance_records
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null,
  attendance_date date not null,
  check_in_time timestamptz not null,
  check_in_ip text not null default '',
  check_in_photo text,
  check_out_time timestamptz,
  check_out_ip text,
  check_out_photo text,
  status public.attendance_status not null,
  late_minutes integer,
  work_hours numeric,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'attendance_records_updated_at') then
    create trigger attendance_records_updated_at
      before update on public.attendance_records
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- salary_records
create table if not exists public.salary_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null,
  department_id uuid references public.departments (id) on delete set null,
  month text not null,
  base_salary numeric not null,
  working_days integer not null,
  absent_days integer not null default 0,
  late_days integer not null default 0,
  deduction numeric not null default 0,
  final_salary numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'salary_records_updated_at') then
    create trigger salary_records_updated_at
      before update on public.salary_records
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- monthly_salaries
create table if not exists public.monthly_salaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null,
  department_id uuid references public.departments (id) on delete set null,
  month text not null,
  base_salary numeric not null,
  working_days integer not null,
  present_days integer not null default 0,
  absent_days integer not null default 0,
  late_days integer not null default 0,
  half_days integer not null default 0,
  total_deduction numeric not null default 0,
  final_salary numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'monthly_salaries_updated_at') then
    create trigger monthly_salaries_updated_at
      before update on public.monthly_salaries
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- finance_master_categories
create table if not exists public.finance_master_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.master_category_type not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- finance_master_sub_categories
create table if not exists public.finance_master_sub_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_category_id uuid not null references public.finance_master_categories (id) on delete cascade,
  parent_category_name text,
  type public.master_category_type not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- finance_projects
create table if not exists public.finance_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status public.project_status not null default 'ACTIVE',
  budget numeric,
  currency public.currency,
  total_revenue numeric not null default 0,
  total_expense numeric not null default 0,
  default_currency public.currency,
  allowed_categories text[] default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- finance_project_members
create table if not exists public.finance_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.finance_projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null default 'MEMBER',
  permissions text[] not null default '{}',
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles (id) on delete set null,
  unique (project_id, user_id)
);

-- finance_project_sub_categories
create table if not exists public.finance_project_sub_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.finance_projects (id) on delete cascade,
  name text not null,
  parent_category_id uuid not null references public.finance_master_categories (id) on delete restrict,
  parent_category_name text,
  type public.master_category_type not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- finance_funds
create table if not exists public.finance_funds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  total_spent numeric not null default 0,
  target_budget numeric,
  keywords text[] default '{}',
  created_at timestamptz not null default now()
);

-- finance_accounts
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.account_type not null,
  currency public.currency not null,
  balance numeric not null default 0,
  opening_balance numeric not null default 0,
  project_id uuid references public.finance_projects (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  is_locked boolean not null default false,
  restrict_currency boolean not null default false,
  allowed_categories text[] default '{}',
  assigned_user_ids uuid[] default '{}',
  created_at timestamptz not null default now()
);

-- finance_beneficiaries
create table if not exists public.finance_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platforms text[] not null default '{}',
  bank_accounts jsonb not null default '[]',
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'finance_beneficiaries_updated_at') then
    create trigger finance_beneficiaries_updated_at
      before update on public.finance_beneficiaries
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- finance_transactions
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  currency public.currency not null,
  type public.transaction_type not null,
  category text not null default '',
  parent_category text,
  parent_category_id uuid references public.finance_master_categories (id) on delete set null,
  description text,
  transaction_date date not null,
  status public.transaction_status not null default 'PENDING',
  account_id uuid references public.finance_accounts (id) on delete set null,
  project_id uuid references public.finance_projects (id) on delete set null,
  fund_id uuid references public.finance_funds (id) on delete set null,
  source text,
  images text[] default '{}',
  beneficiary text,
  platform text,
  bank_info jsonb,
  transfer_content text,
  proof_of_payment text[] default '{}',
  proof_of_receipt text[] default '{}',
  warning boolean default false,
  rejection_reason text,
  approved_by uuid references public.profiles (id) on delete set null,
  rejected_by uuid references public.profiles (id) on delete set null,
  paid_by uuid references public.profiles (id) on delete set null,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  owner_user_id uuid not null references public.profiles (id) on delete restrict,
  payment_type public.payment_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- trigger created via DO block below
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'finance_transactions_updated_at') then
    create trigger finance_transactions_updated_at
      before update on public.finance_transactions
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- finance_fixed_costs
create table if not exists public.finance_fixed_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null,
  currency public.currency not null,
  cycle public.fixed_cost_cycle not null,
  status public.fixed_cost_status not null default 'ON',
  last_generated text,
  description text,
  account_id uuid references public.finance_accounts (id) on delete set null,
  category public.expense_category not null,
  project_id uuid references public.finance_projects (id) on delete set null,
  last_payment_date date,
  next_payment_date date
);

-- finance_monthly_revenues
create table if not exists public.finance_monthly_revenues (
  id text primary key,
  month text not null,
  year text not null,
  amount numeric not null,
  currency public.currency not null,
  note text,
  created_at timestamptz not null default now()
);

-- finance_activity_logs
create table if not exists public.finance_activity_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null,
  details text not null default '',
  logged_at timestamptz not null default now(),
  ip text,
  location text,
  device text
);

-- finance_audit_logs
create table if not exists public.finance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_id text,
  details jsonb,
  ip text not null default '',
  location text,
  user_agent text not null default '',
  logged_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_finance_transactions_owner on public.finance_transactions (owner_user_id);
create index if not exists idx_finance_transactions_project on public.finance_transactions (project_id);
create index if not exists idx_finance_transactions_date on public.finance_transactions (transaction_date desc);
create index if not exists idx_lesson_progress_user on public.lesson_progress (user_id);
create index if not exists idx_course_students_user on public.course_students (user_id);
create index if not exists idx_attendance_user_date on public.attendance_records (user_id, attendance_date desc);

