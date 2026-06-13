"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type HealthPayload = {
    ok?: boolean;
    reason?: string;
    hint?: string;
    counts?: Record<string, number | string>;
    host?: string;
};

export default function DataConnectionAlert() {
    const [health, setHealth] = useState<HealthPayload | null>(null);
    const [checking, setChecking] = useState(true);

    const runCheck = async () => {
        setChecking(true);
        try {
            const res = await fetch("/api/health/data", { cache: "no-store" });
            setHealth(await res.json());
        } catch (e) {
            setHealth({
                ok: false,
                reason: "network",
                hint: e instanceof Error ? e.message : "Không gọi được API kiểm tra dữ liệu.",
            });
        } finally {
            setChecking(false);
        }
    };

    useEffect(() => {
        runCheck();
    }, []);

    if (checking || health?.ok) return null;

    return (
        <div className="mx-4 md:mx-8 mt-4 p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-3 flex-1">
                <AlertTriangle className="shrink-0 text-red-400 mt-0.5" size={20} />
                <div className="text-sm">
                    <p className="font-semibold text-red-200">Không kết nối được dữ liệu Supabase</p>
                    <p className="text-red-200/80 mt-1">{health?.hint || health?.reason || "Kiểm tra file .env và kết nối mạng."}</p>
                    {health?.counts && (
                        <p className="text-xs text-red-200/60 mt-2 font-mono break-all">
                            {JSON.stringify(health.counts)}
                        </p>
                    )}
                </div>
            </div>
            <button
                type="button"
                onClick={runCheck}
                className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-sm font-medium"
            >
                <RefreshCw size={14} />
                Thử lại
            </button>
        </div>
    );
}
