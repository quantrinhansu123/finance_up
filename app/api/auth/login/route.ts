import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
    readSupabaseAnonKey,
    readSupabaseServiceRoleKey,
    readSupabaseUrl,
} from "@/lib/supabase-env";
import { performLoginWithSupabase } from "@/lib/auth-login";

const noPersist = {
    auth: { persistSession: false, autoRefreshToken: false },
} as const;

export async function POST(req: Request) {
    const url = readSupabaseUrl();
    const anonKey = readSupabaseAnonKey();
    if (!url || !anonKey) {
        return NextResponse.json(
            { error: "Thiếu cấu hình Supabase trên server." },
            { status: 500 }
        );
    }

    let body: { email?: string; password?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    const authClient = createClient(url, anonKey, noPersist);
    const serviceKey = readSupabaseServiceRoleKey();
    const dbClient = serviceKey
        ? createClient(url, serviceKey, noPersist)
        : authClient;

    const result = await performLoginWithSupabase(
        authClient,
        email,
        password,
        dbClient
    );
    if (!result.ok) {
        const msg = result.message;
        const network =
            msg.includes("Failed to fetch") ||
            msg.includes("fetch failed") ||
            msg.includes("Không kết nối được Supabase từ máy chủ");
        return NextResponse.json(
            { error: msg },
            { status: network ? 503 : 401 }
        );
    }

    return NextResponse.json({
        user: result.user,
        access_token: result.session?.access_token ?? null,
        refresh_token: result.session?.refresh_token ?? null,
    });
}
