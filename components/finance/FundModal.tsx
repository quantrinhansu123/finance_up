"use client";

import { useState, useEffect } from "react";
import { Fund } from "@/types/finance";
import { createFund, updateFund, deleteFund } from "@/lib/finance";

interface FundModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    fund?: Fund | null; // If provided, we are editing
}

export default function FundModal({ isOpen, onClose, onSuccess, fund }: FundModalProps) {
    const [name, setName] = useState("");
    const [budget, setBudget] = useState("");
    const [description, setDescription] = useState("");
    const [keywords, setKeywords] = useState(""); // Comma separated
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (fund) {
            setName(fund.name);
            setBudget(fund.targetBudget?.toString() || "");
            setDescription(fund.description || "");
            setKeywords(fund.keywords?.join(", ") || "");
        } else {
            setName("");
            setBudget("");
            setDescription("");
            setKeywords("");
        }
    }, [fund, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const keywordList = keywords.split(",").map(k => k.trim()).filter(k => k);
            const fundData = {
                name,
                targetBudget: parseFloat(budget) || 0,
                description,
                keywords: keywordList,
                updatedAt: Date.now()
            };

            if (fund) {
                // Update
                await updateFund(fund.id, fundData);
            } else {
                // Create
                await createFund({
                    ...fundData,
                    totalSpent: 0,
                    createdAt: Date.now()
                });
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to save fund", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!fund || !confirm("Bạn có chắc muốn xóa quỹ này? Hành động này không thể hoàn tác.")) return;
        setLoading(true);
        try {
            await deleteFund(fund.id);
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
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

                <h2 className="text-2xl font-bold mb-6">{fund ? "Chỉnh sửa Quỹ" : "Tạo Quỹ Mới"}</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tên quỹ</label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="VD: Quỹ Marketing"
                            className="glass-input w-full p-2 rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Ngân sách mục tiêu (Tháng)</label>
                        <input
                            type="number"
                            value={budget}
                            onChange={e => setBudget(e.target.value)}
                            placeholder="0.00"
                            className="glass-input w-full p-2 rounded-lg"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Từ khóa tự động gán (phân cách dấu phẩy)</label>
                        <input
                            value={keywords}
                            onChange={e => setKeywords(e.target.value)}
                            placeholder="VD: ads, facebook, marketing"
                            className="glass-input w-full p-2 rounded-lg"
                        />
                        <p className="text-xs text-[var(--muted)] mt-1">Các chi phí có từ khóa này sẽ được gợi ý vào quỹ này.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Mô tả</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg"
                            rows={3}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        {fund && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={loading}
                                className="glass-button px-4 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            >
                                Xóa
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="glass-button flex-1 p-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white"
                        >
                            {loading ? "Đang lưu..." : (fund ? "Lưu thay đổi" : "Tạo Quỹ")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
