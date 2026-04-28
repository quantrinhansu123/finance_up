-- =============================================================================
-- Finance Up — schema PostgreSQL cho Supabase (tương ứng Firestore + types/)
-- Chạy trong SQL Editor hoặc: supabase db push / migration
-- =============================================================================

-- Extensions (Supabase thường đã bật sẵn)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (khớp TypeScript)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'staff', 'teacher', 'student');
create type public.position as enum (
  'Nhân viên', 'Trưởng nhóm', 'Phó phòng', 'Trưởng phòng',
  'Phó giám đốc', 'Giám đốc'
);
create type public.finance_role as enum (
  'ADMIN', 'ACCOUNTANT', 'TREASURER', 'MANAGER', 'STAFF', 'NONE'
);
create type public.course_level as enum ('beginner', 'intermediate', 'advanced');
create type public.attendance_status as enum ('present', 'late', 'absent', 'half-day');
create type public.permission_action as enum (
  'view_dashboard', 'view_users', 'manage_users', 'view_courses', 'manage_courses',
  'view_departments', 'manage_departments', 'view_salary', 'manage_salary',
  'view_own_department', 'manage_own_department'
);
create type public.currency as enum (
  'VND', 'USD', 'KHR', 'TRY', 'MMK', 'THB', 'LAK', 'MYR', 'IDR', 'PHP', 'SGD'
);
create type public.transaction_type as enum ('IN', 'OUT');
create type public.transaction_status as enum (
  'PENDING', 'APPROVED', 'REJECTED', 'PAID', 'COMPLETED'
);
create type public.account_type as enum ('BANK', 'CASH', 'E-WALLET');
create type public.project_status as enum ('ACTIVE', 'COMPLETED', 'PAUSED');
create type public.project_role as enum ('OWNER', 'MANAGER', 'MEMBER', 'VIEWER');
create type public.master_category_type as enum ('INCOME', 'EXPENSE');
create type public.fixed_cost_cycle as enum ('MONTHLY', 'QUARTERLY', 'YEARLY');
create type public.fixed_cost_status as enum ('ON', 'OFF');
create type public.expense_category as enum (
  'Lương nhân sự', 'Thuê văn phòng', 'Cước vận chuyển', 'Marketing/Ads',
  'Vận hành', 'SIM', 'Thuế', 'Chi phí cố định', 'Khác'
);
create type public.payment_type as enum ('FULL', 'PARTIAL');

-- ---------------------------------------------------------------------------
-- updated_at trigger (chuẩn Supabase)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hồ sơ người dùng (Firestore: users / UserProfile) — liên kết auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  role public.user_role not null default 'student',
  position public.position,
  department_id uuid, -- FK sau khi có departments
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
  employment jsonb, -- EmploymentInfo đồng bộ từ HR (optional)
  finance_role public.finance_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Phòng ban (departments)
-- ---------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  manager_id uuid references public.profiles (id) on delete set null,
  manager_name text,
  permissions public.permission_action[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_department_id_fkey
  foreign key (department_id) references public.departments (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Vai trò & gán quyền (types/permission.ts)
-- ---------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  permissions public.permission_action[] not null default '{}',
  department_id uuid references public.departments (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

create table public.user_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  custom_permissions public.permission_action[] default '{}',
  primary key (user_id, role_id)
);

-- ---------------------------------------------------------------------------
-- Cài đặt công ty / chấm công (companySettings)
-- ---------------------------------------------------------------------------
create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  allowed_ips text[] not null default '{}',
  work_start_time text not null, -- HH:mm
  work_end_time text not null,
  late_threshold_minutes integer not null default 15,
  working_days_per_month integer not null default 26,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger company_settings_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Khóa học + bài học + câu hỏi + kết quả quiz + tiến độ
-- ---------------------------------------------------------------------------
create table public.courses (
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

create trigger courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

-- Học viên khóa học (thay cho students[] / pendingStudents[])
create table public.course_students (
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  pending boolean not null default false,
  enrolled_at timestamptz not null default now(),
  primary key (course_id, user_id)
);

create table public.lessons (
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

create trigger lessons_updated_at
  before update on public.lessons
  for each row execute function public.set_updated_at();

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  question text not null,
  options text[] not null,
  correct_answer smallint not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.quiz_results (
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

-- progress / LessonProgress — id cũ có thể là composite; ở đây dùng uuid + unique (user, lesson)
create table public.lesson_progress (
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

-- enrollments (collection Firestore — bảng tổng quát)
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status text not null default 'active',
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

-- ---------------------------------------------------------------------------
-- Chấm công & lương
-- ---------------------------------------------------------------------------
create table public.attendance_records (
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

create trigger attendance_records_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

create table public.salary_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_name text not null,
  department_id uuid references public.departments (id) on delete set null,
  month text not null, -- YYYY-MM
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

create trigger salary_records_updated_at
  before update on public.salary_records
  for each row execute function public.set_updated_at();

create table public.monthly_salaries (
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

create trigger monthly_salaries_updated_at
  before update on public.monthly_salaries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Finance — danh mục master
-- ---------------------------------------------------------------------------
create table public.finance_master_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.master_category_type not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.finance_master_sub_categories (
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

-- ---------------------------------------------------------------------------
-- Finance — dự án, thành viên, danh mục con theo dự án
-- ---------------------------------------------------------------------------
create table public.finance_projects (
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

-- memberIds[] → bảng; permissions: ProjectPermission[]
create table public.finance_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.finance_projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null default 'MEMBER',
  permissions text[] not null default '{}',
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles (id) on delete set null,
  unique (project_id, user_id)
);

create table public.finance_project_sub_categories (
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

create table public.finance_funds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  total_spent numeric not null default 0,
  target_budget numeric,
  keywords text[] default '{}',
  created_at timestamptz not null default now()
);

create table public.finance_accounts (
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

create trigger finance_beneficiaries_updated_at
  before update on public.finance_beneficiaries
  for each row execute function public.set_updated_at();

create table public.finance_transactions (
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

create trigger finance_transactions_updated_at
  before update on public.finance_transactions
  for each row execute function public.set_updated_at();

create table public.finance_fixed_costs (
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

create table public.finance_monthly_revenues (
  id text primary key, -- "YYYY-MM" như app cũ
  month text not null,
  year text not null,
  amount numeric not null,
  currency public.currency not null,
  note text,
  created_at timestamptz not null default now()
);

create table public.finance_activity_logs (
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

create table public.finance_audit_logs (
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

-- ---------------------------------------------------------------------------
-- Row Level Security — bật; điều chỉnh policy theo nghiệp vụ (thay cho rules Firestore)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_projects enable row level security;

-- Ví dụ: user đọc/sửa profile của chính họ
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Cho phép insert profile khi đăng ký (trigger thường dùng service role; nếu insert từ client:)
create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Bảng công khai nội bộ — thu hẹp lại khi đã có phân quyền rõ (admin/staff)
create policy "departments_authenticated_read"
  on public.departments for select
  to authenticated
  using (true);

create policy "courses_authenticated_read"
  on public.courses for select
  to authenticated
  using (true);

create policy "lessons_authenticated_read"
  on public.lessons for select
  to authenticated
  using (true);

-- Giao dịch: chủ sở hữu bản ghi (owner_user_id) hoặc tạo bởi chính user
create policy "finance_tx_select"
  on public.finance_transactions for select
  to authenticated
  using (owner_user_id = auth.uid() or created_by = auth.uid());

create policy "finance_tx_insert"
  on public.finance_transactions for insert
  to authenticated
  with check (created_by = auth.uid() and owner_user_id = auth.uid());

create policy "finance_tx_update"
  on public.finance_transactions for update
  to authenticated
  using (owner_user_id = auth.uid() or created_by = auth.uid());

-- Dự án: thành viên (cần bổ sung policy theo finance_project_members nếu muốn chặt)
create policy "finance_projects_select"
  on public.finance_projects for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Hàm tạo profile sau khi đăng ký (tùy chọn — gọi từ Dashboard Supabase Auth)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User')
  );
  return new;
end;
$$;

-- Bật sau khi chắc chắn muốn tự tạo profile:
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();

comment on table public.profiles is 'UserProfile — 1-1 với auth.users';
comment on table public.finance_transactions is 'Firestore finance_transactions; owner_user_id = userId trong TS';
comment on column public.finance_transactions.owner_user_id is 'Tương ứng Transaction.userId (RLS)';

-- Index thường dùng khi query
create index idx_finance_transactions_owner on public.finance_transactions (owner_user_id);
create index idx_finance_transactions_project on public.finance_transactions (project_id);
create index idx_finance_transactions_date on public.finance_transactions (transaction_date desc);
create index idx_lesson_progress_user on public.lesson_progress (user_id);
create index idx_course_students_user on public.course_students (user_id);
create index idx_attendance_user_date on public.attendance_records (user_id, attendance_date desc);
