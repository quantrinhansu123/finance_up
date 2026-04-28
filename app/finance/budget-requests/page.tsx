"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Transaction, Account, Project, TransactionStatus } from "@/types/finance";
import { getTransactions, getAccounts, getProjects, deleteTransaction } from "@/lib/finance";
import { getUserRole, hasProjectPermission, getAccessibleProjects } from "@/lib/permissions";
import DataTable from "@/components/finance/DataTable";
import { Plus, Filter, RefreshCw, Upload, CheckCircle, Clock, ArrowRightCircle, XCircle, AlertTriangle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import CreateBudgetRequestModal from "../../../components/finance/CreateBudgetRequestModal";
import BudgetRequestDetailModal from "../../../components/finance/BudgetRequestDetailModal";

type TabType = "all" | "pending" | "approved" | "paid" | "completed" | "rejected";

export default function BudgetRequestsPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [allAccounts, setAllAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>("all");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) setCurrentUser(JSON.parse(u));
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [allTxs, accounts, projects] = await Promise.all([
                getTransactions(),
                getAccounts(),
                getProjects()
            ]);

            setAllProjects(projects);
            setAllAccounts(accounts);

            // Get user from storage for filtering
            const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
            const user = userStr ? JSON.parse(userStr) : null;
            const role = getUserRole(user);

            // Filter only Budget Requests
            let budgetRequests = allTxs.filter(tx =>
                (tx.beneficiary && tx.beneficiary.length > 0) ||
                (tx.category && tx.category.toLowerCase().includes("nạp quỹ")) ||
                (tx.category && tx.category.toLowerCase().includes("marketing"))
            );

            // Filter by accessible projects (unless ADMIN)
            if (role !== "ADMIN") {
                const accessibleProjects = getAccessibleProjects(user, projects);
                const accessibleProjectIds = accessibleProjects.map(p => p.id);

                budgetRequests = budgetRequests.filter(tx =>
                    // User can see their own requests
                    tx.userId === user?.uid || tx.userId === user?.id ||
                    // Or requests in projects they have access to
                    (tx.projectId && accessibleProjectIds.includes(tx.projectId))
                );
            }

            // Sort by date desc
            setTransactions(budgetRequests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        } catch (error) {
            console.error("Failed to fetch budget requests", error);
        } finally {
            setLoading(false);
        }
    };

    // Check if user can create budget requests
    const canCreateRequest = () => {
        if (!currentUser) return false;
        const role = getUserRole(currentUser);
        const financeRole = currentUser?.financeRole;

        // ADMIN can always create
        if (role === "ADMIN") return true;

        // Users with specific finance roles can create
        if (financeRole === "MANAGER" || financeRole === "ADMIN" || financeRole === "STAFF") return true;

        // Check if user has request_budget permission in any accessible project
        const accessibleProjects = getAccessibleProjects(currentUser, allProjects);
        return accessibleProjects.some(project =>
            hasProjectPermission(currentUser?.uid || currentUser?.id, project, "request_budget", currentUser)
        );
    };

    // Handle delete request (only for PENDING status)
    const handleDeleteRequest = async (tx: Transaction, e: React.MouseEvent) => {
        e.stopPropagation();

        if (tx.status !== "PENDING") {
            alert("Chỉ có thể xóa yêu cầu ở trạng thái Chờ duyệt");
            return;
        }

        // Only creator or admin can delete
        const isCreator = currentUser?.uid === tx.userId || currentUser?.id === tx.userId;
        const role = getUserRole(currentUser);
        if (!isCreator && role !== "ADMIN") {
            alert("Bạn không có quyền xóa yêu cầu này");
            return;
        }

        if (!confirm("Bạn có chắc chắn muốn xóa yêu cầu này?")) return;

        try {
            await deleteTransaction(tx.id);
            fetchData();
        } catch (error) {
            console.error("Failed to delete request", error);
            alert("Lỗi khi xóa yêu cầu");
        }
    };

    const getFilteredData = () => {
        if (!currentUser) return [];
        let data = transactions;

        // Tab Filtering
        switch (activeTab) {
            case "pending":
                data = data.filter(tx => tx.status === "PENDING");
                break;
            case "approved":
                data = data.filter(tx => tx.status === "APPROVED");
                break;
            case "paid":
                data = data.filter(tx => tx.status === "PAID");
                break;
            case "completed":
                data = data.filter(tx => tx.status === "COMPLETED");
                break;
            case "rejected":
                data = data.filter(tx => tx.status === "REJECTED");
                break;
        }

        return data;
    };

    const getStatusBadge = (status: TransactionStatus) => {
        switch (status) {
            case "PENDING": return <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-medium">Chờ duyệt</span>;
            case "APPROVED": return <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-medium">Đã duyệt (Chờ TT)</span>;
            case "PAID": return <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs font-medium">Đã TT (Chờ xác nhận)</span>;
            case "COMPLETED": return <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-medium">Hoàn thành</span>;
            case "REJECTED": return <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-medium">Từ chối</span>;
            default: return <span>{status}</span>;
        }
    };

    const tabs: { key: TabType; label: string; icon?: React.ReactNode; color?: string }[] = [
        { key: "all", label: t("all") },
        { key: "pending", label: t("pending"), icon: <Clock size={14} />, color: "text-yellow-400" },
        { key: "approved", label: t("pending_payment"), icon: <AlertTriangle size={14} />, color: "text-blue-400" },
        { key: "paid", label: t("pending_confirmation"), icon: <ArrowRightCircle size={14} />, color: "text-purple-400" },
        { key: "completed", label: t("completed"), icon: <CheckCircle size={14} />, color: "text-green-400" },
        { key: "rejected", label: t("rejected"), icon: <XCircle size={14} />, color: "text-red-400" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{t("budget_requests")}</h1>
                    <p className="text-[var(--muted)]">Quy trình: Tạo yêu cầu → Duyệt → Kế toán chuyển khoản → Xác nhận nhận tiền</p>
                </div>
                {canCreateRequest() && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-lg shadow-blue-600/20"
                    >
                        <Plus size={18} />
                        {t("request_budget")}
                    </button>
                )}
            </div>

            {/* Stats Cards - 5 cards including REJECTED */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="glass-card p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[var(--muted)] text-sm">Chờ Duyệt</span>
                        <Clock size={16} className="text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold text-yellow-400">
                        {transactions.filter(t => t.status === "PENDING").length}
                    </div>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[var(--muted)] text-sm">Chờ Thanh Toán</span>
                        <Upload size={16} className="text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-400">
                        {transactions.filter(t => t.status === "APPROVED").length}
                    </div>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[var(--muted)] text-sm">Chờ Xác Nhận</span>
                        <ArrowRightCircle size={16} className="text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400">
                        {transactions.filter(t => t.status === "PAID").length}
                    </div>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[var(--muted)] text-sm">Hoàn Thành</span>
                        <CheckCircle size={16} className="text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                        {transactions.filter(t => t.status === "COMPLETED").length}
                    </div>
                </div>
                <div className="glass-card p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[var(--muted)] text-sm">Từ Chối</span>
                        <XCircle size={16} className="text-red-400" />
                    </div>
                    <div className="text-2xl font-bold text-red-400">
                        {transactions.filter(t => t.status === "REJECTED").length}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="glass-card rounded-xl p-6">
                <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key
                                ? "bg-white/10 text-white"
                                : "text-[var(--muted)] hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {tab.icon && <span className={tab.color}>{tab.icon}</span>}
                            {tab.label}
                            {tab.key !== "all" && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full bg-white/10 ${tab.color || ""}`}>
                                    {transactions.filter(t =>
                                        tab.key === "pending" ? t.status === "PENDING" :
                                            tab.key === "approved" ? t.status === "APPROVED" :
                                                tab.key === "paid" ? t.status === "PAID" :
                                                    tab.key === "completed" ? t.status === "COMPLETED" :
                                                        tab.key === "rejected" ? t.status === "REJECTED" : true
                                    ).length}
                                </span>
                            )}
                        </button>
                    ))}
                    <button onClick={fetchData} className="ml-auto p-2 text-[var(--muted)] hover:text-white rounded-lg hover:bg-white/10">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <DataTable
                    data={getFilteredData()}
                    itemsPerPage={10}
                    onRowClick={(tx) => setSelectedTx(tx)}
                    columns={[
                        {
                            key: "date",
                            header: "Ngày tạo",
                            render: (tx) => <span className="text-white/70">{new Date(tx.date).toLocaleDateString("vi-VN")}</span>
                        },
                        {
                            key: "beneficiary",
                            header: "Đơn vị nhận",
                            render: (tx) => <span className="font-medium text-white">{tx.beneficiary || "N/A"}</span>
                        },
                        {
                            key: "category",
                            header: "Khoản chi",
                            render: (tx) => <span className="text-sm text-white/70">{tx.category}</span>
                        },
                        {
                            key: "amount",
                            header: "Số tiền",
                            render: (tx) => <span className="font-bold text-white">{tx.amount.toLocaleString("vi-VN")} {tx.currency}</span>
                        },
                        {
                            key: "status",
                            header: "Trạng thái",
                            render: (tx) => getStatusBadge(tx.status)
                        },
                        {
                            key: "createdBy",
                            header: "Người tạo",
                            render: (tx) => <span className="text-sm text-white/50">{tx.createdBy}</span>
                        },
                        {
                            key: "actions",
                            header: "",
                            render: (tx) => {
                                // Only show delete for PENDING status and if user is creator or admin
                                const isCreator = currentUser?.uid === tx.userId || currentUser?.id === tx.userId;
                                const role = getUserRole(currentUser);
                                if (tx.status === "PENDING" && (isCreator || role === "ADMIN")) {
                                    return (
                                        <button
                                            onClick={(e) => handleDeleteRequest(tx, e)}
                                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                                            title="Xóa yêu cầu"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    );
                                }
                                return null;
                            }
                        }
                    ]}
                />
            </div>

            {showCreateModal && (
                <CreateBudgetRequestModal
                    onClose={() => setShowCreateModal(false)}
                    username={currentUser?.displayName || currentUser?.email || "User"}
                    userId={currentUser?.uid || currentUser?.id}
                    currentUser={currentUser}
                    onSuccess={() => {
                        setShowCreateModal(false);
                        fetchData();
                    }}
                />
            )}

            {selectedTx && (
                <BudgetRequestDetailModal
                    transaction={selectedTx}
                    currentUser={currentUser}
                    allProjects={allProjects}
                    allAccounts={allAccounts}
                    onClose={() => setSelectedTx(null)}
                    onUpdate={() => {
                        setSelectedTx(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}
