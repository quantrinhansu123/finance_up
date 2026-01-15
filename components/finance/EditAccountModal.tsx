"use client";

import { useState, useEffect } from "react";
import { updateAccount } from "@/lib/finance";
import { Account, Currency } from "@/types/finance";
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
    const [loading, setLoading] = useState(false);

    // NEW: Currency and category restrictions
    const [restrictCurrency, setRestrictCurrency] = useState(false);
    const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
    const [showCategorySelector, setShowCategorySelector] = useState(false);

    useEffect(() => {
        if (account) {
            setName(account.name);
            setCurrency(account.currency);
            setBalance(account.balance.toString());
            setRestrictCurrency(account.restrictCurrency || false);
            setAllowedCategories(account.allowedCategories || []);
        }
    }, [account]);

    const toggleCategory = (cat: string) => {
        if (allowedCategories.includes(cat)) {
            setAllowedCategories(allowedCategories.filter(c => c !== cat));
        } else {
            setAllowedCategories([...allowedCategories, cat]);
        }
    };

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
                restrictCurrency,
                allowedCategories: allowedCategories.length > 0 ? allowedCategories : null,
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

                    {/* Currency Restriction */}
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={restrictCurrency}
                                onChange={(e) => setRestrictCurrency(e.target.checked)}
                                className="w-4 h-4 rounded"
                            />
                            <div>
                                <span className="text-sm font-medium text-white">🔒 {t("lock_currency")}</span>
                                <p className="text-xs text-[var(--muted)]">
                                    {t("lock_currency_desc").replace("{currency}", currency)}
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Category Restriction */}
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <span className="text-sm font-medium text-white">📋 {t("limit_categories")}</span>
                                <p className="text-xs text-[var(--muted)]">
                                    {allowedCategories.length === 0
                                        ? t("allow_all_categories")
                                        : t("allow_x_categories").replace("{count}", allowedCategories.length.toString())}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCategorySelector(!showCategorySelector)}
                                className="text-xs text-blue-400 hover:text-blue-300"
                            >
                                {showCategorySelector ? t("collapse") : t("filter")}
                            </button>
                        </div>

                        {showCategorySelector && (
                            <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                    {EXPENSE_CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => toggleCategory(cat)}
                                            className={`px-2 py-1 rounded text-xs transition-all ${allowedCategories.includes(cat)
                                                    ? "bg-blue-500/30 text-blue-400 border border-blue-500/50"
                                                    : "bg-white/5 text-[var(--muted)] border border-white/10 hover:border-white/20"
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                                {allowedCategories.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setAllowedCategories([])}
                                        className="mt-2 text-xs text-red-400 hover:text-red-300"
                                    >
                                        {t("clear_all")}
                                    </button>
                                )}
                            </div>
                        )}
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
