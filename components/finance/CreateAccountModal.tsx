"use client";

import { useState, useEffect } from "react";
import { createAccount, getProjects } from "@/lib/finance";
import { Currency, Project } from "@/types/finance";
import { X } from "lucide-react";

interface CreateAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type AccountType = "BANK" | "CASH" | "E-WALLET";

export default function CreateAccountModal({ isOpen, onClose, onSuccess }: CreateAccountModalProps) {
    const [name, setName] = useState("");
    const [type, setType] = useState<AccountType>("BANK");
    const [currency, setCurrency] = useState<Currency>("VND");
    const [balance, setBalance] = useState("");
    const [projectId, setProjectId] = useState("");
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            getProjects().then(setProjects).catch(console.error);
        }
    }, [isOpen]);

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
                createdAt: Date.now(),
            });

            // Create Initial Transaction if balance > 0
            if (numBalance > 0) {
                const { createTransaction } = await import("@/lib/finance");
                await createTransaction({
                    type: "IN",
                    amount: numBalance,
                    currency,
                    category: "Số dư đầu kỳ",
                    accountId: accountId,
                    projectId: projectId || undefined,
                    description: "Khởi tạo tài khoản",
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

                <h2 className="text-lg font-bold mb-4">Thêm tài khoản mới</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Tên tài khoản</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg text-sm"
                            placeholder="VD: Vietcombank, Tiền mặt VP..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Loại tài khoản</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: "BANK", label: "Ngân hàng", icon: "🏦" },
                                { value: "CASH", label: "Tiền mặt", icon: "💵" },
                                { value: "E-WALLET", label: "Ví điện tử", icon: "📱" },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setType(opt.value as AccountType)}
                                    className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                                        type === opt.value
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
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Gán vào dự án (tuỳ chọn)</label>
                        <select
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg text-sm"
                        >
                            <option value="">-- Tài khoản chung --</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Tiền tệ</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                className="glass-input w-full p-2 rounded-lg text-sm"
                            >
                                <option value="VND">VND</option>
                                <option value="USD">USD</option>
                                <option value="KHR">KHR</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Số dư ban đầu</label>
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

                    <button
                        type="submit"
                        disabled={loading || !name.trim()}
                        className="w-full p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
                    >
                        {loading ? "Đang tạo..." : "Tạo tài khoản"}
                    </button>
                </form>
            </div>
        </div>
    );
}
