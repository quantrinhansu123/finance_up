"use client";

import { useState, useEffect } from "react";
import { updateAccount, getProjects } from "@/lib/finance";
import { Account, Currency, Project } from "@/types/finance";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useTranslation } from "@/lib/i18n";

interface EditAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    account: Account | null;
}

// Available expense categories
const EXPENSE_CATEGORIES = [
    "Thuế",
    "Cước vận chuyển",
    "Cước vận chuyển HN-HCM",
    "Cước vận chuyển HCM-HN",
    "SIM",
    "SIM Smart",
    "SIM CellCard",
    "SIM MetPhone",
    "Văn phòng",
    "Thuê văn phòng",
    "Mua đồ dùng văn phòng",
    "Ads",
    "Marketing",
    "Lương",
    "Chi lương nhân viên",
    "Vận hành",
    "Chuyển nội bộ",
    "Khác"
];

export default function EditAccountModal({ isOpen, onClose, onSuccess, account }: EditAccountModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [balance, setBalance] = useState("");
    const [projectId, setProjectId] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            getProjects().then(setProjects).catch(console.error);
        }
    }, [isOpen]);

    useEffect(() => {
        if (account) {
            setName(account.name);
            setCurrency(account.currency);
            setBalance(account.balance.toString());
            setProjectId(account.projectId || "");
        }
    }, [account]);

    if (!isOpen || !account) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const accRef = doc(db, "finance_accounts", account.id);
            await updateDoc(accRef, {
                name,
                currency,
                balance: parseFloat(balance) || 0,
                projectId: projectId || null,
                restrictCurrency: true, // Forced default
                allowedCategories: null, // Forced default (all categories)
                updatedAt: Date.now(),
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to update account", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-md p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[var(--muted)] hover:text-white"
                >
                    ✕
                </button>

                <h2 className="text-2xl font-bold mb-6">{t("edit_account_title")}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("account_name_label")}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg"
                            placeholder={t("account_name_placeholder")}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("link_to_project")}</label>
                        <select
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg text-sm"
                        >
                            <option value="">{t("general_account")}</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("currency")}</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                className="glass-input w-full p-2 rounded-lg"
                            >
                                <option value="VND">🇻🇳 VND</option>
                                <option value="USD">🇺🇸 USD</option>
                                <option value="KHR">🇰🇭 KHR</option>
                                <option value="TRY">🇹🇷 TRY (Lira)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">{t("balance")}</label>
                            <input
                                type="number"
                                value={balance}
                                onChange={(e) => setBalance(e.target.value)}
                                className="glass-input w-full p-2 rounded-lg"
                                placeholder="0.00"
                                step="any"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="glass-button w-full p-3 rounded-xl bg-white/5 hover:bg-white/10"
                        >
                            {t("cancel")}
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="glass-button w-full p-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white"
                        >
                            {loading ? t("updating") : t("update_account_btn")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
