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
    return out;
}

/** ILIKE đúng một chuỗi (tránh % _ làm wildcard). */
function escapeIlikeExact(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
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

    const { data: rows, error: qErr } = await db
        .from("employees")
        .select("*")
        .ilike("email", escapeIlikeExact(em))
        .limit(15);
    if (qErr) return { ok: false, message: formatLoginDbError(qErr) };

    const list = rows || [];
    if (list.length === 0) {
        return { ok: false, message: "Email hoặc mật khẩu không đúng" };
    }
    const row = list.find(
        (r) =>
            (r as Record<string, unknown>).pass === password ||
            (r as Record<string, unknown>).password === password
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
