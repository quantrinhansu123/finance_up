-- Add member_ids list column to support member checkbox selection

alter table public.finance_projects
add column if not exists member_ids uuid[] not null default '{}'::uuid[];

