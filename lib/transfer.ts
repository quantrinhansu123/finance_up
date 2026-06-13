import { convertCurrency, ExchangeRates } from "@/lib/currency";
import { Transaction } from "@/types/finance";

export const TRANSFER_APPROVAL_USD_THRESHOLD = 1000;

export function extractTransferRef(description?: string): string | null {
    const m = (description || "").match(/\(Ref:\s*(TRF-\d+)\)/i);
    return m ? m[1] : null;
}

/** Mã tham chiếu chuyển tiền — từ transferContent hoặc description. */
export function getTransferRef(tx: Pick<Transaction, "description" | "transferContent">): string | null {
    const content = (tx.transferContent || "").trim();
    if (/^TRF-\d+$/i.test(content)) return content.toUpperCase();
    return extractTransferRef(tx.description);
}

export function isInternalTransferTransaction(tx: Transaction): boolean {
    const cat = (tx.category || "").toLowerCase();
    const byCategory =
        cat.includes("nội bộ") ||
        cat.includes("internal transfer") ||
        cat.includes("internal receive");
    const byRef = Boolean(getTransferRef(tx));
    return byCategory || byRef;
}

export function isInternalTransferOut(tx: Transaction): boolean {
    return tx.type === "OUT" && isInternalTransferTransaction(tx);
}

export function amountInUsd(amount: number, currency: string, rates: ExchangeRates): number {
    if (!amount || amount <= 0) return 0;
    return convertCurrency(amount, currency, "USD", rates);
}

export function requiresTransferApproval(
    amount: number,
    currency: string,
    rates: ExchangeRates
): boolean {
    return amountInUsd(amount, currency, rates) > TRANSFER_APPROVAL_USD_THRESHOLD;
}

export function resolveTransferProjectId(
    fromAccount?: { projectId?: string | null },
    toAccount?: { projectId?: string | null }
): string | undefined {
    const from = fromAccount?.projectId?.trim();
    const to = toAccount?.projectId?.trim();
    return from || to || undefined;
}

/** Giao dịch PENDING có thuộc phạm vi duyệt của các dự án (kể cả chuyển nội bộ không gắn project_id). */
export function transactionMatchesApprovalProjects(
    tx: Transaction,
    projectIds: string[],
    accounts: { id: string; projectId?: string | null }[]
): boolean {
    if (projectIds.length === 0) return false;
    if (tx.projectId && projectIds.includes(tx.projectId)) return true;

    for (const accountId of [tx.accountId, tx.beneficiaryAccountId]) {
        if (!accountId) continue;
        const acc = accounts.find((a) => a.id === accountId);
        if (acc?.projectId && projectIds.includes(acc.projectId)) return true;
    }
    return false;
}

export function findPairedTransferIn(
    allTransactions: Transaction[],
    outTx: Transaction
): Transaction | undefined {
    const ref = getTransferRef(outTx);
    if (!ref) return undefined;

    const destAccountId = outTx.beneficiaryAccountId;
    const candidates = allTransactions.filter((t) => {
        if (t.type !== "IN" || t.id === outTx.id) return false;
        if (getTransferRef(t) !== ref) return false;
        if (destAccountId && t.accountId && t.accountId !== destAccountId) return false;
        return true;
    });

    if (candidates.length === 0) return undefined;
    return candidates.find((t) => t.status === outTx.status) ?? candidates[0];
}
