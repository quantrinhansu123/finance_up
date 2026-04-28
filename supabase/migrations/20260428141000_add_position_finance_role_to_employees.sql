-- Ensure employees has fields used by users management page
-- Safe to re-run

do $$
begin
  if to_regclass('public.employees') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'position'
    ) then
      alter table public.employees
        add column position text;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'finance_role'
    ) then
      alter table public.employees
        add column finance_role text;
    end if;
  end if;
end
$$;
