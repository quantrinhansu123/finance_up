"use client";

import { useEffect, useState, useMemo } from "react";
import { getTransactions } from "@/lib/finance";
import { Transaction } from "@/types/finance";
import { getUserRole, getAccessibleProjects, hasProjectPermission, Role } from "@/lib/permissions";
import Link from "next/link";
import DataTableToolbar from "@/components/finance/DataTableToolbar";
import { exportToCSV } from "@/lib/export";
import DataTable, { AmountCell, DateCell, TextCell, StatusBadge, ImageCell } from "@/components/finance/DataTable";
import { useTranslation } from "@/lib/i18n";

import { Eye } from "lucide-react";
import TransactionDetailModal from "@/components/finance/TransactionDetailModal";

export default function TransactionsPage() {
    const { t } = useTranslation();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [userRole, setUserRole] = useState<Role>("USER");

    // Modal State
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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
                    <h1 className="text-3xl font-bold text-white">{t("transaction_history")}</h1>
                    <p className="text-[var(--muted)]">{t("view_all_transactions")}</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/finance/income"
                        className="glass-button px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/30"
                    >
                        💰 {t("income")}
                    </Link>
                    <Link
                        href="/finance/expense"
                        className="glass-button px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-red-600/20 text-red-400 border-red-600/30 hover:bg-red-600/30"
                    >
                        💸 {t("expense")}
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-xl">
                    <p className="text-xs text-[var(--muted)] uppercase">{t("quick_stats_total_tx")}</p>
                    <p className="text-2xl font-bold text-white">{transactions.length}</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <p className="text-xs text-[var(--muted)] uppercase">{t("quick_stats_total_in")}</p>
                    <p className="text-2xl font-bold text-green-400">+{totalIn.toLocaleString()}</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <p className="text-xs text-[var(--muted)] uppercase">{t("quick_stats_total_out")}</p>
                    <p className="text-2xl font-bold text-red-400">-{totalOut.toLocaleString()}</p>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <p className="text-xs text-[var(--muted)] uppercase">{t("quick_stats_pending")}</p>
                    <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
                </div>
            </div>

            {/* Reusable Toolbar */}
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <DataTableToolbar
                    searchPlaceholder={t("search_transaction_placeholder")}
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
                            date: t("date"),
                            type: t("type"),
                            amount: t("amount"),
                            currency: t("currency"),
                            category: t("category"),
                            source: t("source"),
                            description: t("description"),
                            status: t("status"),
                            createdBy: t("creator")
                        });
                    }}
                    filters={[
                        {
                            id: "type",
                            label: t("all_types"),
                            options: [
                                { value: "IN", label: `💰 ${t("income")}` },
                                { value: "OUT", label: `💸 ${t("expense")}` }
                            ]
                        },
                        {
                            id: "status",
                            label: t("status"),
                            options: [
                                { value: "APPROVED", label: `✓ ${t("approved")}` },
                                { value: "PENDING", label: `⏳ ${t("pending")}` },
                                { value: "REJECTED", label: `✗ ${t("rejected_label")}` }
                            ]
                        },
                        {
                            id: "projectId",
                            label: t("project"),
                            options: accessibleProjects.map(p => ({ value: p.id, label: p.name })),
                            advanced: true
                        },
                        {
                            id: "accountId",
                            label: t("account"),
                            options: accounts.map(a => ({ value: a.id, label: a.name })),
                            advanced: true
                        },
                        {
                            id: "date",
                            label: t("date"),
                            options: Array.from(new Set(transactions.map(t => t.date.split("T")[0]))).sort().reverse().map(d => ({ value: d, label: d })),
                            advanced: true
                        }
                    ]}
                />
            </div>

            <DataTable
                data={transactions}
                colorScheme="blue"
                isLoading={loading}
                emptyMessage={t("no_transactions_found")}
                onRowClick={(tx) => {
                    setSelectedTransaction(tx);
                    setIsModalOpen(true);
                }}
                columns={[
                    {
                        key: "date",
                        header: t("date"),
                        render: (tx) => <DateCell date={tx.date} />
                    },
                    {
                        key: "amount",
                        header: t("amount"),
                        align: "right",
                        render: (tx) => <AmountCell amount={tx.amount} type={tx.type} currency={tx.currency} />
                    },
                    {
                        key: "category",
                        header: t("category_source"),
                        render: (tx) => <TextCell primary={tx.type === "IN" ? (tx.source || tx.category || "") : (tx.category || "")} secondary={tx.description} />
                    },
                    {
                        key: "account",
                        header: t("account"),
                        render: (tx) => <span className="text-white font-medium">{getAccountName(tx.accountId)}</span>
                    },
                    {
                        key: "project",
                        header: t("project"),
                        render: (tx) => <span className="text-white font-medium">{tx.projectId ? getProjectName(tx.projectId) : "-"}</span>
                    },
                    {
                        key: "user",
                        header: t("creator"),
                        render: (tx) => <span className="text-xs text-white/70">{tx.createdBy}</span>
                    },
                    {
                        key: "images",
                        header: t("images"),
                        align: "center",
                        render: (tx) => <ImageCell images={tx.images} />
                    },
                    {
                        key: "status",
                        header: t("status"),
                        align: "center",
                        render: (tx) => <StatusBadge status={tx.status} />
                    },
                    {
                        key: "actions",
                        header: "",
                        className: "w-10",
                        render: (tx) => (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTransaction(tx);
                                    setIsModalOpen(true);
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                            >
                                <Eye size={16} />
                            </button>
                        )
                    }
                ]}
            />

            <TransactionDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                transaction={selectedTransaction}
                accountName={selectedTransaction ? getAccountName(selectedTransaction.accountId) : undefined}
                projectName={selectedTransaction?.projectId ? getProjectName(selectedTransaction.projectId) : undefined}
            />
        </div>
    );
}
