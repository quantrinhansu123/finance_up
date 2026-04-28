/**
 * Đọc biến môi trường Supabase cho cả Next (NEXT_PUBLIC_*) và file .env kiểu Vite (VITE_*).
 * Bỏ BOM, xuống dòng thừa (copy-paste), dấu ngoặc — tránh URL/key hỏng khiến undici báo "fetch failed".
 */
function normalizeEnvValue(v: string | undefined): string {
    if (v == null) return "";
    let s = String(v).replace(/^\uFEFF/, "").trim();
    if (
        (s.startsWith('"') && s.endsWith('"')) ||
        (s.startsWith("'") && s.endsWith("'"))
    ) {
        s = s.slice(1, -1).trim();
    }
    s = s.replace(/\r\n/g, "\n").replace(/\n/g, "").replace(/\r/g, "").trim();
    return s;
}

export function readSupabaseUrl(): string {
    return normalizeEnvValue(
        process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
    );
}

export function readSupabaseAnonKey(): string {
    return normalizeEnvValue(
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            process.env.VITE_SUPABASE_ANON_KEY
    );
}

/** Chỉ dùng trên server (API route). Giúp đọc `employees` khi RLS chặn anon. Không đặt NEXT_PUBLIC_. */
export function readSupabaseServiceRoleKey(): string {
    return normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
