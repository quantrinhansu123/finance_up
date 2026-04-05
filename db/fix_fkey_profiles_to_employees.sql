-- Migration: Chuyển hướng khoá ngoại (Foreign Key) sang bảng Employees (Bản Tối Thượng)
-- Khắc phục các mâu thuẫn đối với user_id hoặc created_by yêu cầu liên kết tới 'profiles'

DO $$
DECLARE
    -- Danh sách tất cả các bảng tài chính tiềm tàng Foreign Key liên quan đến nhân viên
    tables text[] := ARRAY[
        'finance_activity_logs',
        'finance_projects',
        'finance_transactions',
        'finance_master_categories',
        'finance_fixed_costs',
        'finance_funds',
        'finance_monthly_revenue',
        'finance_beneficiaries',
        'finance_accounts'
    ];
    t text;
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        -- Tháo gỡ các Foreign Key rườm rà đang bám vào bảng 'profiles'
        EXECUTE 'ALTER TABLE IF EXISTS public.' || t || ' DROP CONSTRAINT IF EXISTS ' || t || '_user_id_fkey;';
        EXECUTE 'ALTER TABLE IF EXISTS public.' || t || ' DROP CONSTRAINT IF EXISTS ' || t || '_created_by_fkey;';
        EXECUTE 'ALTER TABLE IF EXISTS public.' || t || ' DROP CONSTRAINT IF EXISTS ' || t || '_owner_user_id_fkey;';
        EXECUTE 'ALTER TABLE IF EXISTS public.' || t || ' DROP CONSTRAINT IF EXISTS ' || t || '_assigned_user_ids_fkey;';
        EXECUTE 'ALTER TABLE IF EXISTS public.' || t || ' DROP CONSTRAINT IF EXISTS ' || t || '_approved_by_fkey;';
        EXECUTE 'ALTER TABLE IF EXISTS public.' || t || ' DROP CONSTRAINT IF EXISTS ' || t || '_rejected_by_fkey;';
    END LOOP;
END
$$;

-- Chủ động Add cứng Constraint chỉ ở 4 bảng xương sống đã biết chắc có cột user/creator:
-- (Bảng Danh mục - Categories)
ALTER TABLE public.finance_master_categories 
  ADD CONSTRAINT finance_master_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL;

-- (Bảng Lịch sử - Logs)
ALTER TABLE public.finance_activity_logs 
  ADD CONSTRAINT finance_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.employees(id) ON DELETE CASCADE;

-- (Bảng Dự án - Projects)
ALTER TABLE public.finance_projects 
  ADD CONSTRAINT finance_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL;

-- (Bảng Giao Dịch - Transactions)
ALTER TABLE public.finance_transactions 
  ADD CONSTRAINT finance_transactions_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD CONSTRAINT finance_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id) ON DELETE SET NULL;
