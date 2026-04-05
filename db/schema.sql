-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.attendance_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  attendance_date date NOT NULL,
  check_in_time timestamp with time zone NOT NULL,
  check_in_ip text NOT NULL DEFAULT ''::text,
  check_in_photo text,
  check_out_time timestamp with time zone,
  check_out_ip text,
  check_out_photo text,
  status USER-DEFINED NOT NULL,
  late_minutes integer,
  work_hours numeric,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.badge_images (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  image_data text NOT NULL,
  text2_value text,
  frame_asset text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT badge_images_pkey PRIMARY KEY (id)
);
CREATE TABLE public.budget_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ngan_sach_xin numeric NOT NULL CHECK (ngan_sach_xin > 0::numeric),
  ngay_gio_xin timestamp with time zone NOT NULL DEFAULT now(),
  trang_thai text NOT NULL DEFAULT 'cho_phe_duyet'::text CHECK (trang_thai = ANY (ARRAY['cho_phe_duyet'::text, 'dong_y'::text, 'tu_choi'::text])),
  ly_do_tu_choi text,
  ghi_chu text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tkqc_account_id uuid,
  tkqc_id uuid,
  CONSTRAINT budget_requests_pkey PRIMARY KEY (id),
  CONSTRAINT budget_requests_tkqc_account_id_fkey FOREIGN KEY (tkqc_account_id) REFERENCES public.tkqc_accounts(id),
  CONSTRAINT budget_requests_tkqc_id_fkey FOREIGN KEY (tkqc_id) REFERENCES public.tkqc(id)
);
CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  allowed_ips ARRAY NOT NULL DEFAULT '{}'::text[],
  work_start_time text NOT NULL,
  work_end_time text NOT NULL,
  late_threshold_minutes integer NOT NULL DEFAULT 15,
  working_days_per_month integer NOT NULL DEFAULT 26,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT company_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.course_students (
  course_id uuid NOT NULL,
  user_id uuid NOT NULL,
  pending boolean NOT NULL DEFAULT false,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_students_pkey PRIMARY KEY (course_id, user_id),
  CONSTRAINT course_students_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  teacher_id uuid NOT NULL,
  teacher_name text NOT NULL DEFAULT ''::text,
  category text NOT NULL DEFAULT ''::text,
  level USER-DEFINED NOT NULL DEFAULT 'beginner'::course_level,
  duration numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  thumbnail text NOT NULL DEFAULT ''::text,
  banner text,
  demo_video_id text,
  department_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT courses_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.crm_agencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ma_agency text NOT NULL UNIQUE,
  ten_agency text NOT NULL,
  lien_he text,
  telegram text,
  tk_cung_cap text,
  du_an text,
  tong_da_nap numeric NOT NULL DEFAULT 0 CHECK (tong_da_nap >= 0::numeric),
  cong_no numeric NOT NULL DEFAULT 0 CHECK (cong_no >= 0::numeric),
  trang_thai text NOT NULL DEFAULT 'active'::text CHECK (trang_thai = ANY (ARRAY['active'::text, 'theo_doi'::text, 'tam_dung'::text, 'ngung'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_agencies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.crm_markets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ma_thi_truong text NOT NULL UNIQUE,
  ten_thi_truong text NOT NULL,
  mo_ta text,
  trang_thai text NOT NULL DEFAULT 'hoat_dong'::text CHECK (trang_thai = ANY (ARRAY['hoat_dong'::text, 'tam_dung'::text, 'ngung'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_markets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.crm_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ma_san_pham text NOT NULL UNIQUE,
  ten_san_pham text NOT NULL,
  mo_ta text,
  danh_muc text,
  gia_ban numeric CHECK (gia_ban IS NULL OR gia_ban >= 0::numeric),
  don_vi_tinh text NOT NULL DEFAULT 'cái'::text,
  id_du_an uuid,
  trang_thai text NOT NULL DEFAULT 'dang_ban'::text CHECK (trang_thai = ANY (ARRAY['dang_ban'::text, 'tam_ngung'::text, 'ngung'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_products_pkey PRIMARY KEY (id),
  CONSTRAINT crm_products_id_du_an_fkey FOREIGN KEY (id_du_an) REFERENCES public.du_an(id)
);
CREATE TABLE public.crm_role_views (
  role_id uuid NOT NULL,
  view_id text NOT NULL,
  CONSTRAINT crm_role_views_pkey PRIMARY KEY (role_id, view_id),
  CONSTRAINT crm_role_views_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.crm_roles(id)
);
CREATE TABLE public.crm_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code = ANY (ARRAY['admin'::text, 'leader'::text, 'mkt'::text])),
  name_vi text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT crm_roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.crm_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ma_team text UNIQUE,
  ten_team text NOT NULL,
  leader text,
  so_thanh_vien integer NOT NULL DEFAULT 0 CHECK (so_thanh_vien >= 0),
  member_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  du_an_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  doanh_so_thang numeric DEFAULT 0,
  trang_thai text NOT NULL DEFAULT 'hoat_dong'::text CHECK (trang_thai = ANY (ARRAY['hoat_dong'::text, 'tam_dung'::text, 'ngung'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_teams_pkey PRIMARY KEY (id)
);
CREATE TABLE public.crm_user_roles (
  employee_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  note text,
  CONSTRAINT crm_user_roles_pkey PRIMARY KEY (employee_id, role_id),
  CONSTRAINT crm_user_roles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT crm_user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.crm_roles(id)
);
CREATE TABLE public.crm_user_view_overrides (
  employee_id uuid NOT NULL,
  view_id text NOT NULL,
  allowed boolean NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT crm_user_view_overrides_pkey PRIMARY KEY (employee_id, view_id),
  CONSTRAINT crm_user_view_overrides_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  manager_id uuid,
  manager_name text,
  permissions ARRAY DEFAULT '{}'::permission_action[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id),
  CONSTRAINT departments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.detail_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  report_date date NOT NULL,
  shift text,
  product text,
  market text,
  ad_account text,
  ad_cost numeric,
  mess_comment_count integer,
  order_count integer,
  revenue numeric,
  team text,
  staff_id text,
  branch text,
  outbound_revenue numeric,
  cancelled_order_count integer,
  closed_revenue numeric,
  revenue_after_cancel numeric,
  revenue_after_shipping numeric,
  tc_revenue numeric,
  kpis numeric,
  ad_cost_by_account numeric,
  page_report text,
  status text,
  warning text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tong_data_nhan integer,
  tong_lead integer,
  ma_tkqc text,
  page text,
  code text,
  CONSTRAINT detail_reports_pkey PRIMARY KEY (id)
);
CREATE TABLE public.du_an (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ma_du_an text UNIQUE,
  ten_du_an text NOT NULL,
  don_vi text,
  mo_ta text,
  ngan_sach_ke_hoach numeric DEFAULT 0,
  chi_phi_marketing_thuc_te numeric DEFAULT 0,
  tong_doanh_so numeric DEFAULT 0,
  ty_le_ads_doanh_so numeric DEFAULT 
CASE
    WHEN (COALESCE(tong_doanh_so, (0)::numeric) > (0)::numeric) THEN ((COALESCE(chi_phi_marketing_thuc_te, (0)::numeric) / tong_doanh_so) * (100)::numeric)
    ELSE NULL::numeric
END,
  ngay_bat_dau date,
  ngay_ket_thuc date,
  trang_thai text NOT NULL DEFAULT 'dang_chay'::text CHECK (trang_thai = ANY (ARRAY['dang_chay'::text, 'tam_dung'::text, 'ket_thuc'::text, 'huy'::text, 'review'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  thi_truong text,
  leader text,
  doanh_thu_thang numeric DEFAULT 0,
  so_mkt integer NOT NULL DEFAULT 0 CHECK (so_mkt >= 0),
  staff_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT du_an_pkey PRIMARY KEY (id)
);
CREATE TABLE public.du_an_qc_excel_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  du_an_id uuid,
  ten_tai_khoan text,
  ten_quang_cao text,
  ngay date,
  don_vi_tien_te text,
  so_tien_chi_tieu_vnd numeric,
  chi_phi_mua numeric,
  cpm numeric,
  ctr_tat_ca text,
  luot_tro_chuyen_tin_nhan numeric,
  cpc numeric,
  bao_cao_tu timestamp with time zone,
  bao_cao_den timestamp with time zone,
  source_file text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT du_an_qc_excel_rows_pkey PRIMARY KEY (id),
  CONSTRAINT du_an_qc_excel_rows_du_an_id_fkey FOREIGN KEY (du_an_id) REFERENCES public.du_an(id)
);
CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  avatar_url text,
  email text,
  pass text,
  ma_ns text,
  ngay_bat_dau date,
  leader text,
  du_an_ten text,
  so_fanpage integer NOT NULL DEFAULT 0 CHECK (so_fanpage >= 0),
  trang_thai text NOT NULL DEFAULT 'dang_lam'::text CHECK (trang_thai = ANY (ARRAY['dang_lam'::text, 'nghi'::text, 'tam_nghi'::text, 'dot_tien'::text])),
  vi_tri text,
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type USER-DEFINED NOT NULL,
  currency USER-DEFINED NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  opening_balance numeric NOT NULL DEFAULT 0,
  project_id uuid,
  department_id uuid,
  is_locked boolean NOT NULL DEFAULT false,
  restrict_currency boolean NOT NULL DEFAULT false,
  allowed_categories ARRAY DEFAULT '{}'::text[],
  assigned_user_ids ARRAY DEFAULT '{}'::uuid[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT finance_accounts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.finance_projects(id),
  CONSTRAINT finance_accounts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.finance_activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  details text NOT NULL DEFAULT ''::text,
  logged_at timestamp with time zone NOT NULL DEFAULT now(),
  ip text,
  location text,
  device text,
  CONSTRAINT finance_activity_logs_pkey PRIMARY KEY (id),
  CONSTRAINT finance_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  target_id text,
  details jsonb,
  ip text NOT NULL DEFAULT ''::text,
  location text,
  user_agent text NOT NULL DEFAULT ''::text,
  logged_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT finance_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_beneficiaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  platforms ARRAY NOT NULL DEFAULT '{}'::text[],
  bank_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_beneficiaries_pkey PRIMARY KEY (id)
);
CREATE TABLE public.finance_fixed_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL,
  currency USER-DEFINED NOT NULL,
  cycle USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'ON'::fixed_cost_status,
  last_generated text,
  description text,
  account_id uuid,
  category USER-DEFINED NOT NULL,
  project_id uuid,
  last_payment_date date,
  next_payment_date date,
  CONSTRAINT finance_fixed_costs_pkey PRIMARY KEY (id),
  CONSTRAINT finance_fixed_costs_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(id),
  CONSTRAINT finance_fixed_costs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.finance_projects(id)
);
CREATE TABLE public.finance_funds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  total_spent numeric NOT NULL DEFAULT 0,
  target_budget numeric,
  keywords ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_funds_pkey PRIMARY KEY (id)
);
CREATE TABLE public.finance_master_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type USER-DEFINED NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_master_categories_pkey PRIMARY KEY (id),
  CONSTRAINT finance_master_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_master_sub_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_category_id uuid NOT NULL,
  parent_category_name text,
  type USER-DEFINED NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_master_sub_categories_pkey PRIMARY KEY (id),
  CONSTRAINT finance_master_sub_categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.finance_master_categories(id),
  CONSTRAINT finance_master_sub_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_monthly_revenues (
  id text NOT NULL,
  month text NOT NULL,
  year text NOT NULL,
  amount numeric NOT NULL,
  currency USER-DEFINED NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_monthly_revenues_pkey PRIMARY KEY (id)
);
CREATE TABLE public.finance_project_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'MEMBER'::project_role,
  permissions ARRAY NOT NULL DEFAULT '{}'::text[],
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  added_by uuid,
  CONSTRAINT finance_project_members_pkey PRIMARY KEY (id),
  CONSTRAINT finance_project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.finance_projects(id),
  CONSTRAINT finance_project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT finance_project_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_project_sub_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  name text NOT NULL,
  parent_category_id uuid NOT NULL,
  parent_category_name text,
  type USER-DEFINED NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_project_sub_categories_pkey PRIMARY KEY (id),
  CONSTRAINT finance_project_sub_categories_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.finance_projects(id),
  CONSTRAINT finance_project_sub_categories_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.finance_master_categories(id),
  CONSTRAINT finance_project_sub_categories_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status USER-DEFINED NOT NULL DEFAULT 'ACTIVE'::project_status,
  budget numeric,
  currency USER-DEFINED,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_expense numeric NOT NULL DEFAULT 0,
  default_currency USER-DEFINED,
  allowed_categories ARRAY DEFAULT '{}'::text[],
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_projects_pkey PRIMARY KEY (id),
  CONSTRAINT finance_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.finance_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  amount numeric NOT NULL,
  currency USER-DEFINED NOT NULL,
  type USER-DEFINED NOT NULL,
  category text NOT NULL DEFAULT ''::text,
  parent_category text,
  parent_category_id uuid,
  description text,
  transaction_date date NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'PENDING'::transaction_status,
  account_id uuid,
  project_id uuid,
  fund_id uuid,
  source text,
  images ARRAY DEFAULT '{}'::text[],
  beneficiary text,
  platform text,
  bank_info jsonb,
  transfer_content text,
  proof_of_payment ARRAY DEFAULT '{}'::text[],
  proof_of_receipt ARRAY DEFAULT '{}'::text[],
  warning boolean DEFAULT false,
  rejection_reason text,
  approved_by uuid,
  rejected_by uuid,
  paid_by uuid,
  confirmed_by uuid,
  created_by uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  payment_type USER-DEFINED,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT finance_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT finance_transactions_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.finance_master_categories(id),
  CONSTRAINT finance_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_accounts(id),
  CONSTRAINT finance_transactions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.finance_projects(id),
  CONSTRAINT finance_transactions_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.finance_funds(id),
  CONSTRAINT finance_transactions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id),
  CONSTRAINT finance_transactions_rejected_by_fkey FOREIGN KEY (rejected_by) REFERENCES public.profiles(id),
  CONSTRAINT finance_transactions_paid_by_fkey FOREIGN KEY (paid_by) REFERENCES public.profiles(id),
  CONSTRAINT finance_transactions_confirmed_by_fkey FOREIGN KEY (confirmed_by) REFERENCES public.profiles(id),
  CONSTRAINT finance_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT finance_transactions_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.kpi_staff_monthly_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nam_thang text NOT NULL CHECK (nam_thang ~ '^\d{4}-\d{2}$'::text),
  employee_id uuid NOT NULL,
  muc_tieu_vnd numeric NOT NULL DEFAULT 0 CHECK (muc_tieu_vnd >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  muc_tieu_lead numeric NOT NULL DEFAULT 0 CHECK (muc_tieu_lead >= 0::numeric),
  muc_tieu_don_chot numeric NOT NULL DEFAULT 0 CHECK (muc_tieu_don_chot >= 0::numeric),
  CONSTRAINT kpi_staff_monthly_targets_pkey PRIMARY KEY (id),
  CONSTRAINT kpi_staff_monthly_targets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.kpi_team_monthly_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nam_thang text NOT NULL CHECK (nam_thang ~ '^\d{4}-\d{2}$'::text),
  team_key text NOT NULL,
  muc_tieu_doanh_thu_team numeric NOT NULL DEFAULT 0 CHECK (muc_tieu_doanh_thu_team >= 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  muc_tieu_lead_team numeric NOT NULL DEFAULT 0 CHECK (muc_tieu_lead_team >= 0::numeric),
  muc_tieu_don_chot_team numeric NOT NULL DEFAULT 0 CHECK (muc_tieu_don_chot_team >= 0::numeric),
  CONSTRAINT kpi_team_monthly_targets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.lesson_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  watched_seconds numeric NOT NULL DEFAULT 0,
  total_seconds numeric NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  last_watched_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lesson_progress_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT lesson_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  sort_order integer NOT NULL DEFAULT 0,
  video_id text,
  video_url text,
  duration_seconds integer,
  document_url text,
  document_name text,
  has_quiz boolean DEFAULT false,
  quiz_duration integer,
  quiz_document_url text,
  quiz_document_name text,
  tags ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lessons_pkey PRIMARY KEY (id),
  CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.marketing_campaign_tkqc (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  tkqc_account_id uuid NOT NULL,
  ngan_sach_gan numeric NOT NULL DEFAULT 0 CHECK (ngan_sach_gan >= 0::numeric),
  chi_phi_thuc_te numeric NOT NULL DEFAULT 0 CHECK (chi_phi_thuc_te >= 0::numeric),
  ghi_chu text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_campaign_tkqc_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_campaign_tkqc_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id),
  CONSTRAINT marketing_campaign_tkqc_tkqc_account_id_fkey FOREIGN KEY (tkqc_account_id) REFERENCES public.tkqc_accounts(id)
);
CREATE TABLE public.marketing_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ma_chien_dich text UNIQUE,
  ten_chien_dich text NOT NULL,
  mo_ta text,
  nen_tang text,
  ngay_bat_dau date,
  ngay_ket_thuc date,
  trang_thai text NOT NULL DEFAULT 'dang_chay'::text CHECK (trang_thai = ANY (ARRAY['nhap'::text, 'dang_chay'::text, 'tam_dung'::text, 'ket_thuc'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id)
);
CREATE TABLE public.marketing_channel_details (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL,
  content_link text,
  image_link text,
  link_nhom jsonb NOT NULL DEFAULT '[]'::jsonb,
  ghi_chu text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_channel_details_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_channel_details_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.marketing_channels(id)
);
CREATE TABLE public.marketing_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  loai_kenh text NOT NULL,
  link_kenh text,
  noi_dung text,
  chi_phi numeric NOT NULL DEFAULT 0 CHECK (chi_phi >= 0::numeric),
  so_lead integer NOT NULL DEFAULT 0 CHECK (so_lead >= 0),
  so_don integer NOT NULL DEFAULT 0 CHECK (so_don >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_channels_pkey PRIMARY KEY (id)
);
CREATE TABLE public.marketing_staff (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_ns text NOT NULL UNIQUE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  team text,
  branch text,
  role text DEFAULT 'user'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  employee_id uuid,
  CONSTRAINT marketing_staff_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_staff_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.monthly_salaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  department_id uuid,
  month text NOT NULL,
  base_salary numeric NOT NULL,
  working_days integer NOT NULL,
  present_days integer NOT NULL DEFAULT 0,
  absent_days integer NOT NULL DEFAULT 0,
  late_days integer NOT NULL DEFAULT 0,
  half_days integer NOT NULL DEFAULT 0,
  total_deduction numeric NOT NULL DEFAULT 0,
  final_salary numeric NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT monthly_salaries_pkey PRIMARY KEY (id),
  CONSTRAINT monthly_salaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT monthly_salaries_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL DEFAULT ''::text,
  display_name text NOT NULL DEFAULT ''::text,
  role USER-DEFINED NOT NULL DEFAULT 'student'::user_role,
  position USER-DEFINED,
  department_id uuid,
  monthly_salary numeric,
  total_learning_hours numeric,
  approved boolean NOT NULL DEFAULT false,
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
  employment jsonb,
  finance_role USER-DEFINED,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL,
  question text NOT NULL,
  options ARRAY NOT NULL,
  correct_answer smallint NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT questions_pkey PRIMARY KEY (id),
  CONSTRAINT questions_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.quiz_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text,
  user_email text,
  lesson_id uuid NOT NULL,
  course_id uuid NOT NULL,
  answers ARRAY NOT NULL,
  correct_count integer NOT NULL,
  total_questions integer NOT NULL,
  score numeric NOT NULL,
  time_spent integer,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quiz_results_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT quiz_results_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT quiz_results_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  permissions ARRAY NOT NULL DEFAULT '{}'::permission_action[],
  department_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.salary_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  department_id uuid,
  month text NOT NULL,
  base_salary numeric NOT NULL,
  working_days integer NOT NULL,
  absent_days integer NOT NULL DEFAULT 0,
  late_days integer NOT NULL DEFAULT 0,
  deduction numeric NOT NULL DEFAULT 0,
  final_salary numeric NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT salary_records_pkey PRIMARY KEY (id),
  CONSTRAINT salary_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT salary_records_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.tkqc (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  id_du_an uuid NOT NULL,
  ma_tkqc text NOT NULL,
  ten_tkqc text,
  ten_pae text,
  nen_tang text,
  ngan_sach_phan_bo numeric DEFAULT 0,
  chi_phi_thuc_te numeric DEFAULT 0,
  tong_doanh_so numeric DEFAULT 0,
  ty_le_ads_doanh_so numeric DEFAULT 
CASE
    WHEN (COALESCE(tong_doanh_so, (0)::numeric) > (0)::numeric) THEN ((COALESCE(chi_phi_thuc_te, (0)::numeric) / tong_doanh_so) * (100)::numeric)
    ELSE NULL::numeric
END,
  id_marketing_staff uuid,
  ghi_chu text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  ngay_bat_dau date,
  id_crm_team uuid,
  trang_thai_tkqc text NOT NULL DEFAULT 'active'::text CHECK (trang_thai_tkqc = ANY (ARRAY['active'::text, 'thieu_thiet_lap'::text])),
  agency text,
  ten_quang_cao text,
  CONSTRAINT tkqc_pkey PRIMARY KEY (id),
  CONSTRAINT tkqc_id_du_an_fkey FOREIGN KEY (id_du_an) REFERENCES public.du_an(id),
  CONSTRAINT tkqc_id_marketing_staff_fkey FOREIGN KEY (id_marketing_staff) REFERENCES public.marketing_staff(id),
  CONSTRAINT tkqc_id_crm_team_fkey FOREIGN KEY (id_crm_team) REFERENCES public.crm_teams(id)
);
CREATE TABLE public.tkqc_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tkqc text NOT NULL,
  page text,
  don_vi text,
  ngan_sach numeric DEFAULT 0,
  tong_chi numeric DEFAULT 0,
  doanh_so numeric DEFAULT 0,
  so_mess integer NOT NULL DEFAULT 0 CHECK (so_mess >= 0),
  so_don integer NOT NULL DEFAULT 0 CHECK (so_don >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  employee_id uuid,
  CONSTRAINT tkqc_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT tkqc_accounts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.user_permissions (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  department_id uuid,
  custom_permissions ARRAY DEFAULT '{}'::permission_action[],
  CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, role_id),
  CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT user_permissions_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);