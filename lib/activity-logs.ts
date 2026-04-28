import { supabase } from "./supabase";
import type { ActivityLog } from "@/types/finance";

function rowToActivityLog(row: Record<string, unknown>): ActivityLog {
    return {
        id: String(row.id),
        action: String(row.action),
        entityType: String(row.entity_type),
        entityId: String(row.entity_id),
        userId: String(row.user_id),
        userName: String(row.user_name),
        details: String(row.details ?? ""),
        timestamp: new Date(String(row.logged_at)).getTime(),
        ip: row.ip != null ? String(row.ip) : undefined,
        location: row.location != null ? String(row.location) : undefined,
        device: row.device != null ? String(row.device) : undefined,
    };
}

export async function fetchActivityLogsPage(opts: {
    fromMs?: number;
    toMs?: number;
    limit: number;
    offset: number;
}): Promise<ActivityLog[]> {
    let q = supabase.from("finance_activity_logs").select("*").order("logged_at", { ascending: false });
    if (opts.fromMs != null) {
        q = q.gte("logged_at", new Date(opts.fromMs).toISOString());
    }
    if (opts.toMs != null) {
        q = q.lte("logged_at", new Date(opts.toMs).toISOString());
    }
    q = q.range(opts.offset, opts.offset + opts.limit - 1);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((row) => rowToActivityLog(row as Record<string, unknown>));
}

export async function fetchActivityLogsAllInRange(opts: { fromMs?: number; toMs?: number }): Promise<ActivityLog[]> {
    const pageSize = 500;
    let offset = 0;
    const all: ActivityLog[] = [];
    for (;;) {
        const batch = await fetchActivityLogsPage({ fromMs: opts.fromMs, toMs: opts.toMs, limit: pageSize, offset });
        all.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }
    return all;
}

export interface ApprovalLog {
    id: string;
    action: string;
    transactionId: string;
    userName: string;
    reason?: string;
    details?: string;
    timestamp: number;
}

export async function fetchRecentApprovalLogs(limit: number): Promise<ApprovalLog[]> {
    const { data, error } = await supabase
        .from("finance_activity_logs")
        .select("*")
        .in("action", ["APPROVE", "REJECT"])
        .order("logged_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        action: String(row.action),
        transactionId: String(row.entity_id),
        userName: String(row.user_name),
        details: String(row.details ?? ""),
        timestamp: new Date(String(row.logged_at)).getTime(),
    }));
}
