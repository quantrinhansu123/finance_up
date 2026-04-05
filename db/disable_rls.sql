-- Migration: Disable Row-Level Security (RLS) for all tables in the public schema
-- RLS đang vô tình chặn các thao tác INSERT/UPDATE/DELETE vì hệ thống dự án
-- sử dụng cơ chế Auth tuỳ chỉnh thay vì Supabase Auth mặc định.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Vòng lặp quét tất cả các bảng tồn tại trong schema public (mặc định)
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        -- Thực thi lệnh Tắt RLS cho từng bảng
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE ROW LEVEL SECURITY;';
        -- (Tuỳ chọn) Nếu bạn muốn chắc chắn xoá bỏ quyền giới hạn của các Policy cũ gắn kèm
        -- EXECUTE 'DROP POLICY IF EXISTS "Enable ALL for authenticated users only" ON public.' || quote_ident(r.tablename);
    END LOOP;
END
$$;

-- Lưu ý: Bạn cần copy toàn bộ đoạn mã này và chạy trực tiếp trong
-- => Supabase Dashboard -> SQL Editor -> New Query.
