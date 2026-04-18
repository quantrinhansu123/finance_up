-- Add multi-step approval and disbursement tracking fields for budget_requests
ALTER TABLE public.budget_requests
    ADD COLUMN IF NOT EXISTS giam_doc_da_duyet boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS giam_doc_duyet_boi text,
    ADD COLUMN IF NOT EXISTS giam_doc_duyet_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS ke_toan_da_duyet boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ke_toan_duyet_boi text,
    ADD COLUMN IF NOT EXISTS ke_toan_duyet_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS da_giai_ngan boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS giai_ngan_boi text,
    ADD COLUMN IF NOT EXISTS giai_ngan_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS anh_giai_ngan_urls text[] NOT NULL DEFAULT '{}';

-- Optional indexes for common filters in approvals screens
CREATE INDEX IF NOT EXISTS idx_budget_requests_duyet_flags
    ON public.budget_requests (trang_thai, giam_doc_da_duyet, ke_toan_da_duyet, da_giai_ngan);
