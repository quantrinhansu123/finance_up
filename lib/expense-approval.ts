import { convertCurrency, ExchangeRates } from "@/lib/currency";

/** Ngưỡng phiếu chi cần phê duyệt (lớn hơn mức này → PENDING). */
export const EXPENSE_APPROVAL_THRESHOLDS = {
    USD: 1_000,
    VND: 20_000_000,
    KHR: 5_000_000,
    TRY: 1_000,
} as const;

export function formatExpenseApprovalThreshold(currency: string): string {
    const cur = (currency || "USD").toUpperCase();
    if (cur === "VND") return "20.000.000 VND";
    if (cur === "KHR") return "5.000.000 KHR";
    if (cur === "TRY") return "1.000 TRY";
    return "$1.000";
}

export function requiresExpenseApproval(
    amount: number,
    currency: string,
    rates?: ExchangeRates
): boolean {
    const num = Number(amount) || 0;
    if (num <= 0) return false;
    const cur = (currency || "USD").toUpperCase();

    if (cur === "VND") return num > EXPENSE_APPROVAL_THRESHOLDS.VND;
    if (cur === "KHR") return num > EXPENSE_APPROVAL_THRESHOLDS.KHR;
    if (cur === "USD" || cur === "TRY") return num > EXPENSE_APPROVAL_THRESHOLDS.USD;

    if (rates && Object.keys(rates).length > 1) {
        return convertCurrency(num, cur, "USD", rates) > EXPENSE_APPROVAL_THRESHOLDS.USD;
    }
    return num > EXPENSE_APPROVAL_THRESHOLDS.USD;
}

export function isHighValueExpense(tx: { type?: string; amount: number; currency: string }): boolean {
    if (tx.type && tx.type !== "OUT") return false;
    return requiresExpenseApproval(tx.amount, tx.currency);
}
