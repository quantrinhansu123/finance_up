"use client";

import { Account, Transaction } from "@/types/finance";
import { convertCurrency } from "@/lib/currency";
import { useMemo } from "react";

interface AccountSummaryCardProps {
    account: Account;
    transactions: Transaction[];
    rates: Record<string, number>;
    maxBalance?: number; // For progress bar comparison
}

export default function AccountSummaryCard({ 
    account, 
    transactions, 
    rates,
    maxBalance = 0 
}: AccountSummaryCardProps) {
    // Calculate period changes (this month)
    const { periodIn, periodOut, changePercent, trend } = useMemo(() => {
        const now = new Date();
        let pIn = 0;
        let pOut = 0;
        let lastMonthBalance = account.openingBalance || 0;

        // Filter transactions for this account
        const accountTxs = transactions.filter(
            tx => tx.accountId === account.id && tx.status === "APPROVED"
        );

        accountTxs.forEach(tx => {
            const d = new Date(tx.date);
            const isThisMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            const isLastMonth = d.getMonth() === now.getMonth() - 1 && d.getFullYear() === now.getFullYear();

            if (isThisMonth) {
                if (tx.type === "IN") pIn += tx.amount;
                else pOut += tx.amount;
            }

            // Calculate last month end balance
            if (isLastMonth || d < new Date(now.getFullYear(), now.getMonth(), 1)) {
                if (tx.type === "IN") lastMonthBalance += tx.amount;
                else lastMonthBalance -= tx.amount;
            }
        });

        const netChange = pIn - pOut;
        const changePercent = lastMonthBalance > 0 
            ? ((account.balance - lastMonthBalance) / lastMonthBalance * 100) 
            : 0;

        return {
            periodIn: pIn,
            periodOut: pOut,
            changePercent: changePercent.toFixed(1),
            trend: netChange >= 0 ? "up" : "down"
        };
    }, [account, transactions]);

    // Progress bar percentage
    const progressPercent = maxBalance > 0 
        ? Math.min((account.balance / maxBalance) * 100, 100) 
        : 0;

    // Gradient based on currency
    const getGradient = (currency: string) => {
        switch (currency) {
            case "USD": return "from-blue-500 to-blue-600";
            case "VND": return "from-rose-500 to-pink-600";
            case "KHR": return "from-emerald-500 to-green-600";
            default: return "from-gray-500 to-gray-600";
        }
    };

    const getProgressColor = (currency: string) => {
        switch (currency) {
            case "USD": return "bg-blue-500";
            case "VND": return "bg-rose-500";
            case "KHR": return "bg-emerald-500";
            default: return "bg-gray-500";
        }
    };

    const balanceUSD = convertCurrency(account.balance, account.currency, "USD", rates);

    return (
        <div className="glass-card rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all group">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${getGradient(account.currency)}`} />
                    <span className="text-sm font-medium text-white truncate max-w-[120px]">
                        {account.name}
                    </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-[var(--muted)]">
                    {account.type}
                </span>
            </div>

            {/* Balance */}
            <div className="mb-3">
                <div className="text-2xl font-bold text-white">
                    {account.balance.toLocaleString()}
                    <span className="text-sm text-[var(--muted)] ml-1">{account.currency}</span>
                </div>
                <div className="text-xs text-[var(--muted)]">
                    ≈ ${balanceUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} USD
                </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${getProgressColor(account.currency)} transition-all duration-500`}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-[var(--muted)]">0</span>
                    <span className="text-[10px] text-[var(--muted)]">
                        {maxBalance.toLocaleString()} {account.currency}
                    </span>
                </div>
            </div>

            {/* Change Indicator */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div className="flex items-center gap-1">
                    {trend === "up" ? (
                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        </svg>
                    )}
                    <span className={`text-sm font-medium ${trend === "up" ? "text-green-400" : "text-red-400"}`}>
                        {changePercent}%
                    </span>
                </div>
                <span className="text-[10px] text-[var(--muted)]">so với tháng trước</span>
            </div>

            {/* Mini Stats */}
            <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-green-500/10 rounded-lg p-2 text-center">
                    <div className="text-xs text-green-400">+{periodIn.toLocaleString()}</div>
                    <div className="text-[10px] text-[var(--muted)]">Vào</div>
                </div>
                <div className="bg-red-500/10 rounded-lg p-2 text-center">
                    <div className="text-xs text-red-400">-{periodOut.toLocaleString()}</div>
                    <div className="text-[10px] text-[var(--muted)]">Ra</div>
                </div>
            </div>

            {/* Lock indicator */}
            {account.isLocked && (
                <div className="absolute top-2 right-2">
                    <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                </div>
            )}
        </div>
    );
}
