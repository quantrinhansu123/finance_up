import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseAnonKey, readSupabaseUrl } from "@/lib/supabase-env";

/**
 * Kiểm tra nhanh kết nối DB và các bảng cốt lõi (chỉ dev).
 */
export async function GET() {
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = readSupabaseUrl();
    const key = readSupabaseAnonKey();
    if (!url || !key) {
        return NextResponse.json({
            ok: false,
            reason: "missing_env",
            hint: "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env",
        });
    }

    const client = createClient(url, key);
    const checks: Record<string, { ok: boolean; detail?: string }> = {};

    const probe = async (label: string, run: () => Promise<{ error: { message: string } | null }>) => {
        try {
            const { error } = await run();
            checks[label] = error
                ? { ok: false, detail: error.message }
                : { ok: true };
        } catch (e) {
            checks[label] = { ok: false, detail: e instanceof Error ? e.message : String(e) };
        }
    };

    await probe("employees", () => client.from("employees").select("id").limit(1));
    await probe("finance_accounts", () => client.from("finance_accounts").select("id").limit(1));
    await probe("finance_transactions", () => client.from("finance_transactions").select("id").limit(1));
    await probe("finance_projects", () => client.from("finance_projects").select("id").limit(1));

    const ok = Object.values(checks).every((c) => c.ok);
    const fkHint = !checks.employees?.ok || !checks.finance_transactions?.ok
        ? "Kiểm tra migration và RLS trên Supabase."
        : checks.finance_transactions?.ok
            ? "Nếu tạo giao dịch lỗi FK profiles: chạy migration 20260524120000_finance_transactions_user_fk_employees.sql trong SQL Editor."
            : undefined;

    return NextResponse.json({ ok, checks, fkHint });
}
