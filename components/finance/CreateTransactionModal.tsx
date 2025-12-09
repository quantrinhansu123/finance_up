"use client";

import { useState, useEffect, useMemo } from "react";
import { createTransaction, getAccounts, updateAccountBalance, getProjects } from "@/lib/finance";
import { Account, Currency, TransactionType, Project, Fund } from "@/types/finance";
import { getCategoriesForRole, Role, getAccessibleProjects, getAccessibleAccounts } from "@/lib/permissions";
import { uploadImage } from "@/lib/upload";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CreateTransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentUser?: { id: string; name: string; role: Role; uid?: string; projectIds?: string[] };
}

const INCOME_CATEGORIES = ["COD VET", "COD JNT", "Khách CK", "Khác"];
const EXPENSE_CATEGORIES = [
    "Thuế",
    "Long Heng",
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

const CURRENCY_FLAGS: Record<string, string> = {
    "VND": "🇻🇳",
    "USD": "🇺🇸",
    "KHR": "🇰🇭",
    "TRY": "🇹🇷"
};

export default function CreateTransactionModal({ isOpen, onClose, onSuccess, currentUser }: CreateTransactionModalProps) {
    const [type, setType] = useState<TransactionType>("OUT");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [accountId, setAccountId] = useState("");
    const [description, setDescription] = useState("");

    // Fields
    const [projectId, setProjectId] = useState("");
    const [fundId, setFundId] = useState("");
    const [source, setSource] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    const [loading, setLoading] = useState(false);

    // Data
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [funds, setFunds] = useState<Fund[]>([]);

    // Filter projects based on user role
    const accessibleProjects = useMemo(() => {
        return getAccessibleProjects(currentUser, projects);
    }, [currentUser, projects]);

    const accessibleProjectIds = useMemo(() => {
        return accessibleProjects.map(p => p.id);
    }, [accessibleProjects]);

    // Filter accounts based on user and SELECTED PROJECT
    const accessibleAccounts = useMemo(() => {
        let filtered = getAccessibleAccounts(currentUser, accounts, accessibleProjectIds);
        
        // Filter by assignedUserIds if set
        const userId = currentUser?.uid || currentUser?.id;
        if (userId) {
            filtered = filtered.filter(acc => 
                !acc.assignedUserIds || 
                acc.assignedUserIds.length === 0 || 
                acc.assignedUserIds.includes(userId)
            );
        }

        // IMPORTANT: Filter by selected project
        if (projectId) {
            filtered = filtered.filter(acc => 
                acc.projectId === projectId || // Account belongs to this project
                !acc.projectId // Or account is general (no project)
            );
        }
        
        return filtered;
    }, [currentUser, accounts, accessibleProjectIds, projectId]);

    // Get selected account
    const selectedAccount = useMemo(() => {
        return accounts.find(a => a.id === accountId);
    }, [accounts, accountId]);

    // Get selected project
    const selectedProject = useMemo(() => {
        return projects.find(p => p.id === projectId);
    }, [projects, projectId]);

    // Get allowed categories based on account settings
    const allowedCategories = useMemo(() => {
        const baseCategories = type === "IN" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        const roleCategories = getCategoriesForRole(currentUser?.role || "ADMIN", baseCategories);
        
        if (selectedAccount?.allowedCategories && selectedAccount.allowedCategories.length > 0) {
            return roleCategories.filter(cat => selectedAccount.allowedCategories!.includes(cat));
        }
        
        return roleCategories;
    }, [type, currentUser?.role, selectedAccount]);

    // Auto-set currency when account changes
    useEffect(() => {
        if (selectedAccount) {
            setCurrency(selectedAccount.currency);
            // Auto-set category if restricted
            if (selectedAccount.allowedCategories && selectedAccount.allowedCategories.length > 0) {
                setCategory(selectedAccount.allowedCategories[0]);
            }
        }
    }, [selectedAccount]);

    // Reset account when project changes
    useEffect(() => {
        if (projectId) {
            // Check if current account belongs to new project
            if (selectedAccount && selectedAccount.projectId && selectedAccount.projectId !== projectId) {
                setAccountId("");
            }
        }
    }, [projectId]);

    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                try {
                    const [accs, projs] = await Promise.all([
                        getAccounts(),
                        getProjects()
                    ]);
                    setAccounts(accs);
                    setProjects(projs);

                    const fundsSnapshot = await getDocs(collection(db, "finance_funds"));
                    setFunds(fundsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Fund)));
                } catch (error) {
                    console.error("Failed to load data:", error);
                }
            };
            fetchData();
        }
    }, [isOpen]);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setProjectId("");
            setAccountId("");
            setAmount("");
            setDescription("");
            setFiles([]);
            setFundId("");
            setSource("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const numAmount = parseFloat(amount);
            let status: "APPROVED" | "PENDING" = "APPROVED";

            // Approval Logic
            if (type === "OUT") {
                if (currency === "VND" && numAmount > 5000000) status = "PENDING";
                if ((currency === "USD" || currency === "KHR" || currency === "TRY") && numAmount > 100) status = "PENDING";
            }

            // Upload Images
            const imageUrls: string[] = [];
            if (files.length > 0) {
                try {
                    for (const file of files) {
                        const url = await uploadImage(file);
                        imageUrls.push(url);
                    }
                } catch (uploadError) {
                    console.error("Image upload failed:", uploadError);
                    alert("Lỗi khi tải ảnh lên.");
                    setLoading(false);
                    return;
                }
            }

            // Create Transaction
            await createTransaction({
                type,
                amount: numAmount,
                currency,
                category,
                accountId,
                description,
                date: new Date().toISOString(),
                status,
                createdBy: currentUser?.name || "Unknown",
                userId: currentUser?.id || "unknown",
                projectId: projectId || undefined,
                fundId: fundId || undefined,
                source: type === "IN" ? source : undefined,
                images: imageUrls,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });

            // Update Balance if approved
            if (status === "APPROVED") {
                const account = accounts.find(a => a.id === accountId);
                if (account) {
                    const newBalance = type === "IN"
                        ? account.balance + numAmount
                        : account.balance - numAmount;
                    await updateAccountBalance(accountId, newBalance);
                }
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to create transaction", error);
            alert("Đã xảy ra lỗi khi tạo giao dịch.");
        } finally {
            setLoading(false);
        }
    };

    // Check if can proceed to next step
    const canSelectAccount = !!projectId;
    const canEnterDetails = !!accountId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white text-xl">✕</button>

                <h2 className="text-2xl font-bold mb-2">Tạo Giao dịch</h2>
                <p className="text-sm text-[var(--muted)] mb-6">Chọn lần lượt: Dự án → Tài khoản → Nhập thông tin</p>

                {/* Transaction Type */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setType("IN")}
                        className={`flex-1 py-3 rounded-lg font-medium transition-colors ${type === "IN" ? "bg-green-600 text-white" : "bg-[var(--card-hover)] text-[var(--muted)]"}`}
                    >
                        💰 Thu tiền
                    </button>
                    <button
                        onClick={() => setType("OUT")}
                        className={`flex-1 py-3 rounded-lg font-medium transition-colors ${type === "OUT" ? "bg-red-600 text-white" : "bg-[var(--card-hover)] text-[var(--muted)]"}`}
                    >
                        💸 Chi tiền
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* ========== STEP 1: CHỌN DỰ ÁN ========== */}
                    <div className={`p-4 rounded-xl border-2 transition-all ${projectId ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                        <label className="block text-sm font-bold mb-2" style={{ color: projectId ? '#4ade80' : '#60a5fa' }}>
                            {projectId ? '✓' : '1️⃣'} Bước 1: Chọn Dự án
                        </label>
                        <select
                            value={projectId}
                            onChange={(e) => {
                                setProjectId(e.target.value);
                                setAccountId(""); // Reset account when project changes
                            }}
                            className="glass-input w-full p-3 rounded-lg text-base"
                            required
                        >
                            <option value="">-- Chọn dự án --</option>
                            {accessibleProjects.map(p => (
                                <option key={p.id} value={p.id}>
                                    📁 {p.name} {p.status !== "ACTIVE" ? `(${p.status})` : ""}
                                </option>
                            ))}
                        </select>
                        
                        {selectedProject && (
                            <div className="mt-2 text-xs text-[var(--muted)]">
                                {selectedProject.description || "Không có mô tả"}
                                {selectedProject.budget && (
                                    <span className="ml-2 text-blue-400">
                                        • Ngân sách: {selectedProject.budget.toLocaleString()} {selectedProject.currency || "USD"}
                                    </span>
                                )}
                            </div>
                        )}

                        {currentUser?.role === "STAFF" && accessibleProjects.length === 0 && (
                            <p className="text-xs text-yellow-400 mt-2">⚠️ Bạn chưa được gán vào dự án nào. Liên hệ Admin.</p>
                        )}
                    </div>

                    {/* ========== STEP 2: CHỌN TÀI KHOẢN ========== */}
                    {canSelectAccount && (
                        <div className={`p-4 rounded-xl border-2 transition-all ${accountId ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                            <label className="block text-sm font-bold mb-2" style={{ color: accountId ? '#4ade80' : '#60a5fa' }}>
                                {accountId ? '✓' : '2️⃣'} Bước 2: Chọn Tài khoản
                            </label>
                            <select
                                value={accountId}
                                onChange={(e) => setAccountId(e.target.value)}
                                className="glass-input w-full p-3 rounded-lg text-base"
                                required
                            >
                                <option value="">-- Chọn tài khoản --</option>
                                {accessibleAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {CURRENCY_FLAGS[acc.currency]} {acc.name} • {acc.balance.toLocaleString()} {acc.currency}
                                        {acc.projectId ? " [Riêng]" : " [Chung]"}
                                    </option>
                                ))}
                            </select>
                            
                            {accessibleAccounts.length === 0 && (
                                <p className="text-xs text-yellow-400 mt-2">⚠️ Không có tài khoản nào cho dự án này.</p>
                            )}

                            {/* Account Info */}
                            {selectedAccount && (
                                <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-white">{selectedAccount.name}</span>
                                        <span className="text-lg font-bold" style={{ color: selectedAccount.balance >= 0 ? '#4ade80' : '#f87171' }}>
                                            {selectedAccount.balance.toLocaleString()} {selectedAccount.currency}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="px-2 py-1 rounded" style={{ backgroundColor: CURRENCY_FLAGS[selectedAccount.currency] ? '#3b82f620' : '#52525220', color: '#60a5fa' }}>
                                            {CURRENCY_FLAGS[selectedAccount.currency]} Tiền tệ: {selectedAccount.currency}
                                        </span>
                                        {selectedAccount.allowedCategories && selectedAccount.allowedCategories.length > 0 && (
                                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                                                📋 {selectedAccount.allowedCategories.length} hạng mục
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========== STEP 3: NHẬP THÔNG TIN ========== */}
                    {canEnterDetails && (
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-4">
                            <label className="block text-sm font-bold text-white mb-2">
                                3️⃣ Bước 3: Nhập thông tin giao dịch
                            </label>

                            {/* Số tiền */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Số tiền</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="glass-input w-full p-3 pr-20 rounded-lg text-lg"
                                        placeholder="0"
                                        required
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base font-bold" style={{ color: currency === 'VND' ? '#ef4444' : currency === 'USD' ? '#3b82f6' : '#22c55e' }}>
                                        {CURRENCY_FLAGS[currency]} {currency}
                                    </span>
                                </div>
                                {amount && parseFloat(amount) > 0 && (
                                    (currency === "VND" && parseFloat(amount) > 5000000) ||
                                    ((currency === "USD" || currency === "KHR" || currency === "TRY") && parseFloat(amount) > 100)
                                ) && (
                                    <p className="text-xs text-yellow-400 mt-1">⚠️ Số tiền lớn - Cần Admin duyệt</p>
                                )}
                            </div>

                            {/* Hạng mục */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Hạng mục</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="glass-input w-full p-3 rounded-lg"
                                    required
                                >
                                    {allowedCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                {selectedAccount?.allowedCategories && selectedAccount.allowedCategories.length > 0 && (
                                    <p className="text-xs text-blue-400 mt-1">Tài khoản giới hạn {selectedAccount.allowedCategories.length} hạng mục</p>
                                )}
                            </div>

                            {/* Quỹ / Nguồn */}
                            <div>
                                {type === "OUT" ? (
                                    <>
                                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Quỹ chi (tuỳ chọn)</label>
                                        <select
                                            value={fundId}
                                            onChange={(e) => setFundId(e.target.value)}
                                            className="glass-input w-full p-3 rounded-lg"
                                        >
                                            <option value="">-- Không chọn --</option>
                                            {funds.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>
                                    </>
                                ) : (
                                    <>
                                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Nguồn tiền</label>
                                        <select
                                            value={source}
                                            onChange={(e) => setSource(e.target.value)}
                                            className="glass-input w-full p-3 rounded-lg"
                                        >
                                            <option value="">-- Chọn nguồn --</option>
                                            <option value="COD VET">COD VET</option>
                                            <option value="COD JNT">COD JNT</option>
                                            <option value="Khách CK">Khách chuyển khoản</option>
                                            <option value="Khác">Khác</option>
                                        </select>
                                    </>
                                )}
                            </div>

                            {/* Chứng từ */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                                    📎 Đính kèm chứng từ {type === "OUT" && <span className="text-yellow-400">(Khuyến khích)</span>}
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={e => setFiles(Array.from(e.target.files || []))}
                                    className="glass-input w-full p-2 rounded-lg"
                                />
                                {files.length > 0 && (
                                    <p className="text-xs text-green-400 mt-1">✓ {files.length} ảnh đã chọn</p>
                                )}
                            </div>

                            {/* Ghi chú */}
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Ghi chú / Mô tả</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="glass-input w-full p-3 rounded-lg"
                                    rows={2}
                                    placeholder="VD: Chi tiền cước vận chuyển đơn hàng #123..."
                                />
                            </div>
                        </div>
                    )}

                    {/* ========== PREVIEW & SUBMIT ========== */}
                    {canEnterDetails && amount && parseFloat(amount) > 0 && (
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                            <h4 className="text-sm font-bold text-white mb-3">📋 Xác nhận giao dịch</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Dự án:</span>
                                    <span className="text-white font-medium">{selectedProject?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Tài khoản:</span>
                                    <span className="text-white font-medium">{selectedAccount?.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Số tiền:</span>
                                    <span className={`font-bold ${type === "IN" ? "text-green-400" : "text-red-400"}`}>
                                        {type === "IN" ? "+" : "-"}{parseFloat(amount).toLocaleString()} {currency}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--muted)]">Hạng mục:</span>
                                    <span className="text-white">{category}</span>
                                </div>
                                <div className="flex justify-between pt-2 border-t border-white/10">
                                    <span className="text-[var(--muted)]">Trạng thái:</span>
                                    {(currency === "VND" && parseFloat(amount) > 5000000) ||
                                     ((currency === "USD" || currency === "KHR" || currency === "TRY") && parseFloat(amount) > 100) ? (
                                        <span className="text-yellow-400 font-medium">⏳ Chờ duyệt</span>
                                    ) : (
                                        <span className="text-green-400 font-medium">✓ Tự động duyệt</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    {canEnterDetails && (
                        <button
                            type="submit"
                            disabled={loading || !amount || parseFloat(amount) <= 0}
                            className="w-full p-4 rounded-xl font-bold text-lg bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {loading ? "⏳ Đang xử lý..." : `💾 Lưu ${type === "IN" ? "Thu tiền" : "Chi tiền"}`}
                        </button>
                    )}

                    {/* Progress indicator */}
                    {!canEnterDetails && (
                        <div className="text-center py-6 text-[var(--muted)]">
                            <div className="flex justify-center gap-2 mb-4">
                                <div className={`w-3 h-3 rounded-full ${projectId ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></div>
                                <div className={`w-3 h-3 rounded-full ${accountId ? 'bg-green-500' : projectId ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`}></div>
                                <div className={`w-3 h-3 rounded-full ${accountId ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                            </div>
                            <p>
                                {!projectId && "👆 Vui lòng chọn dự án để tiếp tục"}
                                {projectId && !accountId && "👆 Vui lòng chọn tài khoản để tiếp tục"}
                            </p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
