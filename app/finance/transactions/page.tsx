"use client";

import { useEffect, useState, useMemo } from "react";
import { getTransactions } from "@/lib/finance";
import { Transaction } from "@/types/finance";
import { getUserRole, getAccessibleProjects, hasProjectPermission, Role } from "@/lib/permissions";
import Link from "next/link";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { AmountCell, DateCell, TextCell, StatusBadge, ImageCell } from "@/components/finance/DataTable";

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");

    const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
        startDate: "",
        endDate: "",
        date: "",
        type: "",
        status: "",
        projectId: "",
        accountId: "",
    });
    const [searchTerm, setSearchTerm] = useState("");

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
            if (activeFilters.startDate) {
                filteredData = filteredData.filter(tx => tx.date.split("T")[0] >= activeFilters.startDate);
            }
            if (activeFilters.endDate) {
                filteredData = filteredData.filter(tx => tx.date.split("T")[0] <= activeFilters.endDate);
            }
            if (activeFilters.date) {
                filteredData = filteredData.filter(tx => tx.date.startsWith(activeFilters.date));
            }
            if (activeFilters.projectId) {
                filteredData = filteredData.filter(tx => tx.projectId === activeFilters.projectId);
            }
            if (activeFilters.accountId) {
                filteredData = filteredData.filter(tx => tx.accountId === activeFilters.accountId);
            }
            if (activeFilters.type) {
                filteredData = filteredData.filter(tx => tx.type === activeFilters.type);
            }
            if (activeFilters.status) {
                filteredData = filteredData.filter(tx => tx.status === activeFilters.status);
            }
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                filteredData = filteredData.filter(tx =>
                    (tx.source?.toLowerCase().includes(term)) ||
                    (tx.category?.toLowerCase().includes(term)) ||
                    (tx.description?.toLowerCase().includes(term)) ||
                    (tx.createdBy?.toLowerCase().includes(term))
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
    }, [currentUser, accessibleProjectIds, activeFilters, searchTerm]);

    // Stats
    const totalIn = transactions.filter(t => t.type === "IN" && t.status === "APPROVED").reduce((sum, t) => sum + t.amount, 0);
    const totalOut = transactions.filter(t => t.type === "OUT" && t.status === "APPROVED").reduce((sum, t) => sum + t.amount, 0);
    const pendingCount = transactions.filter(t => t.status === "PENDING").length;

    const getAccountName = (id: string) => accounts.find(a => a.id === id)?.name || id.slice(0, 8) + "...";
    const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || id.slice(0, 8) + "...";

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

            {/* Reusable Toolbar */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <DataTableToolbar
                    searchPlaceholder="Tìm mã GD, nội dung, người tạo..."
                    onSearch={setSearchTerm}
                    activeFilters={activeFilters}
                    onFilterChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                    enableDateRange={true}
                    onReset={() => {
                        setActiveFilters({
                            startDate: "",
                            endDate: "",
                            date: "",
                            type: "",
                            status: "",
                            projectId: "",
                            accountId: "",
                        });
                        setSearchTerm("");
                    }}
                    onExport={() => {
                        exportToCSV(transactions, "Giao_Dich", {
                            date: "Ngày",
                            type: "Loại",
                            amount: "Số tiền",
                            currency: "Tiện tệ",
                            category: "Hạng mục",
                            source: "Nguồn",
                            description: "Ghi chú",
                            status: "Trạng thái",
                            createdBy: "Người tạo"
                        });
                    }}
                    filters={[
                        {
                            id: "type",
                            label: "Tất cả loại",
                            options: [
                                { value: "IN", label: "💰 Thu tiền" },
                                { value: "OUT", label: "💸 Chi tiền" }
                            ]
                        },
                        {
                            id: "status",
                            label: "Trạng thái",
                            options: [
                                { value: "APPROVED", label: "✓ Đã duyệt" },
                                { value: "PENDING", label: "⏳ Chờ duyệt" },
                                { value: "REJECTED", label: "✗ Từ chối" }
                            ]
                        },
                        {
                            id: "projectId",
                            label: "Dự án",
                            options: accessibleProjects.map(p => ({ value: p.id, label: p.name })),
                            advanced: true
                        },
                        {
                            id: "accountId",
                            label: "Tài khoản",
                            options: accounts.map(a => ({ value: a.id, label: a.name })),
                            advanced: true
                        },
                        {
                            id: "date",
                            label: "Ngày",
                            options: Array.from(new Set(transactions.map(t => t.date.split("T")[0]))).sort().reverse().map(d => ({ value: d, label: d })),
                            advanced: true
                        }
                    ]}
                />
            </div>

            {loading ? (
                <div className="glass-card h-64 animate-pulse rounded-xl"></div>
            ) : (
                <DataTable
                    data={transactions}
                    colorScheme="blue"
                    emptyMessage="Không tìm thấy giao dịch"
                    columns={[
                        {
                            key: "date",
                            header: "Ngày",
                            render: (tx) => <DateCell date={tx.date} />
                        },
                        {
                            key: "amount",
                            header: "Số tiền",
                            align: "right",
                            render: (tx) => <AmountCell amount={tx.amount} type={tx.type} currency={tx.currency} />
                        },
                        {
                            key: "category",
                            header: "Nguồn/Hạng mục",
                            render: (tx) => <TextCell primary={tx.type === "IN" ? (tx.source || tx.category || "") : (tx.category || "")} secondary={tx.description} />
                        },
                        {
                            key: "account",
                            header: "Tài khoản",
                            render: (tx) => <span className="text-white font-medium">{getAccountName(tx.accountId)}</span>
                        },
                        {
                            key: "project",
                            header: "Dự án",
                            render: (tx) => <span className="text-white font-medium">{tx.projectId ? getProjectName(tx.projectId) : "-"}</span>
                        },
                        {
                            key: "user",
                            header: "Người tạo",
                            render: (tx) => <span className="text-xs text-white/70">{tx.createdBy}</span>
                        },
                        {
                            key: "images",
                            header: "Ảnh",
                            align: "center",
                            render: (tx) => <ImageCell images={tx.images} />
                        },
                        {
                            key: "status",
                            header: "Trạng thái",
                            align: "center",
                            render: (tx) => <StatusBadge status={tx.status} />
                        }
                    ]}
                />
            )}
        </div>
    );
}
