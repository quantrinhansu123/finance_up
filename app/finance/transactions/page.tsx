"use client";

import { useEffect, useState, useMemo } from "react";
import TransactionList from "@/components/finance/TransactionList";
import { getTransactions } from "@/lib/finance";
import { Transaction } from "@/types/finance";
import { getUserRole, getAccessibleProjects, hasProjectPermission, Role } from "@/lib/permissions";
import Link from "next/link";

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");

    // Filters
    const [filterDate, setFilterDate] = useState("");
    const [filterProject, setFilterProject] = useState("");
    const [filterSource, setFilterSource] = useState("");
    const [filterAccount, setFilterAccount] = useState("");
    const [filterType, setFilterType] = useState<"" | "IN" | "OUT">("");
    const [filterStatus, setFilterStatus] = useState("");

    // Filter Options Data
    const [projects, setProjects] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);

    useEffect(() => {
        const storedUser = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setCurrentUser(parsedUser);
            const computedRole = getUserRole(parsedUser);
            setUserRole(computedRole);
        }

        // Load Filter Options
        import("@/lib/finance").then(async (mod) => {
            const [p, a] = await Promise.all([mod.getProjects(), mod.getAccounts()]);
            setProjects(p);
            setAccounts(a);
        });
    }, []);

    // Lọc dự án user có quyền xem giao dịch
    const accessibleProjects = useMemo(() => {
        if (!currentUser) return [];
        if (userRole === "ADMIN") return projects;
        
        const userId = currentUser?.uid || currentUser?.id;
        if (!userId) return [];
        
        return getAccessibleProjects(currentUser, projects).filter(p => 
            hasProjectPermission(userId, p, "view_transactions", currentUser)
        );
    }, [currentUser, userRole, projects]);

    const accessibleProjectIds = useMemo(() => accessibleProjects.map(p => p.id), [accessibleProjects]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const data = await getTransactions();

            // 1. Filter theo quyền dự án
            let filteredData = data;
            if (userRole !== "ADMIN") {
                // User chỉ xem giao dịch của dự án mình có quyền view_transactions
                // HOẶC giao dịch do chính mình tạo
                const userId = currentUser?.uid || currentUser?.id;
                filteredData = data.filter(tx => 
                    (tx.projectId && accessibleProjectIds.includes(tx.projectId)) ||
                    tx.userId === userId ||
                    tx.createdBy === currentUser?.displayName ||
                    tx.createdBy === currentUser?.email
                );
            }

            // 2. UI Filters
            if (filterDate) {
                filteredData = filteredData.filter(tx => tx.date.startsWith(filterDate));
            }
            if (filterProject) {
                filteredData = filteredData.filter(tx => tx.projectId === filterProject);
            }
            if (filterAccount) {
                filteredData = filteredData.filter(tx => tx.accountId === filterAccount);
            }
            if (filterType) {
                filteredData = filteredData.filter(tx => tx.type === filterType);
            }
            if (filterStatus) {
                filteredData = filteredData.filter(tx => tx.status === filterStatus);
            }
            if (filterSource) {
                const term = filterSource.toLowerCase();
                filteredData = filteredData.filter(tx =>
                    (tx.source?.toLowerCase().includes(term)) ||
                    (tx.category?.toLowerCase().includes(term)) ||
                    (tx.description?.toLowerCase().includes(term))
                );
            }

            // Sort by date desc
            filteredData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setTransactions(filteredData);
        } catch (error) {
            console.error("Failed to fetch transactions", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser && projects.length > 0) {
            fetchTransactions();
        }
    }, [currentUser, accessibleProjectIds, filterDate, filterProject, filterAccount, filterSource, filterType, filterStatus]);

    // Stats
    const totalIn = transactions.filter(t => t.type === "IN" && t.status === "APPROVED").reduce((sum, t) => sum + t.amount, 0);
    const totalOut = transactions.filter(t => t.type === "OUT" && t.status === "APPROVED").reduce((sum, t) => sum + t.amount, 0);
    const pendingCount = transactions.filter(t => t.status === "PENDING").length;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Lịch sử Giao dịch</h1>
                    <p className="text-[var(--muted)]">Xem tất cả giao dịch thu chi</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/finance/income"
                        className="glass-button px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/30"
                    >
                        💰 Thu tiền
                    </Link>
                    <Link
                        href="/finance/expense"
                        className="glass-button px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-red-600/20 text-red-400 border-red-600/30 hover:bg-red-600/30"
                    >
                        💸 Chi tiền
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-xl">
                    <p className="text-xs text-[var(--muted)] uppercase">Tổng giao dịch</p>
                    <p className="text-2xl font-bold text-white">{transactions.length}</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <p className="text-xs text-[var(--muted)] uppercase">Tổng thu</p>
                    <p className="text-2xl font-bold text-green-400">+{totalIn.toLocaleString()}</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <p className="text-xs text-[var(--muted)] uppercase">Tổng chi</p>
                    <p className="text-2xl font-bold text-red-400">-{totalOut.toLocaleString()}</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <p className="text-xs text-[var(--muted)] uppercase">Chờ duyệt</p>
                    <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 rounded-xl">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <input
                        type="date"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        className="glass-input p-2 rounded-lg w-full text-sm"
                    />
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as any)}
                        className="glass-input p-2 rounded-lg w-full text-sm"
                    >
                        <option value="">Tất cả loại</option>
                        <option value="IN">💰 Thu</option>
                        <option value="OUT">💸 Chi</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="glass-input p-2 rounded-lg w-full text-sm"
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="APPROVED">✓ Đã duyệt</option>
                        <option value="PENDING">⏳ Chờ duyệt</option>
                        <option value="REJECTED">✗ Từ chối</option>
                    </select>
                    <select
                        value={filterProject}
                        onChange={e => setFilterProject(e.target.value)}
                        className="glass-input p-2 rounded-lg w-full text-sm"
                    >
                        <option value="">Tất cả dự án</option>
                        {accessibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                        value={filterAccount}
                        onChange={e => setFilterAccount(e.target.value)}
                        className="glass-input p-2 rounded-lg w-full text-sm"
                    >
                        <option value="">Tất cả tài khoản</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <input
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={filterSource}
                        onChange={e => setFilterSource(e.target.value)}
                        className="glass-input p-2 rounded-lg w-full text-sm"
                    />
                </div>
                {(filterDate || filterType || filterStatus || filterProject || filterAccount || filterSource) && (
                    <button
                        onClick={() => {
                            setFilterDate("");
                            setFilterType("");
                            setFilterStatus("");
                            setFilterProject("");
                            setFilterAccount("");
                            setFilterSource("");
                        }}
                        className="mt-3 text-sm text-blue-400 hover:text-blue-300"
                    >
                        ✕ Xóa bộ lọc
                    </button>
                )}
            </div>

            {loading ? (
                <div className="glass-card h-64 animate-pulse rounded-xl"></div>
            ) : (
                <TransactionList transactions={transactions} />
            )}
        </div>
    );
}
