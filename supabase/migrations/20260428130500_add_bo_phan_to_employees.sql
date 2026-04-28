-- Add bo_phan column for employee department display/filtering
-- Safe to re-run and safe when the table does not exist yet

do $$
begin
  if to_regclass('public.employees') is not null then
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'employees'
        and column_name = 'bo_phan'
    ) then
      alter table public.employees
        add column bo_phan text;
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.employees') is not null then
    comment on column public.employees.bo_phan is 'Bo phan dung de hien thi va loc trong trang users';
  end if;
end
$$;
