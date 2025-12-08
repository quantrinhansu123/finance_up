"use client";

import { useState, useEffect } from "react";
import { updateAccount } from "@/lib/finance";
import { Account, Currency } from "@/types/finance";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface EditAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    account: Account | null;
}

export default function EditAccountModal({ isOpen, onClose, onSuccess, account }: EditAccountModalProps) {
    const [name, setName] = useState("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [balance, setBalance] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (account) {
            setName(account.name);
            setCurrency(account.currency);
            setBalance(account.balance.toString());
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-[var(--muted)] hover:text-white"
                >
                    ✕
                </button>

                <h2 className="text-2xl font-bold mb-6">Chỉnh sửa tài khoản</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tên tài khoản</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg"
                            placeholder="VD: ABA (USD)"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tiền tệ</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                className="glass-input w-full p-2 rounded-lg"
                            >
                                <option value="USD">USD</option>
                                <option value="KHR">KHR</option>
                                <option value="VND">VND</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Số dư hiện tại</label>
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
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="glass-button w-full p-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white"
                        >
                            {loading ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
