"use client";

import { useState, useMemo } from "react";
import { Transaction } from "@/types/finance";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ITEMS_PER_PAGE = 15;

interface TransactionListProps {
    transactions: Transaction[];
}

export default function TransactionList({ transactions }: TransactionListProps) {
    const [currentPage, setCurrentPage] = useState(1);

    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
    const paginatedTransactions = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return transactions.slice(start, start + ITEMS_PER_PAGE);
    }, [transactions, currentPage]);

    // Reset page when transactions change
    useMemo(() => {
        setCurrentPage(1);
    }, [transactions.length]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("vi-VN");
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
        }).format(amount);
    };

    return (
        <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-[var(--card-hover)] text-[var(--muted)]">
                    <tr>
                        <th className="p-4 w-12">#</th>
                        <th className="p-4">Date</th>
                        <th className="p-4 text-right">Amount</th>
                        <th className="p-4">Source/Cat</th>
                        <th className="p-4">Account</th>
                        <th className="p-4">Project</th>
                        <th className="p-4">User</th>
                        <th className="p-4 text-center">Img</th>
                        <th className="p-4 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--card-border)]">
                    {paginatedTransactions.map((tx, index) => (
                        <tr key={tx.id} className="hover:bg-[var(--card-hover)] transition-colors">
                            <td className="p-4 text-[var(--muted)]">{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</td>
                            <td className="p-4">{formatDate(tx.date)}</td>
                            <td className={`p-4 text-right font-medium ${tx.type === "IN" ? "text-green-400" : "text-red-400"}`}>
                                {tx.type === "OUT" ? "-" : "+"}{formatCurrency(tx.amount, tx.currency)}
                            </td>
                            <td className="p-4">
                                <div className="font-medium text-white">{tx.type === "IN" ? tx.source : tx.category}</div>
                                <div className="text-xs text-[var(--muted)] truncate max-w-[150px]">{tx.description}</div>
                            </td>
                            {/* Account ID is usually resolved to Name in parent or we need to pass accounts map. 
                                For now displaying ID or simple lookup if passed. 
                                Assuming we don't have account name in TX object, we might show truncated ID or fetch map.
                                Let's truncate ID for now to avoid complexity in this file, or better, assuming the parent might inject names later.
                                Actually, existing code just showed category. Let's show ID for now. */}
                            <td className="p-4 text-[var(--muted)] text-xs">{tx.accountId?.slice(0, 8)}...</td>
                            <td className="p-4 text-[var(--muted)] text-xs">{tx.projectId ? "Project " + tx.projectId.slice(0, 4) : "-"}</td>
                            <td className="p-4 text-xs">{tx.createdBy}</td>
                            <td className="p-4 text-center">
                                {tx.images && tx.images.length > 0 ? (
                                    <div className="flex justify-center gap-1">
                                        {tx.images.map((img, i) => (
                                            <a key={i} href={img} target="_blank" rel="noreferrer" className="text-lg hover:text-blue-400 transition-colors" title="View Image">
                                                📎
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-[var(--muted)]">-</span>
                                )}
                            </td>
                            <td className="p-4 text-center">
                                <span
                                    className={`px-2 py-1 rounded text-xs font-medium ${tx.status === "APPROVED"
                                        ? "bg-blue-500/20 text-blue-300"
                                        : tx.status === "PENDING"
                                            ? "bg-yellow-500/20 text-yellow-300"
                                            : "bg-red-500/20 text-red-300"
                                        }`}
                                >
                                    {tx.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {paginatedTransactions.length === 0 && (
                        <tr>
                            <td colSpan={9} className="p-8 text-center text-[var(--muted)]">Không tìm thấy giao dịch</td>
                        </tr>
                    )}
                </tbody>
            </table>
            
            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t border-white/10">
                    <div className="text-sm text-[var(--muted)]">
                        Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)} / {transactions.length} giao dịch
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (currentPage <= 3) {
                                pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = currentPage - 2 + i;
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                        currentPage === pageNum 
                                            ? "bg-blue-500 text-white" 
                                            : "hover:bg-white/5 text-[var(--muted)]"
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-lg hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
