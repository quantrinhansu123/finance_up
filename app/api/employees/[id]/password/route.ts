import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readSupabaseServiceRoleKey, readSupabaseUrl } from "@/lib/supabase-env";

const noPersist = {
    auth: { persistSession: false, autoRefreshToken: false },
} as const;

function extractMissingColumn(error: unknown): string | null {
    if (!error || typeof error !== "object") return null;
    const msg = String((error as { message?: unknown }).message || "");
    const match = msg.match(/Could not find the '([^']+)' column/i);
    return match ? match[1] : null;
}

async function updatePasswordWithRetry(
    employeeId: string,
    plainPassword: string
): Promise<void> {
    const url = readSupabaseUrl();
    const key = readSupabaseServiceRoleKey();
    if (!url || !key) {
        throw new Error(
            "Thiếu SUPABASE_SERVICE_ROLE_KEY trên server — không thể lưu mật khẩu an toàn."
        );
    }
    const db = createClient(url, key, noPersist);
    const data: Record<string, string> = {
        pass: plainPassword,
        password: plainPassword,
    };
    for (let i = 0; i < 8; i++) {
        const { error } = await db.from("employees").update(data).eq("id", employeeId);
        if (!error) return;
        const missing = extractMissingColumn(error);
        if (!missing || !(missing in data)) {
            throw new Error(error.message || "Lỗi cập nhật mật khẩu");
        }
        delete data[missing];
    }
    throw new Error("Không thể cập nhật mật khẩu (schema employees).");
}

export async function PATCH(
    req: Request,
    ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
    const { id } = await ctx.params;
    if (!id) {
        return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
    }

    let body: { password?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const password = typeof body.password === "string" ? body.password.trim() : "";
    if (!password) {
        return NextResponse.json({ error: "Mật khẩu không được để trống" }, { status: 400 });
    }

    try {
        await updatePasswordWithRetry(id, password);
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Lỗi lưu mật khẩu";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
