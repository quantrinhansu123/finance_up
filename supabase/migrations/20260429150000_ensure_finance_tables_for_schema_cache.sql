-- Ensure core finance tables exist even if earlier migrations were not applied.
-- This is intentionally minimal (no FKs) to avoid failures when referenced tables/enums are missing.

create table if not exists public.finance_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  budget numeric,
  currency text,
  total_revenue numeric not null default 0,
  total_expense numeric not null default 0,
  default_currency text,
  allowed_categories text[] default '{}'::text[],
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  role text not null default 'MEMBER',
  permissions text[] not null default '{}'::text[],
  added_at timestamptz not null default now(),
  added_by uuid
);

create table if not exists public.finance_project_sub_categories (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  name text not null,
  parent_category_id uuid not null,
  parent_category_name text,
  type text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

