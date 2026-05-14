import type { Transaction } from "@/types/finance";

/** Ngày (YYYY-MM-DD) dùng để sắp xếp phiếu thu. */
export function incomePrimarySortDay(tx: Transaction): string {
    return (tx.date || "").split("T")[0] || "";
}

/** Khoảng [startDate, endDate] áp dụng theo ngày tạo phiếu thu. */
export function incomeMatchesDateRange(tx: Transaction, startDate: string, endDate: string): boolean {
    if (!startDate && !endDate) return true;
    const posted = (tx.date || "").split("T")[0] || "";

    const within = (day: string) => {
        if (!day) return false;
        if (startDate && day < startDate) return false;
        if (endDate && day > endDate) return false;
        return true;
    };

    return within(posted);
}
