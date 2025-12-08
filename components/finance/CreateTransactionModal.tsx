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
    "SIM",
    "Văn phòng",
    "Ads",
    "Lương", // Added generic for Salary as requested in overview
    "Vận hành", // Added generic for Operation
    "Khác"
];

export default function CreateTransactionModal({ isOpen, onClose, onSuccess, currentUser }: CreateTransactionModalProps) {
    const [type, setType] = useState<TransactionType>("OUT");
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
    const [accountId, setAccountId] = useState("");
    const [description, setDescription] = useState("");

    // New Fields
    const [projectId, setProjectId] = useState("");
    const [fundId, setFundId] = useState("");
    const [source, setSource] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    const [loading, setLoading] = useState(false);

    // Data
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [funds, setFunds] = useState<Fund[]>([]);

    // Filter projects and accounts based on user role
    const accessibleProjects = useMemo(() => {
        return getAccessibleProjects(currentUser, projects);
    }, [currentUser, projects]);

    const accessibleProjectIds = useMemo(() => {
        return accessibleProjects.map(p => p.id);
    }, [accessibleProjects]);

    const accessibleAccounts = useMemo(() => {
        return getAccessibleAccounts(currentUser, accounts, accessibleProjectIds);
    }, [currentUser, accounts, accessibleProjectIds]);

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

                    // Fetch Funds manually (or move to lib)
                    const fundsSnapshot = await getDocs(collection(db, "finance_funds"));
                    setFunds(fundsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Fund)));
                } catch (error) {
                    console.error("Failed to load data for Transaction Modal:", error);
                }
            };
            fetchData();
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
                if ((currency === "USD" || currency === "KHR") && numAmount > 100) status = "PENDING";
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
                    alert("Lỗi khi tải ảnh lên. Vui lòng thử lại hoặc bỏ qua ảnh.");
                    setLoading(false);
                    return; // Stop execution if upload fails
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

            // Update Balance if approved immediately
            if (status === "APPROVED") {
                const account = accounts.find(a => a.id === accountId);
                if (account) {
                    const newBalance = type === "IN"
                        ? account.balance + numAmount
                        : account.balance - numAmount;
                    await updateAccountBalance(accountId, newBalance);
                }
            }

            // Check for potential balance update errors or inconsistencies here if needed

            onSuccess();
            onClose();
            // Reset
            setAmount("");
            setDescription("");
            setFiles([]);
            setProjectId("");
            setFundId("");
        } catch (error) {
            console.error("Failed to create transaction", error);
            alert("Đã xảy ra lỗi khi tạo giao dịch.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl p-6 rounded-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={onClose} className="absolute top-4 right-4 text-[var(--muted)] hover:text-white">✕</button>

                <h2 className="text-2xl font-bold mb-6">New Transaction</h2>

                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setType("IN")}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${type === "IN" ? "bg-green-600 text-white" : "bg-[var(--card-hover)] text-[var(--muted)]"
                            }`}
                    >
                        Income (Thu)
                    </button>
                    <button
                        onClick={() => setType("OUT")}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${type === "OUT" ? "bg-red-600 text-white" : "bg-[var(--card-hover)] text-[var(--muted)]"
                            }`}
                    >
                        Expense (Chi)
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Row 1: Amount & Currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Amount</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="glass-input w-full p-2 rounded-lg"
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Currency</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value as Currency)}
                                className="glass-input w-full p-2 rounded-lg"
                            >
                                <option value="USD">USD</option>
                                <option value="VND">VND</option>
                                <option value="KHR">KHR</option>
                            </select>
                        </div>
                    </div>

                    {/* Row 2: Account & Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Account</label>
                            <select
                                value={accountId}
                                onChange={(e) => {
                                    const newAccId = e.target.value;
                                    setAccountId(newAccId);
                                    // Auto-set project from account
                                    const acc = accessibleAccounts.find(a => a.id === newAccId);
                                    if (acc?.projectId) {
                                        setProjectId(acc.projectId);
                                    }
                                }}
                                className="glass-input w-full p-2 rounded-lg"
                                required
                            >
                                <option value="">Select Account</option>
                                {accessibleAccounts
                                    .filter(a => !projectId || !a.projectId || a.projectId === projectId)
                                    .map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.currency}) {acc.projectId ? `[${accessibleProjects.find(p => p.id === acc.projectId)?.name}]` : ""}
                                        </option>
                                    ))}
                            </select>
                            {currentUser?.role === "STAFF" && accessibleAccounts.length === 0 && (
                                <p className="text-xs text-yellow-400 mt-1">Bạn chưa được thêm vào dự án nào</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Category</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="glass-input w-full p-2 rounded-lg"
                            >
                                {getCategoriesForRole(currentUser?.role || "ADMIN", type === "IN" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Row 3: Project & Fund/Source */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-1">Project (Optional)</label>
                            <select
                                value={projectId}
                                onChange={(e) => {
                                    setProjectId(e.target.value);
                                    // Reset account if it doesn't match new project
                                    const currentAcc = accessibleAccounts.find(a => a.id === accountId);
                                    if (currentAcc?.projectId && currentAcc.projectId !== e.target.value) {
                                        setAccountId("");
                                    }
                                }}
                                className="glass-input w-full p-2 rounded-lg"
                            >
                                <option value="">Select Project</option>
                                {accessibleProjects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                            {currentUser?.role === "STAFF" && accessibleProjects.length === 0 && (
                                <p className="text-xs text-yellow-400 mt-1">Bạn chưa được thêm vào dự án nào</p>
                            )}
                        </div>

                        {type === "OUT" ? (
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Fund / Cost Group</label>
                                <select
                                    value={fundId}
                                    onChange={(e) => setFundId(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                >
                                    <option value="">Select Fund</option>
                                    {funds.map(f => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-[var(--muted)] mb-1">Source (Nguồn tiền)</label>
                                <select
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                    className="glass-input w-full p-2 rounded-lg"
                                >
                                    <option value="">Select Source</option>
                                    <option value="COD VET">COD VET</option>
                                    <option value="COD JNT">COD JNT</option>
                                    <option value="Khách CK">Khách CK</option>
                                    <option value="Khác">Khác</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Images */}
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Attachments (Images)</label>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={e => setFiles(Array.from(e.target.files || []))}
                            className="glass-input w-full p-2 rounded-lg"
                        />
                        <p className="text-xs text-[var(--muted)] mt-1">{files.length} file(s) selected</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Description / Note</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg"
                            rows={3}
                        />
                    </div>

                    <div className="pt-4 border-t border-white/10 mt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="glass-button w-full p-3 rounded-xl font-bold bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white border-none"
                        >
                            {loading ? "Processing..." : `Save ${type === "IN" ? "Income" : "Expense"}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
