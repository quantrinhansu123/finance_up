-- Copy missing columns from public.finance_accounts to public.employees
-- Only adds columns that do not already exist in employees.
-- Safe to re-run.

do $$
declare
  col record;
begin
  if to_regclass('public.finance_accounts') is null then
    raise notice 'Table public.finance_accounts not found, skip migration.';
    return;
  end if;

  if to_regclass('public.employees') is null then
    raise notice 'Table public.employees not found, skip migration.';
    return;
  end if;

  for col in
    select
      a.attname as column_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'finance_accounts'
      and a.attnum > 0
      and not a.attisdropped
      and not exists (
        select 1
        from information_schema.columns ic
        where ic.table_schema = 'public'
          and ic.table_name = 'employees'
          and ic.column_name = a.attname
      )
  loop
    execute format(
      'alter table public.employees add column %I %s',
      col.column_name,
      col.data_type
    );
  end loop;
end
$$;
