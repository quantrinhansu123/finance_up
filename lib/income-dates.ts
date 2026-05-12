import type { Transaction } from "@/types/finance";

/** Ngày (YYYY-MM-DD) dùng để sắp xếp: ưu tiên ngày xác nhận Đã thu nếu có. */
export function incomePrimarySortDay(tx: Transaction): string {
    if (tx.status === "PAID" && tx.paidConfirmMeta?.at) {
        return tx.paidConfirmMeta.at.split("T")[0] || tx.date.split("T")[0];
    }
    return (tx.date || "").split("T")[0] || "";
}

/**
 * Khoảng [startDate, endDate] áp dụng cho thu: nếu có cả ngày phiếu và ngày thu thực tế (khác nhau),
 * giữ bản ghi khi một trong hai nằm trong khoảng (lấy cả hai mốc).
 */
export function incomeMatchesDateRange(tx: Transaction, startDate: string, endDate: string): boolean {
    if (!startDate && !endDate) return true;
    const posted = (tx.date || "").split("T")[0] || "";
    const actual =
        tx.status === "PAID" && tx.paidConfirmMeta?.at
            ? tx.paidConfirmMeta.at.split("T")[0] || ""
            : "";

    const within = (day: string) => {
        if (!day) return false;
        if (startDate && day < startDate) return false;
        if (endDate && day > endDate) return false;
        return true;
    };

    if (actual && actual !== posted) {
        return within(posted) || within(actual);
    }
    return within(posted);
}
