"use client";

import { useState, useEffect, useMemo } from "react";
import { createTransaction, getAccounts, updateAccountBalance, getProjects } from "@/lib/finance";
import { Account, Currency, Project, Transaction } from "@/types/finance";
import { uploadImage } from "@/lib/upload";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, getAccessibleProjects, getAccessibleAccounts, Role } from "@/lib/permissions";

const INCOME_SOURCES = ["COD VET", "COD JNT", "Khách CK", "Khác"];

export default function IncomePage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("STAFF");

    // Form State
    const [amount, setAmount] = useState("");
    const [currency, setCurrency] = useState<Currency>("USD");
    const [source, setSource] = useState(INCOME_SOURCES[0]);
    const [accountId, setAccountId] = useState("");
    const [projectId, setProjectId] = useState("");
    const [description, setDescription] = useState("");
    const [files, setFiles] = useState<File[]>([]);

    // Filters
    const [filterDate, setFilterDate] = useState("");
    const [filterProject, setFilterProject] = useState("");
    const [filterAccount, setFilterAccount] = useState("");
    const [filterSource, setFilterSource] = useState("");

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) {
            const parsed = JSON.parse(u);
            setCurrentUser(parsed);
            setUserRole(getUserRole(parsed));
        }
    }, []);

    // Fetch data when user info is ready
    useEffect(() => {
        if (currentUser !== null) {
            fetchData();
        }
    }, [currentUser]);

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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accs, projs] = await Promise.all([
                getAccounts(),
                getProjects()
            ]);
            setAccounts(accs);
            setProjects(projs);
            await fetchTransactions();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchTransactions = async () => {
        if (!currentUser) return;
        
        try {
            const snapshot = await getDocs(collection(db, "finance_transactions"));
            let txs = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as Transaction))
                .filter(t => t.type === "IN");

            // Role-based filter: STAFF chỉ xem giao dịch của mình
            const role = getUserRole(currentUser);
            if (role === "STAFF") {
                const userId = currentUser.uid || currentUser.id;
                txs = txs.filter(t => t.userId === userId);
            }

            // Apply filters
            if (filterDate) {
                txs = txs.filter(t => t.date.startsWith(filterDate));
            }
            if (filterProject) {
                txs = txs.filter(t => t.projectId === filterProject);
            }
            if (filterAccount) {
                txs = txs.filter(t => t.accountId === filterAccount);
            }
            if (filterSource) {
                txs = txs.filter(t => t.source?.toLowerCase().includes(filterSource.toLowerCase()));
            }

            txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(txs);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (!loading) {
            fetchTransactions();
        }
    }, [filterDate, filterProject, filterAccount, filterSource]);

    // Auto-set project from account
    useEffect(() => {
        if (accountId) {
            const acc = accounts.find(a => a.id === accountId);
            if (acc?.projectId) {
                setProjectId(acc.projectId);
            }
        }
    }, [accountId, accounts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const numAmount = parseFloat(amount);

            // Upload Images
            const imageUrls: string[] = [];
            if (files.length > 0) {
                try {
                    for (const file of files.slice(0, 2)) {
                        const url = await uploadImage(file);
                        imageUrls.push(url);
                    }
                } catch (uploadError) {
                    console.error("Income Image upload failed:", uploadError);
                    alert("Lỗi khi tải ảnh lên. Vui lòng thử lại.");
                    setSubmitting(false);
                    return;
                }
            }

            // Create Transaction
            await createTransaction({
                type: "IN",
                amount: numAmount,
                currency,
                category: source,
                source,
                accountId,
                projectId: projectId || undefined,
                description,
                date: new Date().toISOString(),
                status: "APPROVED", // Income is auto-approved
                createdBy: currentUser?.name || currentUser?.displayName || "Unknown",
                userId: currentUser?.id || currentUser?.uid || "unknown",
                images: imageUrls,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });

            // Update Account Balance
            const account = accounts.find(a => a.id === accountId);
            if (account) {
                await updateAccountBalance(accountId, account.balance + numAmount);
            }

            // Reset form
            setAmount("");
            setDescription("");
            setFiles([]);
            fetchTransactions();
            alert("Đã thêm khoản thu thành công!");
        } catch (error) {
            console.error("Failed to create income", error);
            alert("Lỗi khi thêm khoản thu");
        } finally {
            setSubmitting(false);
        }
    };

    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || "-";
    const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || "-";

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Thu tiền (Tiền vào)</h1>
                <p className="text-[var(--muted)]">Quản lý các khoản thu nhập</p>
            </div>

            {/* Income Form */}
            <div className="glass-card p-6 rounded-xl">
                <h3 className="text-lg font-bold mb-4">Nhập khoản thu mới</h3>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Số tiền *</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="glass-input w-full p-2 rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Loại tiền tệ</label>
                        <select
                            value={currency}
                            onChange={e => setCurrency(e.target.value as Currency)}
                            className="glass-input w-full p-2 rounded-lg"
                        >
                            <option value="USD">USD</option>
                            <option value="VND">VND</option>
                            <option value="KHR">KHR</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Nguồn tiền *</label>
                        <select
                            value={source}
                            onChange={e => setSource(e.target.value)}
                            className="glass-input w-full p-2 rounded-lg"
                            required
                        >
                            {INCOME_SOURCES.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Dự án liên quan</label>
                        <select
                            value={projectId}
                            onChange={e => {
                                setProjectId(e.target.value);
                                const currentAcc = accessibleAccounts.find(a => a.id === accountId);
                                if (currentAcc?.projectId && currentAcc.projectId !== e.target.value) {
                                    setAccountId("");
                                }
                            }}
                            className="glass-input w-full p-2 rounded-lg"
                        >
                            <option value="">Không chọn (Chung)</option>
                            {accessibleProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        {userRole === "STAFF" && accessibleProjects.length === 0 && (
                            <p className="text-xs text-yellow-400 mt-1">Bạn chưa được thêm vào dự án nào</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Tài khoản nhận *</label>
                        <select
                            value={accountId}
                            onChange={e => {
                                const newAccId = e.target.value;
                                setAccountId(newAccId);
                                const acc = accessibleAccounts.find(a => a.id === newAccId);
                                if (acc?.projectId) {
                                    setProjectId(acc.projectId);
                                }
                            }}
                            className="glass-input w-full p-2 rounded-lg"
                            required
                        >
                            <option value="">Chọn tài khoản</option>
                            {accessibleAccounts
                                .filter(a => !projectId || !a.projectId || a.projectId === projectId)
                                .map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} ({a.currency}) {a.projectId ? `[${accessibleProjects.find(p => p.id === a.projectId)?.name}]` : ""}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Hình ảnh (tối đa 2)</label>
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 2))}
                            className="glass-input w-full p-2 rounded-lg text-sm"
                        />
                        <p className="text-xs text-[var(--muted)] mt-1">{files.length}/2 ảnh đã chọn</p>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-[var(--muted)] mb-1">Ghi chú</label>
                        <input
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Ghi chú thêm..."
                            className="glass-input w-full p-2 rounded-lg"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="glass-button w-full p-3 rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white border-none"
                        >
                            {submitting ? "Đang lưu..." : "+ Thêm khoản thu"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        type="date"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        className="glass-input p-2 rounded-lg text-sm"
                        placeholder="Ngày"
                    />
                    <select
                        value={filterProject}
                        onChange={e => setFilterProject(e.target.value)}
                        className="glass-input p-2 rounded-lg text-sm"
                    >
                        <option value="">Tất cả dự án</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                        value={filterAccount}
                        onChange={e => setFilterAccount(e.target.value)}
                        className="glass-input p-2 rounded-lg text-sm"
                    >
                        <option value="">Tất cả tài khoản</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <select
                        value={filterSource}
                        onChange={e => setFilterSource(e.target.value)}
                        className="glass-input p-2 rounded-lg text-sm"
                    >
                        <option value="">Tất cả nguồn tiền</option>
                        {INCOME_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="glass-card rounded-xl overflow-hidden border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#1a1a1a] text-[var(--muted)] uppercase text-xs font-semibold tracking-wider">
                            <tr>
                                <th className="p-4 border-b border-white/10">STT</th>
                                <th className="p-4 border-b border-white/10">Ngày</th>
                                <th className="p-4 border-b border-white/10">Số tiền</th>
                                <th className="p-4 border-b border-white/10">Nguồn</th>
                                <th className="p-4 border-b border-white/10">Tài khoản</th>
                                <th className="p-4 border-b border-white/10">Dự án</th>
                                <th className="p-4 border-b border-white/10">Người nhập</th>
                                <th className="p-4 border-b border-white/10">Ảnh</th>
                                <th className="p-4 border-b border-white/10">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {transactions.map((tx, idx) => (
                                <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 text-[var(--muted)]">{idx + 1}</td>
                                    <td className="p-4 text-white">{new Date(tx.date).toLocaleDateString()}</td>
                                    <td className="p-4 text-green-400 font-bold">
                                        +{tx.amount.toLocaleString()} <span className="text-xs">{tx.currency}</span>
                                    </td>
                                    <td className="p-4">{tx.source || tx.category}</td>
                                    <td className="p-4">{getAccountName(tx.accountId)}</td>
                                    <td className="p-4">{tx.projectId ? getProjectName(tx.projectId) : "-"}</td>
                                    <td className="p-4 text-[var(--muted)]">{tx.createdBy}</td>
                                    <td className="p-4">
                                        {tx.images && tx.images.length > 0 ? (
                                            <div className="flex gap-1">
                                                {tx.images.map((img, i) => (
                                                    <a key={i} href={img} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">
                                                        📎
                                                    </a>
                                                ))}
                                            </div>
                                        ) : "-"}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${tx.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                                            tx.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400" :
                                                "bg-red-500/20 text-red-400"
                                            }`}>
                                            {tx.status === "APPROVED" ? "Đã duyệt" : tx.status === "PENDING" ? "Chờ duyệt" : "Từ chối"}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-[var(--muted)]">
                                        Chưa có dữ liệu khoản thu
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
