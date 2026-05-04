import type { SupabaseClient } from "@supabase/supabase-js";
export type LoginResult =
    | {
          ok: true;
          user: Record<string, unknown>;
          session: {
              access_token: string;
              refresh_token: string;
          } | null;
      }
    | { ok: false; message: string };

function rowToSafeClient(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
        if (k === "pass" || k === "password") continue;
        const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
        out[camel] = v;
    }
    if (row.name && !out.displayName) out.displayName = row.name;
    out.id = row.id;
    if (row.id != null) out.uid = row.id;
    return out;
}

/** Mật khẩu lưu ở cột pass/password hoặc employment.password (giống init-sso). */
function storedPassword(row: Record<string, unknown>): string | undefined {
    const r = row;
    const direct = r.pass ?? r.password ?? r.Pass ?? r.Password;
    if (direct != null && String(direct) !== "") return String(direct);
    const emp = r.employment;
    if (emp && typeof emp === "object" && emp !== null) {
        const ep = (emp as Record<string, unknown>).password;
        if (ep != null && String(ep) !== "") return String(ep);
    }
    return undefined;
}

function passwordsMatch(stored: string | undefined, input: string): boolean {
    if (stored == null) return false;
    const s = String(stored);
    const i = String(input);
    if (s === i) return true;
    if (s.trim() === i.trim()) return true;
    return false;
}

/** Tìm dòng employees theo email: eq (nhiều biến thể) rồi ilike không phân biệt hoa thường. */
async function findEmployeesByEmail(db: SupabaseClient, rawEmail: string) {
    const em = rawEmail.trim();
    if (!em) return { data: [] as Record<string, unknown>[], error: null as { message?: string } | null };

    const lower = em.toLowerCase();
    const variants = Array.from(new Set([em, lower].filter(Boolean)));

    const q1 = await db.from("employees").select("*").in("email", variants).limit(25);
    if (q1.error) return { data: [] as Record<string, unknown>[], error: q1.error };
    const fromIn = (q1.data || []) as Record<string, unknown>[];
    if (fromIn.length > 0) return { data: fromIn, error: null };

    const q2 = await db.from("employees").select("*").ilike("email", em).limit(25);
    if (q2.error) return { data: [] as Record<string, unknown>[], error: q2.error };
    return { data: (q2.data || []) as Record<string, unknown>[], error: null };
}

export function formatLoginDbError(e: { message?: string }): string {
    const msg = e.message || "";
    if (
        msg.includes("Failed to fetch") ||
        msg.toLowerCase().includes("fetch failed")
    ) {
        return "Không kết nối được Supabase từ máy chủ. Kiểm tra VPN/firewall; khi dev xem GET /api/debug/supabase.";
    }
    return msg || "Lỗi cơ sở dữ liệu";
}

/**
 * Đăng nhập qua Supabase (Auth + bảng employees).
 * @param authClient — thường là anon (signInWithPassword).
 * @param dbClient — tùy chọn: service role để đọc `employees` khi RLS chặn anon (khuyên dùng trên server).
 */
export async function performLoginWithSupabase(
    _authClient: SupabaseClient,
    email: string,
    password: string,
    dbClient?: SupabaseClient
): Promise<LoginResult> {
    const db = dbClient ?? _authClient;
    const em = email.trim();
    if (!em || !password) {
        return { ok: false, message: "Nhập email và mật khẩu" };
    }

    const { data: list, error: qErr } = await findEmployeesByEmail(db, em);
    if (qErr) return { ok: false, message: formatLoginDbError(qErr) };

    if (list.length === 0) {
        return { ok: false, message: "Email hoặc mật khẩu không đúng" };
    }
    const row = list.find((r) =>
        passwordsMatch(storedPassword(r as Record<string, unknown>), password)
    );
    if (!row) {
        return { ok: false, message: "Email hoặc mật khẩu không đúng" };
    }
    return {
        ok: true,
        user: rowToSafeClient(row as Record<string, unknown>),
        session: null,
    };
}
