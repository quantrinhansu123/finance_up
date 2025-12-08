"use client";

import { useState, useEffect } from "react";
import { getFixedCosts, createFixedCost, createTransaction, getAccounts, deleteFixedCost } from "@/lib/finance";
import { FixedCost, Currency, Account } from "@/types/finance";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function FixedCostsPage() {
    const [costs, setCosts] = useState<FixedCost[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Form State
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [cycle, setCycle] = useState<FixedCost["cycle"]>("MONTHLY");
    const [selectedAccountId, setSelectedAccountId] = useState("");

    const [deleteLoading, setDeleteLoading] = useState(false);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createFixedCost({
                name,
                amount: parseFloat(amount),
                currency,
                cycle,
                status: "ON",
                description: "",
                accountId: selectedAccountId || undefined,
            });
            setIsModalOpen(false);
            setName("");
            setAmount("");
            setSelectedAccountId("");
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    // Inline Updates
    const handleUpdate = async (id: string, updates: Partial<FixedCost>) => {
        try {
            // Optimistic Update
            setCosts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));

            const ref = doc(db, "finance_fixed_costs", id);
            await updateDoc(ref, updates);
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
                    category: cost.name,
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
                        className="glass-button px-4 py-3 rounded-xl font-medium bg-white/5 hover:bg-white/10 flex items-center gap-2"
                    >
                        ⚡ Tạo giao dịch tháng này
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="glass-button px-6 py-3 rounded-xl font-medium bg-blue-600 hover:bg-blue-500 text-white border-none"
                    >
                        + Thêm Chi Phí
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
                                        <input
                                            value={cost.name}
                                            onChange={(e) => handleUpdate(cost.id, { name: e.target.value })}
                                            className="bg-transparent text-white w-full focus:outline-none focus:border-b border-blue-500"
                                        />
                                    </td>
                                    {/* Số tiền */}
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={cost.amount}
                                                onChange={(e) => handleUpdate(cost.id, { amount: parseFloat(e.target.value) })}
                                                className="bg-transparent text-white w-24 focus:outline-none focus:border-b border-blue-500 text-right font-bold"
                                            />
                                            <select
                                                value={cost.currency}
                                                onChange={(e) => handleUpdate(cost.id, { currency: e.target.value as Currency })}
                                                className="bg-[#1a1a1a] text-[var(--muted)] text-xs focus:outline-none border border-white/10 rounded px-1 py-0.5"
                                            >
                                                <option value="USD" className="bg-[#1a1a1a] text-white">USD</option>
                                                <option value="VND" className="bg-[#1a1a1a] text-white">VND</option>
                                                <option value="KHR" className="bg-[#1a1a1a] text-white">KHR</option>
                                            </select>
                                        </div>
                                    </td>
                                    {/* Chu kỳ */}
                                    <td className="p-4">
                                        <select
                                            value={cost.cycle}
                                            onChange={(e) => handleUpdate(cost.id, { cycle: e.target.value as FixedCost["cycle"] })}
                                            className="bg-[#1a1a1a] text-white text-xs px-2 py-1 rounded focus:outline-none border border-white/10"
                                        >
                                            <option value="MONTHLY" className="bg-[#1a1a1a] text-white">Hàng tháng</option>
                                            <option value="QUARTERLY" className="bg-[#1a1a1a] text-white">Hàng quý</option>
                                            <option value="YEARLY" className="bg-[#1a1a1a] text-white">Hàng năm</option>
                                        </select>
                                    </td>
                                    {/* Tài khoản trả */}
                                    <td className="p-4">
                                        <select
                                            value={cost.accountId || ""}
                                            onChange={(e) => handleUpdate(cost.id, { accountId: e.target.value })}
                                            className="bg-[#1a1a1a] text-white text-xs px-2 py-1 rounded focus:outline-none border border-white/10 max-w-[150px]"
                                        >
                                            <option value="" className="bg-[#1a1a1a] text-white">Chưa gán</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id} className="bg-[#1a1a1a] text-white">{acc.name} ({acc.currency})</option>
                                            ))}
                                        </select>
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
                                        <button
                                            onClick={() => handleDelete(cost.id)}
                                            className="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-400/10 rounded"
                                        >
                                            Xóa
                                        </button>
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

            {
                isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white">✕</button>
                            <h2 className="text-2xl font-bold mb-6">Thêm Chi Phí Cố Định</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tên khoản chi</label>
                                    <input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Tiền thuê nhà" className="glass-input w-full p-2 rounded-lg" required />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Số tiền</label>
                                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="glass-input w-full p-2 rounded-lg" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tiền tệ</label>
                                        <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="glass-input w-full p-2 rounded-lg bg-[#1a1a1a] text-white border border-white/10">
                                            <option value="USD" className="bg-[#1a1a1a] text-white">USD</option>
                                            <option value="VND" className="bg-[#1a1a1a] text-white">VND</option>
                                            <option value="KHR" className="bg-[#1a1a1a] text-white">KHR</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Chu kỳ lặp lại</label>
                                    <select value={cycle} onChange={e => setCycle(e.target.value as any)} className="glass-input w-full p-2 rounded-lg bg-[#1a1a1a] text-white border border-white/10">
                                        <option value="MONTHLY" className="bg-[#1a1a1a] text-white">Hàng tháng</option>
                                        <option value="QUARTERLY" className="bg-[#1a1a1a] text-white">Hàng quý</option>
                                        <option value="YEARLY" className="bg-[#1a1a1a] text-white">Hàng năm</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tài khoản thanh toán mặc định</label>
                                    <select
                                        value={selectedAccountId}
                                        onChange={e => setSelectedAccountId(e.target.value)}
                                        className="glass-input w-full p-2 rounded-lg bg-[#1a1a1a] text-white border border-white/10"
                                    >
                                        <option value="" className="bg-[#1a1a1a] text-white">Chọn tài khoản (Tùy chọn)</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id} className="bg-[#1a1a1a] text-white">{acc.name} ({acc.currency})</option>
                                        ))}
                                    </select>
                                </div>

                                <button type="submit" className="glass-button w-full p-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white mt-4 border-none">Lưu</button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
