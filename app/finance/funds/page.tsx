"use client";

import { useState, useEffect, useMemo } from "react";
import { Fund, Transaction } from "@/types/finance";
import { getTransactions, getFunds, deleteFund } from "@/lib/finance";
import FundModal from "@/components/finance/FundModal";
import { History, X, Edit2, Trash2 } from "lucide-react";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { ActionCell } from "@/components/finance/DataTable";

export default function FundsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [funds, setFunds] = useState<Fund[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        month: new Date().toISOString().slice(0, 7)
    });
    const [searchTerm, setSearchTerm] = useState("");

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
        return txs.filter(tx => tx.date.startsWith(activeFilters.month));
    };

    // Calculate Stats
    const filteredTxs = filterByMonth(transactions);

    const getFundStats = (fund: Fund) => {
        const fundTxs = filteredTxs.filter(t =>
            t.fundId === fund.id &&
            t.type === "OUT" &&
            t.status === "APPROVED"
        );

        const spent = fundTxs.reduce((sum, t) => sum + t.amount, 0);
        return { spent, txs: fundTxs };
    };

    // Filtered Funds
    const filteredFunds = useMemo(() => {
        return funds.filter(f =>
            f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (f.description || "").toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [funds, searchTerm]);

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

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Bạn có chắc muốn xóa quỹ này? Hành động này không thể hoàn tác.")) return;
        try {
            await deleteFund(id);
            fetchData();
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Xóa thất bại");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Quỹ & Nhóm Chi Phí</h1>
                    <p className="text-[var(--muted)]">Quản lý ngân sách và phân bổ chi phí</p>
                </div>
            </div>

            <DataTableToolbar
                searchPlaceholder="Tìm tên quỹ..."
                onSearch={setSearchTerm}
                activeFilters={activeFilters}
                onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                onReset={() => {
                    setActiveFilters({ month: new Date().toISOString().slice(0, 7) });
                    setSearchTerm("");
                }}
                onExport={() => exportToCSV(filteredFunds, "Danh_Sach_Quy", {
                    name: "Tên quỹ",
                    description: "Mô tả",
                    targetBudget: "Ngân sách",
                    keywords: "Từ khóa"
                })}
                onAdd={handleCreate}
                addLabel="Tạo Quỹ mới"
                filters={[
                    {
                        id: "month",
                        label: "Tháng báo cáo",
                        options: Array.from(new Set(transactions.map(t => t.date.slice(0, 7)))).sort().reverse().map(m => ({ value: m, label: m }))
                    }
                ]}
            />

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
                                <th className="p-4 border-b border-white/10 text-center w-24">Actions</th>
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
                                filteredFunds.map((fund) => {
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
                                            <td className="p-4">
                                                <div className="flex items-center gap-1 justify-center">
                                                    <button
                                                        onClick={(e) => handleEdit(e, fund)}
                                                        className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-yellow-400 transition-colors"
                                                        title="Sửa"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(e, fund.id)}
                                                        className="p-1.5 rounded hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-colors"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDetailFund(fund); }}
                                                        className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors"
                                                        title="Xem lịch sử"
                                                    >
                                                        <History size={14} />
                                                    </button>
                                                </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-2xl p-6 rounded-2xl relative max-h-[80vh] flex flex-col">
                        <button onClick={() => setDetailFund(null)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors">
                            <X size={20} />
                        </button>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white mb-1">{detailFund.name}</h2>
                            <p className="text-[var(--muted)]">Giao dịch tháng {activeFilters.month}</p>
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
