"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    CheckCircle2,
    Database,
    Loader2,
    RefreshCw,
    ShieldX,
    Wrench,
    XCircle,
} from "lucide-react";
import { getUserRole } from "@/lib/permissions";

type SupabaseDebug = {
    ok?: boolean;
    reason?: string;
    host?: string;
    bareStatus?: number;
    authStatus?: number;
    hint?: string;
};

type DbHealth = {
    ok?: boolean;
    checks?: Record<string, { ok: boolean; detail?: string }>;
    fkHint?: string;
    reason?: string;
    hint?: string;
};

const PENDING_MIGRATIONS = [
    {
        file: "20260524120000_finance_transactions_user_fk_employees.sql",
        title: "FK giao dịch → employees",
        desc: "Sửa lỗi 400 khi tạo chi/thu/chuyển tiền do FK cũ trỏ profiles.",
    },
    {
        file: "20260511220000_budget_request_flags_on_finance_transactions.sql",
        title: "Cột budget request trên finance_transactions",
        desc: "Hỗ trợ cờ is_budget_request, budget_request_source_id.",
    },
    {
        file: "20260525100000_finance_bills_storage_bucket.sql",
        title: "Bucket Storage ảnh hóa đơn",
        desc: "Upload ảnh qua Supabase khi chưa cấu hình Cloudinary (cần SUPABASE_SERVICE_ROLE_KEY trên Vercel).",
    },
];

export default function AdminToolsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [supabaseStatus, setSupabaseStatus] = useState<SupabaseDebug | null>(null);
    const [dbHealth, setDbHealth] = useState<DbHealth | null>(null);
    const [checking, setChecking] = useState(false);

    const runChecks = async () => {
        setChecking(true);
        try {
            const [supaRes, healthRes] = await Promise.all([
                fetch("/api/debug/supabase", { cache: "no-store" }),
                fetch("/api/admin/db-health", { cache: "no-store" }),
            ]);
            setSupabaseStatus(await supaRes.json());
            setDbHealth(await healthRes.json());
        } catch (e) {
            setSupabaseStatus({
                ok: false,
                reason: "fetch_failed",
                hint: e instanceof Error ? e.message : "Không gọi được API kiểm tra.",
            });
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (!raw) {
            setLoading(false);
            return;
        }

        const user = JSON.parse(raw);
        const admin = getUserRole(user) === "ADMIN";
        setIsAdmin(admin);
        setLoading(false);

        if (admin) {
            runChecks();
        }
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <Loader2 className="animate-spin text-blue-400" size={32} />
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
                <ShieldX size={64} className="text-red-400 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">Chỉ dành cho Admin</h1>
                <p className="text-[var(--muted)] mb-6">Bạn không có quyền truy cập công cụ quản trị.</p>
                <button
                    onClick={() => router.push("/finance")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                    Về Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                    <Wrench size={20} />
                    <span className="text-sm font-medium uppercase tracking-wider">Dev / Admin</span>
                </div>
                <h1 className="text-3xl font-bold text-white">Công cụ quản trị</h1>
                <p className="text-[var(--muted)] mt-1">Kiểm tra Supabase và hướng dẫn migration.</p>
            </div>

            <section className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database size={18} className="text-cyan-400" />
                        <h2 className="font-semibold">Kết nối Supabase</h2>
                    </div>
                    <button
                        onClick={runChecks}
                        disabled={checking}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={checking ? "animate-spin" : ""} />
                        Kiểm tra lại
                    </button>
                </div>

                {checking && !supabaseStatus ? (
                    <p className="text-sm text-[var(--muted)]">Đang kiểm tra...</p>
                ) : (
                    <div className="space-y-3 text-sm">
                        <StatusRow
                            label="HTTP / TLS"
                            ok={Boolean(supabaseStatus?.ok)}
                            detail={
                                supabaseStatus?.ok
                                    ? `Host: ${supabaseStatus.host} | bare: ${supabaseStatus.bareStatus} | auth: ${supabaseStatus.authStatus}`
                                    : supabaseStatus?.reason || "Lỗi"
                            }
                        />
                        {supabaseStatus?.hint && (
                            <p className="text-xs text-yellow-400/90 bg-yellow-500/10 p-3 rounded-lg">{supabaseStatus.hint}</p>
                        )}

                        {dbHealth?.checks && (
                            <div className="pt-2 border-t border-white/10 space-y-2">
                                <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Bảng dữ liệu</p>
                                {Object.entries(dbHealth.checks).map(([table, result]) => (
                                    <StatusRow
                                        key={table}
                                        label={table}
                                        ok={result.ok}
                                        detail={result.detail}
                                    />
                                ))}
                            </div>
                        )}
                        {dbHealth?.fkHint && (
                            <p className="text-xs text-amber-300/90 bg-amber-500/10 p-3 rounded-lg">{dbHealth.fkHint}</p>
                        )}
                    </div>
                )}
            </section>

            <section className="glass-card p-6 rounded-2xl border border-white/10 space-y-4">
                <h2 className="font-semibold">Migration cần chạy trên Supabase</h2>
                <p className="text-sm text-[var(--muted)]">
                    Mở Supabase Dashboard → SQL Editor → dán nội dung file trong{" "}
                    <code className="text-cyan-300">supabase/migrations/</code> → Run.
                </p>
                <ul className="space-y-3">
                    {PENDING_MIGRATIONS.map((m) => (
                        <li key={m.file} className="p-4 rounded-xl bg-white/5 border border-white/5">
                            <p className="font-mono text-xs text-cyan-300">{m.file}</p>
                            <p className="font-medium mt-1">{m.title}</p>
                            <p className="text-sm text-[var(--muted)] mt-1">{m.desc}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="glass-card p-6 rounded-2xl border border-white/10">
                <h2 className="font-semibold mb-2">CLI (tùy chọn)</h2>
                <pre className="text-xs bg-black/40 p-4 rounded-xl overflow-x-auto text-green-300">
{`cd d:\\finance_up
npx supabase db push`}
                </pre>
                <p className="text-xs text-[var(--muted)] mt-2">
                    Cần đã login Supabase CLI và link project. Chỉ dùng khi bạn quen với Supabase migrations.
                </p>
            </section>
        </div>
    );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
    return (
        <div className="flex items-start gap-2">
            {ok ? (
                <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" />
            ) : (
                <XCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            )}
            <div>
                <span className={ok ? "text-green-300" : "text-red-300"}>{label}</span>
                {detail && <p className="text-xs text-[var(--muted)] mt-0.5 break-all">{detail}</p>}
            </div>
        </div>
    );
}
