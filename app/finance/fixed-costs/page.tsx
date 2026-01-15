"use client";

import { useState, useEffect, useMemo } from "react";
import { getFixedCosts, createFixedCost, createTransaction, getAccounts, deleteFixedCost } from "@/lib/finance";
import { FixedCost, Currency, Account } from "@/types/finance";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CurrencyInput from "@/components/finance/CurrencyInput";
import { Plus, Eye, Edit2, Trash2, Zap, X, Save } from "lucide-react";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { ActionCell } from "@/components/finance/DataTable";
import { useTranslation } from "@/lib/i18n";

const CURRENCY_COLORS: Record<string, string> = {
    "VND": "#ef4444",
    "USD": "#3b82f6",
    "KHR": "#22c55e",
    "TRY": "#f59e0b"
};

export default function FixedCostsPage() {
    const { t } = useTranslation();
    const [costs, setCosts] = useState<FixedCost[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedCost, setSelectedCost] = useState<FixedCost | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Filters
    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        status: "",
        cycle: "",
        accountId: ""
    });
    const [searchTerm, setSearchTerm] = useState("");

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

    // Filtered data
    const filteredCosts = useMemo(() => {
        return costs.filter(c => {
            const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchStatus = !activeFilters.status || c.status === activeFilters.status;
            const matchCycle = !activeFilters.cycle || c.cycle === activeFilters.cycle;
            const matchAccount = !activeFilters.accountId || c.accountId === activeFilters.accountId;
            return matchSearch && matchStatus && matchCycle && matchAccount;
        });
    }, [costs, searchTerm, activeFilters]);

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">{t("fixed_costs")}</h1>
                    <p className="text-[var(--muted)]">{t("fixed_costs_desc")}</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={generateTransactions}
                        disabled={loading}
                        className="glass-button px-4 py-2 rounded-lg font-medium bg-white/5 hover:bg-white/10 flex items-center gap-2 text-xs transition-colors"
                    >
                        <Zap size={14} className="text-yellow-400" />
                        {t("generate_monthly")}
                    </button>
                </div>
            </div>

            <DataTableToolbar
                searchPlaceholder={t("search_cost")}
                onSearch={setSearchTerm}
                activeFilters={activeFilters}
                onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                onReset={() => {
                    setActiveFilters({ status: "", cycle: "", accountId: "" });
                    setSearchTerm("");
                }}
                onExport={() => exportToCSV(filteredCosts, "Chi_Phi_Co_Dinh", {
                    name: t("name"),
                    amount: t("amount"),
                    currency: t("currency"),
                    cycle: t("cycle"),
                    status: t("status"),
                    lastGenerated: t("last_generated_month")
                })}
                onAdd={openCreateModal}
                addLabel={t("add_fixed_cost")}
                filters={[
                    {
                        id: "status",
                        label: t("status"),
                        options: [
                            { value: "ON", label: t("on") },
                            { value: "OFF", label: t("off") }
                        ]
                    },
                    {
                        id: "cycle",
                        label: t("cycle"),
                        options: [
                            { value: "MONTHLY", label: t("monthly") },
                            { value: "QUARTERLY", label: t("quarterly") },
                            { value: "YEARLY", label: t("yearly") }
                        ]
                    },
                    {
                        id: "accountId",
                        label: t("accounts"),
                        options: accounts.map(a => ({ value: a.id, label: a.name })),
                        advanced: true
                    }
                ]}
            />

            <DataTable
                data={filteredCosts}
                onRowClick={openViewModal}
                columns={[
                    {
                        key: "name",
                        header: t("name"),
                        render: (cost) => (
                            <div className="font-bold text-white">{cost.name}</div>
                        )
                    },
                    {
                        key: "amount",
                        header: t("amount"),
                        align: "left",
                        render: (cost) => (
                            <div className="text-white">
                                {new Intl.NumberFormat('vi-VN').format(cost.amount)}
                                <span className="text-[10px] ml-1 opacity-60" style={{ color: CURRENCY_COLORS[cost.currency] }}>{cost.currency}</span>
                            </div>
                        )
                    },
                    {
                        key: "cycle",
                        header: t("cycle"),
                        render: (cost) => (
                            <span className="text-xs px-2 py-1 bg-white/5 rounded-full text-white/70">
                                {cost.cycle === "MONTHLY" ? t("monthly") : cost.cycle === "QUARTERLY" ? t("quarterly") : t("yearly")}
                            </span>
                        )
                    },
                    {
                        key: "accountId",
                        header: t("payment_account"),
                        render: (cost) => (
                            <div className="text-xs text-white/60">
                                {accounts.find(a => a.id === cost.accountId)?.name || t("unassigned")}
                            </div>
                        )
                    },
                    {
                        key: "status",
                        header: t("status"),
                        align: "center",
                        render: (cost) => (
                            <div onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => handleUpdate(cost.id, { status: cost.status === "ON" ? "OFF" : "ON" })}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cost.status === "ON" ? "bg-green-500" : "bg-gray-600"}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cost.status === "ON" ? "translate-x-6" : "translate-x-1"}`}
                                    />
                                </button>
                            </div>
                        )
                    },
                    {
                        key: "actions",
                        header: "Thao tác",
                        align: "center",
                        sortable: false,
                        render: (cost) => (
                            <ActionCell>
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
                            </ActionCell>
                        )
                    }
                ]}
                emptyMessage={t("no_data")}
            />

            {/* Create/Edit Modal */}
            {(isModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button onClick={() => { setIsModalOpen(false); setIsEditModalOpen(false); }} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            {selectedCost ? <Edit2 size={24} className="text-yellow-400" /> : <Plus size={24} className="text-blue-400" />}
                            {selectedCost ? t("edit_fixed_cost") : t("create_fixed_cost")}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("name")}</label>
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="VD: Tiền thuê nhà" className="glass-input w-full p-2 rounded-lg" required />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("amount")} & {t("currency")}</label>
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
                                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("cycle")}</label>
                                    <select value={cycle} onChange={e => setCycle(e.target.value as any)} className="glass-input w-full p-2 rounded-lg bg-[#1a1a1a] text-white border border-white/10">
                                        <option value="MONTHLY" className="bg-[#1a1a1a] text-white">{t("monthly")}</option>
                                        <option value="QUARTERLY" className="bg-[#1a1a1a] text-white">{t("quarterly")}</option>
                                        <option value="YEARLY" className="bg-[#1a1a1a] text-white">{t("yearly")}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("default_payment_account")}</label>
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
                                    <option value="" className="bg-[#1a1a1a] text-white">{t("select_account_optional")}</option>
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id} className="bg-[#1a1a1a] text-white">{acc.name} ({acc.currency})</option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" className="flex items-center justify-center gap-2 w-full p-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white mt-4 border-none transition-all">
                                <Save size={18} />
                                {selectedCost ? t("save") : t("save_cost")}
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
                            {t("cost_details")}
                        </h2>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">{t("name")}:</span>
                                <span className="text-white font-bold">{selectedCost.name}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">{t("amount")}:</span>
                                <span className="text-white font-bold">{new Intl.NumberFormat('vi-VN').format(selectedCost.amount)} {selectedCost.currency}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">{t("cycle")}:</span>
                                <span className="text-white">{selectedCost.cycle === "MONTHLY" ? t("monthly") : selectedCost.cycle === "QUARTERLY" ? t("quarterly") : t("yearly")}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">{t("accounts")}:</span>
                                <span className="text-white">{accounts.find(a => a.id === selectedCost.accountId)?.name || t("unassigned")}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">{t("status")}:</span>
                                <span className={selectedCost.status === "ON" ? "text-green-500" : "text-gray-400"}>{selectedCost.status === "ON" ? t("on") : t("off")}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-2">
                                <span className="text-[var(--muted)]">{t("last_generated_month")}:</span>
                                <span className="text-white">{selectedCost.lastGenerated || t("never_generated")}</span>
                            </div>
                        </div>
                        <button onClick={() => setIsViewModalOpen(false)} className="glass-button w-full p-3 rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white mt-6 border-none flex items-center justify-center gap-2">
                            <X size={18} />
                            {t("close")}
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
