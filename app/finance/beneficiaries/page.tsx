"use client";

import { useState, useEffect, useMemo } from "react";
import { getBeneficiaries, createBeneficiary, updateBeneficiary, deleteBeneficiary } from "@/lib/finance";
import { Beneficiary, BankInfo } from "@/types/finance";
import { useRouter } from "next/navigation";
import { getUserRole, Role } from "@/lib/permissions";
import { Trash2, Plus, Save, X, Edit2, Globe, CreditCard, Building2, PlusCircle, Trash } from "lucide-react";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import DataTable, { ActionCell } from "@/components/finance/DataTable";
import { useTranslation } from "@/lib/i18n";

export default function BeneficiariesPage() {
    const { t } = useTranslation();
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<Role>("USER");
    const router = useRouter();

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBeneficiary, setSelectedBeneficiary] = useState<Beneficiary | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    // Form State
    const [name, setName] = useState("");
    const [platforms, setPlatforms] = useState<string[]>([]);
    const [newPlatform, setNewPlatform] = useState("");
    const [bankAccounts, setBankAccounts] = useState<BankInfo[]>([]);
    const [description, setDescription] = useState("");

    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUserRole(getUserRole(parsedUser));
        } else {
            router.push("/login");
        }
        fetchData();
    }, [router]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getBeneficiaries();
            setBeneficiaries(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setSelectedBeneficiary(null);
        setName("");
        setPlatforms([]);
        setBankAccounts([{ bankName: "", accountNumber: "", accountName: "", branch: "" }]);
        setDescription("");
        setIsModalOpen(true);
    };

    const openEditModal = (b: Beneficiary) => {
        setSelectedBeneficiary(b);
        setName(b.name);
        setPlatforms(b.platforms || []);
        setBankAccounts(b.bankAccounts || [{ bankName: "", accountNumber: "", accountName: "", branch: "" }]);
        setDescription(b.description || "");
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (userRole !== "ADMIN") return alert(t("no_permission"));

        const payload = {
            name,
            platforms,
            bankAccounts: bankAccounts.filter(acc => acc.accountNumber && acc.bankName),
            description,
            isActive: true,
            updatedAt: Date.now()
        };

        try {
            if (selectedBeneficiary) {
                await updateBeneficiary(selectedBeneficiary.id, payload);
            } else {
                await createBeneficiary({
                    ...payload,
                    createdAt: Date.now()
                });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        if (userRole !== "ADMIN") return alert(t("no_permission"));
        if (!confirm(t("confirm_delete"))) return;
        try {
            await deleteBeneficiary(id);
            setBeneficiaries(prev => prev.filter(b => b.id !== id));
        } catch (error) {
            console.error(error);
        }
    };

    const addPlatform = () => {
        if (newPlatform && !platforms.includes(newPlatform)) {
            setPlatforms([...platforms, newPlatform]);
            setNewPlatform("");
        }
    };

    const removePlatform = (p: string) => {
        setPlatforms(platforms.filter(x => x !== p));
    };

    const updateBankAccount = (index: number, field: keyof BankInfo, value: string) => {
        const newAccs = [...bankAccounts];
        newAccs[index] = { ...newAccs[index], [field]: value };
        setBankAccounts(newAccs);
    };

    const addBankAccount = () => {
        setBankAccounts([...bankAccounts, { bankName: "", accountNumber: "", accountName: "", branch: "" }]);
    };

    const removeBankAccount = (index: number) => {
        setBankAccounts(bankAccounts.filter((_, i) => i !== index));
    };

    const filteredData = beneficiaries.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.platforms?.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">{t("beneficiaries") || "Đơn vị thụ hưởng"}</h1>
                    <p className="text-[var(--muted)]">{t("beneficiaries_desc")}</p>
                </div>
            </div>

            <DataTableToolbar
                searchPlaceholder={t("search")}
                onSearch={setSearchTerm}
                onReset={() => setSearchTerm("")}
                onExport={() => { }}
                onFilterChange={() => { }}
                activeFilters={{}}
                onAdd={userRole === "ADMIN" ? openCreateModal : undefined}
                addLabel={t("add_beneficiary")}
            />

            <DataTable
                data={filteredData}
                isLoading={loading}
                columns={[
                    {
                        key: "name",
                        header: t("company_name"),
                        render: (b) => (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                    <Building2 size={20} />
                                </div>
                                <div className="font-bold text-white">{b.name}</div>
                            </div>
                        )
                    },
                    {
                        key: "platforms",
                        header: t("platforms_label"),
                        render: (b) => (
                            <div className="flex flex-wrap gap-1">
                                {b.platforms?.map(p => (
                                    <span key={p} className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded text-[10px] font-bold border border-blue-500/20">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        )
                    },
                    {
                        key: "bankAccounts",
                        header: t("bank_accounts_label"),
                        render: (b) => (
                            <div className="text-xs text-[var(--muted)] space-y-1">
                                {b.bankAccounts?.map((acc, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <CreditCard size={12} />
                                        <span>{acc.bankName}: {acc.accountNumber}</span>
                                    </div>
                                ))}
                            </div>
                        )
                    },
                    {
                        key: "actions",
                        header: t("actions"),
                        align: "center",
                        render: (b) => (
                            <ActionCell>
                                <button onClick={() => openEditModal(b)} className="p-1.5 rounded hover:bg-white/10 text-yellow-400">
                                    <Edit2 size={14} />
                                </button>
                                <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded hover:bg-red-500/20 text-red-400">
                                    <Trash2 size={14} />
                                </button>
                            </ActionCell>
                        )
                    }
                ]}
            />

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <div className="glass-card w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/10 shadow-2xl">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {selectedBeneficiary ? <Edit2 size={20} className="text-yellow-400" /> : <PlusCircle size={20} className="text-blue-400" />}
                                {selectedBeneficiary ? t("edit_beneficiary") : t("add_beneficiary")}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 scrollbar-thin">
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-[var(--muted)] mb-1 uppercase tracking-wider">{t("company_name")}</label>
                                    <input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="glass-input w-full p-3 rounded-xl font-bold text-white focus:ring-2 focus:ring-blue-500/30"
                                        placeholder="Tên Agency / Công ty..."
                                        required
                                    />
                                </div>
                            </div>

                            {/* Platforms */}
                            <div>
                                <label className="block text-sm font-bold text-[var(--muted)] mb-2 uppercase tracking-wider">{t("platforms_label")}</label>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        value={newPlatform}
                                        onChange={e => setNewPlatform(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPlatform())}
                                        className="glass-input flex-1 p-2 rounded-lg text-sm"
                                        placeholder={t("platform_placeholder")}
                                    />
                                    <button
                                        type="button"
                                        onClick={addPlatform}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs transition-all"
                                    >
                                        {t("add")}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {platforms.map(p => (
                                        <div key={p} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold">
                                            <Globe size={12} />
                                            {p}
                                            <button type="button" onClick={() => removePlatform(p)} className="hover:text-red-400 ml-1">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {platforms.length === 0 && <span className="text-xs text-white/30 italic">Chưa có nền tảng nào</span>}
                                </div>
                            </div>

                            {/* Bank Accounts */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider">{t("bank_accounts_label")}</label>
                                    <button
                                        type="button"
                                        onClick={addBankAccount}
                                        className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 hover:border-blue-500/40 transition-all"
                                    >
                                        <Plus size={14} />
                                        {t("add_bank_account")}
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {bankAccounts.map((acc, idx) => (
                                        <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-2xl relative group">
                                            {bankAccounts.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeBankAccount(idx)}
                                                    className="absolute top-4 right-4 text-white/20 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash size={16} />
                                                </button>
                                            )}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-[var(--muted)] mb-1 uppercase tracking-tighter">Ngân hàng</label>
                                                    <input
                                                        value={acc.bankName}
                                                        onChange={e => updateBankAccount(idx, "bankName", e.target.value)}
                                                        className="glass-input w-full p-2 rounded-lg text-sm font-medium"
                                                        placeholder="VD: Techcombank"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-[var(--muted)] mb-1 uppercase tracking-tighter">Số tài khoản</label>
                                                    <input
                                                        value={acc.accountNumber}
                                                        onChange={e => updateBankAccount(idx, "accountNumber", e.target.value)}
                                                        className="glass-input w-full p-2 rounded-lg text-sm font-mono"
                                                        placeholder="0123456789"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-bold text-[var(--muted)] mb-1 uppercase tracking-tighter">Tên chủ tài khoản</label>
                                                    <input
                                                        value={acc.accountName}
                                                        onChange={e => updateBankAccount(idx, "accountName", e.target.value)}
                                                        className="glass-input w-full p-2 rounded-lg text-sm uppercase font-bold"
                                                        placeholder="NGUYEN VAN A"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </form>

                        <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-white/5">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2.5 rounded-xl hover:bg-white/5 text-[var(--muted)] hover:text-white transition-all font-bold"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                            >
                                <Save size={18} />
                                {selectedBeneficiary ? t("update") : t("add")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
