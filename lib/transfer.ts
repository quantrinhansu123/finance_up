import { convertCurrency, ExchangeRates } from "@/lib/currency";
import { Transaction } from "@/types/finance";

export const TRANSFER_APPROVAL_USD_THRESHOLD = 1000;

export function extractTransferRef(description?: string): string | null {
    const m = (description || "").match(/\(Ref:\s*(TRF-\d+)\)/i);
    return m ? m[1] : null;
}

export function isInternalTransferTransaction(tx: Transaction): boolean {
    const cat = (tx.category || "").toLowerCase();
    const byCategory =
        cat.includes("nội bộ") ||
        cat.includes("internal transfer") ||
        cat.includes("internal receive");
    const byRef = Boolean(extractTransferRef(tx.description));
    return byCategory || byRef;
}

export function isInternalTransferOut(tx: Transaction): boolean {
    return tx.type === "OUT" && isInternalTransferTransaction(tx);
}

export function requiresTransferApproval(
    amount: number,
    currency: string,
    rates: ExchangeRates
): boolean {
    if (!amount || amount <= 0) return false;
    const usdAmount = convertCurrency(amount, currency, "USD", rates);
    return usdAmount > TRANSFER_APPROVAL_USD_THRESHOLD;
}

export function findPairedTransferIn(
    allTransactions: Transaction[],
    outTx: Transaction
): Transaction | undefined {
    const ref = extractTransferRef(outTx.description);
    if (!ref) return undefined;

    const destAccountId = outTx.beneficiaryAccountId;
    return allTransactions.find(
        (t) =>
            t.type === "IN" &&
            t.status === outTx.status &&
            (destAccountId ? t.accountId === destAccountId : true) &&
            extractTransferRef(t.description) === ref
    );
}
