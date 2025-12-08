"use client";

import { useState, useEffect } from "react";
import { Fund, Transaction } from "@/types/finance";
import { getTransactions, getFunds } from "@/lib/finance";
import FundModal from "@/components/finance/FundModal";

export default function FundsPage() {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [funds, setFunds] = useState<Fund[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFund, setEditingFund] = useState<Fund | null>(null);
    const [detailFund, setDetailFund] = useState<Fund | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [fundsData, txs] = await Promise.all([getFunds(), getTransactions()]);
            setFunds(fundsData);
            setTransactions(txs);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Helper: Filter transactions by selected month
    const filterByMonth = (txs: Transaction[]) => {
        return txs.filter(tx => tx.date.startsWith(selectedMonth));
    };

    // Calculate Stats
    const filteredTxs = filterByMonth(transactions);
    const totalSystemExpense = filteredTxs
        .filter(t => t.type === "OUT" && t.status === "APPROVED")
        .reduce((sum, t) => sum + t.amount, 0);

    const getFundStats = (fund: Fund) => {
        const fundTxs = filteredTxs.filter(t =>
            t.fundId === fund.id &&
            t.type === "OUT" &&
            t.status === "APPROVED"
        );

        const spent = fundTxs.reduce((sum, t) => sum + t.amount, 0);
        return { spent, txs: fundTxs };
    };

    const handleEdit = (e: React.MouseEvent, fund: Fund) => {
        e.stopPropagation();
        setEditingFund(fund);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingFund(null);
        setIsModalOpen(true);
    };

    const handleRowClick = (fund: Fund) => {
        setDetailFund(fund);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Quỹ & Nhóm Chi Phí</h1>
                    <p className="text-[var(--muted)]">Quản lý ngân sách và phân bổ chi phí</p>
                </div>
                <div className="flex gap-3">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="glass-input px-4 py-2 rounded-xl"
                    />
                    <button
                        onClick={handleCreate}
                        className="glass-button px-6 py-2 rounded-xl font-medium bg-blue-600 hover:bg-blue-500 text-white border-none"
                    >
                        + Tạo Quỹ
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] uppercase text-xs font-semibold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-white/10">Tên quỹ</th>
                                <th className="p-4 border-b border-white/10 text-right">Ngân sách</th>
                                <th className="p-4 border-b border-white/10 text-right">Đã chi (Tháng)</th>
                                <th className="p-4 border-b border-white/10 text-right">% Sử dụng</th>
                                <th className="p-4 border-b border-white/10">Từ khóa</th>
                                <th className="p-4 border-b border-white/10 text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--muted)]">Đang tải dữ liệu...</td>
                                </tr>
                            ) : funds.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[var(--muted)]">Chưa có quỹ nào. Hãy tạo quỹ mới.</td>
                                </tr>
                            ) : (
                                funds.map((fund) => {
                                    const { spent } = getFundStats(fund);
                                    const pctBudget = fund.targetBudget && fund.targetBudget > 0
                                        ? (spent / fund.targetBudget) * 100
                                        : 0;

                                    return (
                                        <tr
                                            key={fund.id}
                                            className="hover:bg-white/5 transition-colors cursor-pointer group"
                                            onClick={() => handleRowClick(fund)}
                                        >
                                            <td className="p-4 font-medium text-white">
                                                {fund.name}
                                                <div className="text-xs text-[var(--muted)] font-normal line-clamp-1 max-w-[200px] mt-0.5">
                                                    {fund.description || ""}
                                                </div>
                                            </td>
                                            <td className="p-4 text-right text-[var(--muted)]">
                                                {fund.targetBudget ? `$${fund.targetBudget.toLocaleString()}` : "∞"}
                                            </td>
                                            <td className="p-4 text-right font-medium text-white">
                                                ${spent.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className={`text-xs ${pctBudget > 100 ? "text-red-400" : pctBudget > 80 ? "text-yellow-400" : "text-green-400"}`}>
                                                        {pctBudget.toFixed(1)}%
                                                    </span>
                                                    {fund.targetBudget && fund.targetBudget > 0 && (
                                                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${pctBudget > 100 ? "bg-red-500" : pctBudget > 80 ? "bg-yellow-500" : "bg-green-500"}`}
                                                                style={{ width: `${Math.min(pctBudget, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {fund.keywords && fund.keywords.length > 0 ? (
                                                        fund.keywords.slice(0, 3).map(k => (
                                                            <span key={k} className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-[var(--muted)]">
                                                                {k}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] text-[var(--muted)] italic">-</span>
                                                    )}
                                                    {fund.keywords && fund.keywords.length > 3 && (
                                                        <span className="text-[10px] text-[var(--muted)]">+{fund.keywords.length - 3}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={(e) => handleEdit(e, fund)}
                                                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 p-2 rounded transition-all"
                                                >
                                                    Sửa
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Fund Detail Transaction Modal */}
            {detailFund && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-2xl p-6 rounded-2xl relative max-h-[80vh] flex flex-col">
                        <button onClick={() => setDetailFund(null)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white">✕</button>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white mb-1">{detailFund.name}</h2>
                            <p className="text-[var(--muted)]">Giao dịch tháng {selectedMonth}</p>
                        </div>

                        <div className="overflow-y-auto flex-1 pr-2">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#1a1a1a] text-[var(--muted)] sticky top-0 backdrop-blur-md uppercase text-xs font-semibold tracking-wider">
                                    <tr>
                                        <th className="p-3 border-b border-white/10">Ngày</th>
                                        <th className="p-3 border-b border-white/10">Mô tả / Danh mục</th>
                                        <th className="p-3 border-b border-white/10 text-right">Số tiền</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {getFundStats(detailFund).txs
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((tx) => (
                                            <tr key={tx.id} className="hover:bg-white/5">
                                                <td className="p-3 text-[var(--muted)]">{new Date(tx.date).toLocaleDateString()}</td>
                                                <td className="p-3">
                                                    <div className="text-white">{tx.category}</div>
                                                    <div className="text-xs text-[var(--muted)] truncate max-w-[200px]">{tx.description || "-"}</div>
                                                </td>
                                                <td className="p-3 text-right font-bold text-white">
                                                    {tx.amount.toLocaleString()} <span className="text-xs font-normal text-[var(--muted)]">{tx.currency}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    {getFundStats(detailFund).txs.length === 0 && (
                                        <tr><td colSpan={3} className="p-8 text-center text-[var(--muted)]">Không có giao dịch trong tháng này</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                            <span className="text-[var(--muted)]">Tổng chi tháng này:</span>
                            <span className="text-xl font-bold text-red-400">
                                {getFundStats(detailFund).spent.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            <FundModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchData}
                fund={editingFund}
            />
        </div>
    );
}
