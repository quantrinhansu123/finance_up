import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseAnonKey, readSupabaseUrl } from "@/lib/supabase-env";

/** Kiểm tra kết nối DB — dùng từ browser khi trang trống / lỗi mạng. */
export async function GET() {
    const url = readSupabaseUrl();
    const key = readSupabaseAnonKey();

    if (!url || !key) {
        return NextResponse.json({
            ok: false,
            reason: "missing_env",
            hint: "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env — restart npm run dev sau khi sửa.",
        });
    }

    try {
        const client = createClient(url, key);
        const tables = ["employees", "finance_accounts", "finance_transactions", "finance_projects"] as const;
        const counts: Record<string, number | string> = {};

        for (const table of tables) {
            const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
            counts[table] = error ? `ERR: ${error.message}` : (count ?? 0);
        }

        const ok = Object.values(counts).every((v) => typeof v === "number");
        return NextResponse.json({
            ok,
            host: new URL(url).hostname,
            counts,
            hint: ok ? undefined : "Một số bảng không truy cập được — kiểm tra RLS hoặc migration trên Supabase.",
        });
    } catch (e) {
        return NextResponse.json({
            ok: false,
            reason: "fetch_failed",
            hint: e instanceof Error ? e.message : "Không kết nối được Supabase từ server.",
        });
    }
}
