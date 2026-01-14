"use client";

import { useState, useEffect } from "react";
import { getFixedCosts, createFixedCost, createTransaction, getAccounts, deleteFixedCost } from "@/lib/finance";
import { FixedCost, Currency, Account } from "@/types/finance";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CurrencyInput from "@/components/finance/CurrencyInput";
import { Plus, Eye, Edit2, Trash2, Zap, X, Save } from "lucide-react";

const CURRENCY_COLORS: Record<string, string> = {
    "VND": "#ef4444",
    "USD": "#3b82f6",
    "KHR": "#22c55e",
    "TRY": "#f59e0b"
};

export default function FixedCostsPage() {
    const [costs, setCosts] = useState<FixedCost[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState<FixedCost | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Form State
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [cycle, setCycle] = useState<FixedCost["cycle"]>("MONTHLY");
    const [selectedAccountId, setSelectedAccountId] = useState("");


    const fetchData = async () => {
        setLoading(true);
        try {
            const [costsData, accountsData] = await Promise.all([
                getFixedCosts(),
                getAccounts()
            ]);
            setCosts(costsData);
            setAccounts(accountsData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setSelectedCost(null);
        setName("");
        setAmount("");
        setCurrency("USD");
        setCycle("MONTHLY");
        setSelectedAccountId("");
        setIsModalOpen(true);
    };

    const openEditModal = (cost: FixedCost) => {
        setSelectedCost(cost);
        setName(cost.name);
        setAmount(cost.amount.toString());
        setCurrency(cost.currency);
        setCycle(cost.cycle);
        setSelectedAccountId(cost.accountId || "");
        setIsEditModalOpen(true);
    };

    const openViewModal = (cost: FixedCost) => {
        setSelectedCost(cost);
        setIsViewModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (selectedCost) {
                // UPDATE
                const updates = {
                    name,
                    amount: parseFloat(amount),
                    currency,
                    cycle,
                    accountId: selectedAccountId || undefined,
                };
                await handleUpdate(selectedCost.id, updates);
                setIsEditModalOpen(false);
            } else {
                // CREATE
                await createFixedCost({
                    name,
                    amount: parseFloat(amount),
                    currency,
                    cycle,
                    status: "ON",
                    description: "",
                    accountId: selectedAccountId || undefined,
                    category: "Chi phí cố định" as any,
                });
                setIsModalOpen(false);
            }
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    // Inline Updates
    const handleUpdate = async (id: string, updates: Partial<FixedCost>) => {
        try {
            let finalUpdates = { ...updates };

            // Sync currency if account is changed
            if (updates.accountId) {
                const account = accounts.find(a => a.id === updates.accountId);
                if (account) {
                    finalUpdates.currency = account.currency;
                }
            }

            // Optimistic Update
            setCosts(prev => prev.map(c => c.id === id ? { ...c, ...finalUpdates } : c));

            const ref = doc(db, "finance_fixed_costs", id);
            await updateDoc(ref, finalUpdates);
        } catch (error) {
            console.error("Update failed", error);
            fetchData(); // Revert on failure
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa chi phí này?")) return;
        try {
            await deleteFixedCost(id);
            setCosts(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error("Delete failed", error);
            alert("Xóa thất bại");
        }
    };

    const formatCurrency = (amount: number, currency: string) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency,
        }).format(amount);
    };

    const generateTransactions = async () => {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        // Filter valid costs
        const activeCosts = costs.filter(c => c.status === "ON");
        const pendingGeneration = activeCosts.filter(c => c.lastGenerated !== currentMonth);

        if (pendingGeneration.length === 0) {
            alert("Đã tạo giao dịch cho tất cả chi phí cố định trong tháng này rồi!");
            return;
        }

        if (!confirm(`Hệ thống sẽ tạo ${pendingGeneration.length} giao dịch PENDING cho tháng ${currentMonth}. Tiếp tục?`)) return;

        setLoading(true);
        try {
            let count = 0;
            for (const cost of pendingGeneration) {
                // Create Transaction
                await createTransaction({
                    type: "OUT",
                    amount: cost.amount,
                    currency: cost.currency,
                    category: "Chi phí cố định" as any,
                    accountId: cost.accountId || "unknown", // Use assigned account or unknown
                    description: `Chi phí cố định: ${cost.name} (${cost.cycle})`,
                    date: new Date().toISOString(),
                    status: "PENDING",
                    createdBy: "System",
                    userId: "system",
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });

                // Update lastGenerated
                await updateDoc(doc(db, "finance_fixed_costs", cost.id), {
                    lastGenerated: currentMonth
                });

                count++;
            }
            alert(`Đã tạo thành công ${count} giao dịch. Vui lòng vào trang Duyệt để gán tài khoản.`);
            fetchData();
        } catch (error) {
            console.error("Generation failed", error);
            alert("Có lỗi xảy ra khi tạo giao dịch");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Chi Phí Cố Định</h1>
                    <p className="text-[var(--muted)]">Quản lý các khoản chi định kỳ (Thuê nhà, Lương, Server...)</p>
                </div>
                <div className="flex gap-4">

                    <button
                        onClick={generateTransactions}
                        disabled={loading}
                        className="glass-button px-4 py-2 rounded-lg font-medium bg-white/5 hover:bg-white/10 flex items-center gap-2 text-xs transition-colors"
                    >
                        <Zap size={14} className="text-yellow-400" />
                        Tạo giao dịch tháng này
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors border-none"
                    >
                        <Plus size={14} /> Thêm Chi Phí
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] uppercase text-xs font-semibold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-white/10">Tên khoản chi</th>
                                <th className="p-4 border-b border-white/10">Số tiền</th>
                                <th className="p-4 border-b border-white/10">Chu kỳ</th>
                                <th className="p-4 border-b border-white/10">Tài khoản trả</th>
                                <th className="p-4 border-b border-white/10 text-center">Trạng thái</th>
                                <th className="p-4 border-b border-white/10">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {costs.map((cost) => (
                                <tr key={cost.id} className="hover:bg-white/5 transition-colors">
                                    {/* Tên khoản chi */}
                                    <td className="p-4">
                                        <div className="font-bold text-white">{cost.name}</div>
                                    </td>
                                    {/* Số tiền */}
                                    <td className="p-4">
                                        <div className="text-white">
                                            {new Intl.NumberFormat('vi-VN').format(cost.amount)}
                                            <span className="text-[10px] ml-1 opacity-60" style={{ color: CURRENCY_COLORS[cost.currency] }}>{cost.currency}</span>
                                        </div>
                                    </td>
                                    {/* Chu kỳ */}
                                    <td className="p-4">
                                        <span className="text-xs px-2 py-1 bg-white/5 rounded-full text-white/70">
                                            {cost.cycle === "MONTHLY" ? "Hàng tháng" : cost.cycle === "QUARTERLY" ? "Hàng quý" : "Hàng năm"}
                                        </span>
                                    </td>
                                    {/* Tài khoản trả */}
                                    <td className="p-4">
                                        <div className="text-xs text-white/60">
                                            {accounts.find(a => a.id === cost.accountId)?.name || "Chưa gán"}
                                        </div>
                                    </td>
                                    {/* Trạng thái */}
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleUpdate(cost.id, { status: cost.status === "ON" ? "OFF" : "ON" })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cost.status === "ON" ? "bg-green-500" : "bg-gray-600"}`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cost.status === "ON" ? "translate-x-6" : "translate-x-1"}`}
                                            />
                                        </button>
                                    </td>
                                    {/* Hành động */}
                                    <td className="p-4">
                                        <div className="flex items-center gap-1 justify-center">
                                            <button
                                                onClick={() => openViewModal(cost)}
                                                className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-blue-400 transition-colors"
                                                title="Xem chi tiết"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(cost)}
                                                className="p-1.5 rounded hover:bg-white/10 text-[var(--muted)] hover:text-yellow-400 transition-colors"
                                                title="Sửa"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(cost.id)}
                                                className="p-1.5 rounded hover:bg-red-500/20 text-[var(--muted)] hover:text-red-400 transition-colors"
                                                title="Xóa"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {costs.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-[var(--muted)]">Chưa có chi phí cố định nào</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* Create/Edit Modal */}
            {(isModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button onClick={() => { setIsModalOpen(false); setIsEditModalOpen(false); }} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            {selectedCost ? <Edit2 size={24} className="text-yellow-400" /> : <Plus size={24} className="text-blue-400" />}
                            {selectedCost ? "Sửa Chi Phí Cố Định" : "Thêm Chi Phí Cố Định"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tên khoản chi</label>
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Tiền thuê nhà" className="glass-input w-full p-2 rounded-lg" required />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Số tiền & Tiền tệ</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <CurrencyInput
                                                value={amount}
                                                onChange={setAmount}
                                                currency={currency}
                                                required
                                            />
                                        </div>
                                        <select
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value as Currency)}
                                            disabled={!!selectedAccountId}
                                            className={`glass-input p-2 rounded-lg bg-[#1a1a1a] text-white border border-white/10 w-24 ${selectedAccountId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <option value="VND" className="bg-[#1a1a1a] text-white">🇻🇳 VND</option>
                                            <option value="USD" className="bg-[#1a1a1a] text-white">🇺🇸 USD</option>
                                            <option value="KHR" className="bg-[#1a1a1a] text-white">🇰🇭 KHR</option>
                                            <option value="TRY" className="bg-[#1a1a1a] text-white">🇹🇷 TRY</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Chu kỳ lặp lại</label>
                                    <select value={cycle} onChange={e => setCycle(e.target.value as any)} className="glass-input w-full p-2 rounded-lg bg-[#1a1a1a] text-white border border-white/10">
                                        <option value="MONTHLY" className="bg-[#1a1a1a] text-white">Hàng tháng</option>
                                        <option value="QUARTERLY" className="bg-[#1a1a1a] text-white">Hàng quý</option>
                                        <option value="YEARLY" className="bg-[#1a1a1a] text-white">Hàng năm</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tài khoản thanh toán mặc định</label>
                                <select
                                    value={selectedAccountId}
                                    onChange={e => {
                                        const accId = e.target.value;
                                        setSelectedAccountId(accId);
                                        const account = accounts.find(a => a.id === accId);
                                        if (account) {
                                            setCurrency(account.currency);
                                        }
                                    }}
                                    className="glass-input w-full p-2 rounded-lg bg-[#1a1a1a] text-white border border-white/10"
                                >
                                    <option value="" className="bg-[#1a1a1a] text-white">Chọn tài khoản (Tùy chọn)</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id} className="bg-[#1a1a1a] text-white">{acc.name} ({acc.currency})</option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" className="flex items-center justify-center gap-2 w-full p-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white mt-4 border-none transition-all">
                                <Save size={18} />
                                {selectedCost ? "Cập nhật thay đổi" : "Lưu chi phí"}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedCost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button onClick={() => setIsViewModalOpen(false)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <Eye size={24} className="text-blue-400" />
                            Chi Tiết Chi Phí
                        </h2>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">Tên khoản chi:</span>
                                <span className="text-white font-bold">{selectedCost.name}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">Số tiền:</span>
                                <span className="text-white font-bold">{new Intl.NumberFormat('vi-VN').format(selectedCost.amount)} {selectedCost.currency}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">Chu kỳ:</span>
                                <span className="text-white">{selectedCost.cycle === "MONTHLY" ? "Hàng tháng" : selectedCost.cycle === "QUARTERLY" ? "Hàng quý" : "Hàng năm"}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">Tài khoản:</span>
                                <span className="text-white">{accounts.find(a => a.id === selectedCost.accountId)?.name || "Chưa gán"}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">Trạng thái:</span>
                                <span className={selectedCost.status === "ON" ? "text-green-500" : "text-gray-400"}>{selectedCost.status === "ON" ? "Đang bật" : "Đang tắt"}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">Tháng tạo gần nhất:</span>
                                <span className="text-white">{selectedCost.lastGenerated || "Chưa tạo giao dịch"}</span>
                            </div>
                        </div>
                        <button onClick={() => setIsViewModalOpen(false)} className="glass-button w-full p-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white mt-6 border-none flex items-center justify-center gap-2">
                            <X size={18} />
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
