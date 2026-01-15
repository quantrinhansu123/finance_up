"use client";

import { useState, useEffect } from "react";
import { createAccount, getProjects } from "@/lib/finance";
import { Currency, Project } from "@/types/finance";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface CreateAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type AccountType = "BANK" | "CASH" | "E-WALLET";

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

export default function CreateAccountModal({ isOpen, onClose, onSuccess }: CreateAccountModalProps) {
    const { t } = useTranslation();
    const [name, setName] = useState("");
    const [type, setType] = useState<AccountType>("BANK");
    const [currency, setCurrency] = useState<Currency>("VND");
    const [balance, setBalance] = useState("");
    const [projectId, setProjectId] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);

    // NEW: Currency and category restrictions
    const [restrictCurrency, setRestrictCurrency] = useState(true); // Default: restrict to account's currency
    const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
    const [showCategorySelector, setShowCategorySelector] = useState(false);

    useEffect(() => {
        if (isOpen) {
            getProjects().then(setProjects).catch(console.error);
        }
    }, [isOpen]);

    const toggleCategory = (cat: string) => {
        if (allowedCategories.includes(cat)) {
            setAllowedCategories(allowedCategories.filter(c => c !== cat));
        } else {
            setAllowedCategories([...allowedCategories, cat]);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const numBalance = parseFloat(balance) || 0;
            const accountId = await createAccount({
                name,
                currency,
                balance: numBalance,
                openingBalance: numBalance,
                type,
                isLocked: false,
                projectId: projectId || undefined,
                restrictCurrency, // NEW: Currency restriction
                allowedCategories: allowedCategories.length > 0 ? allowedCategories : undefined, // NEW: Category restriction
                createdAt: Date.now(),
            });

            // Create Initial Transaction if balance > 0
            if (numBalance > 0) {
                const { createTransaction } = await import("@/lib/finance");
                await createTransaction({
                    type: "IN",
                    amount: numBalance,
                    currency,
                    category: t("opening_balance_cat"),
                    accountId: accountId,
                    projectId: projectId || undefined,
                    description: t("init_account_desc"),
                    date: new Date().toISOString(),
                    status: "APPROVED",
                    createdBy: "System",
                    userId: "system",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
            }

            onSuccess();
            onClose();
            setName("");
            setType("BANK");
            setBalance("");
            setProjectId("");
            setRestrictCurrency(true);
            setAllowedCategories([]);
        } catch (error) {
            console.error("Failed to create account", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-md p-5 rounded-xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1 rounded hover:bg-white/10 text-[var(--muted)] hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>

                <h2 className="text-lg font-bold mb-4">{t("add_account_title")}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("account_name_label")}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg text-sm"
                            placeholder={t("account_name_placeholder")}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("account_type_label")}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: "BANK", label: t("bank"), icon: "🏦" },
                                { value: "CASH", label: t("cash"), icon: "💵" },
                                { value: "E-WALLET", label: t("e_wallet"), icon: "📱" },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setType(opt.value as AccountType)}
                                    className={`p-2 rounded-lg border text-xs font-medium transition-all ${type === opt.value
                                            ? "border-blue-500 bg-blue-500/20 text-blue-400"
                                            : "border-white/10 hover:border-white/20 text-[var(--muted)]"
                                        }`}
                                >
                                    <div className="text-lg mb-1">{opt.icon}</div>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("link_to_project")}</label>
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

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("currency")}</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                className="glass-input w-full p-2 rounded-lg text-sm"
                            >
                                <option value="VND">🇻🇳 VND</option>
                                <option value="USD">🇺🇸 USD</option>
                                <option value="KHR">🇰🇭 KHR</option>
                                <option value="TRY">🇹🇷 TRY (Lira)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--muted)] mb-1">{t("initial_balance_label")}</label>
                            <input
                                type="number"
                                value={balance}
                                onChange={(e) => setBalance(e.target.value)}
                                className="glass-input w-full p-2 rounded-lg text-sm"
                                placeholder="0"
                                step="any"
                            />
                        </div>
                    </div>

                    {/* NEW: Currency Restriction */}
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

                    {/* NEW: Category Restriction */}
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

                    <button
                        type="submit"
                        disabled={loading || !name.trim()}
                        className="w-full p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
                    >
                        {loading ? t("creating") : t("create_account_btn")}
                    </button>
                </form>
            </div>
        </div>
    );
}
