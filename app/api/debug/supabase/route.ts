import { NextResponse } from "next/server";
import { readSupabaseAnonKey, readSupabaseUrl } from "@/lib/supabase-env";

/**
 * Chỉ dùng khi dev: kiểm tra process Next có gọi được Supabase không (không lộ key trong response).
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
            hint: "Thiếu NEXT_PUBLIC_* hoặc VITE_SUPABASE_* trong .env — restart npm run dev sau khi sửa.",
        });
    }

    const base = url.replace(/\/$/, "");
    let host = "";
    try {
        host = new URL(base).hostname;
    } catch {
        return NextResponse.json({
            ok: false,
            reason: "bad_url",
            hint: "NEXT_PUBLIC_SUPABASE_URL / VITE_SUPABASE_URL không phải URL hợp lệ.",
        });
    }

    if (/your-project-ref|example\.supabase\.co/i.test(host)) {
        return NextResponse.json({
            ok: false,
            reason: "placeholder_url",
            host,
            hint: "URL vẫn là mẫu tài liệu — đổi trong .env thành https://<ref>.supabase.co của project thật, rồi restart npm run dev.",
        });
    }

    const serializeErr = (e: unknown) => {
        if (!(e instanceof Error)) return { message: String(e) };
        const o: Record<string, string> = { message: e.message, name: e.name };
        const c = e.cause;
        if (c instanceof Error) {
            o.causeMessage = c.message;
            o.causeName = c.name;
            const anyC = c as unknown as { code?: string };
            if (anyC.code) o.causeCode = String(anyC.code);
        } else if (c != null) {
            o.cause = String(c);
        }
        return o;
    };

    const fetchOpts: RequestInit = {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
    };

    try {
        const bare = await fetch(`${base}/rest/v1/`, fetchOpts);
        const withKey = await fetch(`${base}/rest/v1/`, {
            ...fetchOpts,
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
            },
        });
        return NextResponse.json({
            ok: true,
            host,
            bareStatus: bare.status,
            authStatus: withKey.status,
            hint:
                bare.status === 401 || bare.ok || bare.status === 404
                    ? "Kết nối TLS + HTTP OK. Nếu login vẫn lỗi, xem RLS/policy bảng employees."
                    : "Có phản hồi HTTP; kiểm tra project Supabase (pause, region).",
        });
    } catch (e: unknown) {
        const aborted =
            e instanceof Error &&
            (e.name === "AbortError" ||
                (e.cause instanceof Error && e.cause.name === "AbortError") ||
                (typeof DOMException !== "undefined" &&
                    e.cause instanceof DOMException &&
                    e.cause.name === "TimeoutError"));
        return NextResponse.json({
            ok: false,
            reason: "fetch_failed",
            host,
            ...serializeErr(e),
            hint: aborted
                ? "Hết thời gian chờ (12s) — thường do firewall/VPN/proxy chặn HTTPS ra ngoài cho Node, hoặc DNS chậm. Thử tắt VPN cho node.exe, set HTTPS_PROXY, hoặc: node -e \"fetch('URL/rest/v1/').then(r=>console.log(r.status))\""
                : "Thử: npm run dev (đã bật ipv4first). ENOTFOUND = sai URL/SaaS ref hoặc DNS lỗi. ETIMEDOUT/ECONNREFUSED = firewall/VPN. Có thể set HTTPS_PROXY. So sánh: node -e \"fetch('URL/rest/v1/').then(r=>console.log(r.status))\"",
        });
    }
}
