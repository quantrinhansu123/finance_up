-- Ensure employees.approved exists for users page save flow
-- Safe to re-run

do $$
begin
  if to_regclass('public.employees') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'approved'
    ) then
      alter table public.employees
        add column approved boolean not null default true;
    end if;
  end if;
end
$$;
