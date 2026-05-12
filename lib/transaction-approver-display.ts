import type { Transaction } from "@/types/finance";

function looksLikeUuid(s: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        s.trim()
    );
}

/**
 * Hiển thị cột "Người duyệt": ưu tiên tên lưu DB, rồi map id, cuối cùng fallback hợp lý cho dữ liệu cũ / tự duyệt.
 */
export function resolveTransactionApproverDisplay(
    tx: Transaction,
    resolveUserName: (idOrName?: string) => string,
    approverNotRecordedLabel: string
): string {
    const stored = tx.approverDisplayName?.trim();
    if (stored) return stored;

    if (tx.approvedBy) {
        const n = resolveUserName(tx.approvedBy);
        if (n && n !== "-") {
            if (!looksLikeUuid(n) || n !== tx.approvedBy) return n;
        }
    }

    const settled = ["APPROVED", "PAID", "COMPLETED"].includes(tx.status);
    if (!settled) return "—";

    // Thu nhập: phiếu vào thường tự duyệt khi tạo — người lập = người duyệt thực tế
    if (tx.type === "IN") {
        const c = resolveUserName(tx.createdBy);
        if (c && c !== "-") return c;
    }

    // Chi không qua luồng chờ (warning = false): coi người lập là bên ghi nhận duyệt ban đầu
    if (tx.type === "OUT" && !tx.warning && (tx.status === "APPROVED" || tx.status === "COMPLETED")) {
        const c = resolveUserName(tx.createdBy);
        if (c && c !== "-") return c;
    }

    if (tx.status === "APPROVED") return approverNotRecordedLabel;
    if (tx.type === "OUT" && tx.warning && tx.status === "COMPLETED")
        return approverNotRecordedLabel;
    return "—";
}
