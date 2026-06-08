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

    const probeTable = async (label: string, table: string) => {
        try {
            const { error } = await client.from(table).select("id").limit(1);
            checks[label] = error
                ? { ok: false, detail: error.message }
                : { ok: true };
        } catch (e) {
            checks[label] = { ok: false, detail: e instanceof Error ? e.message : String(e) };
        }
    };

    await probeTable("employees", "employees");
    await probeTable("finance_accounts", "finance_accounts");
    await probeTable("finance_transactions", "finance_transactions");
    await probeTable("finance_projects", "finance_projects");

    const ok = Object.values(checks).every((c) => c.ok);
    const fkHint = !checks.employees?.ok || !checks.finance_transactions?.ok
        ? "Kiểm tra migration và RLS trên Supabase."
        : checks.finance_transactions?.ok
            ? "Nếu tạo giao dịch lỗi FK profiles: chạy migration 20260524120000_finance_transactions_user_fk_employees.sql trong SQL Editor."
            : undefined;

    return NextResponse.json({ ok, checks, fkHint });
}
