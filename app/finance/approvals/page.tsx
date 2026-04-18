"use client";

import { useState, useEffect } from "react";
import { getTransactions, updateTransactionStatus, updateAccountBalance, getAccounts, getProjects, getBudgetRequests, updateBudgetStatus } from "@/lib/finance";
import { Transaction, Account, Project, BudgetRequest } from "@/types/finance";
import { logActivity } from "@/lib/logger";
import { doc, updateDoc } from "@/lib/firebase-compat";
import { db } from "@/lib/firebase-compat";
import { supabase } from "@/lib/supabase";
import { getUserRole, hasProjectPermission } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import DataTable, { DateCell } from "@/components/finance/DataTable";
import { useTranslation } from "@/lib/i18n";

type ApprovalTab = "all" | "high_value" | "pending";
type MainApprovalTab = "transactions" | "budgets";

interface ApprovalLog {
    id: string;
    action: string;
    transactionId: string;
    userName: string;
    reason?: string;
    details?: string;
    timestamp: number;
}

export default function ApprovalsPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [activeMainTab, setActiveMainTab] = useState<MainApprovalTab>("transactions");
    const [activeTab, setActiveTab] = useState<ApprovalTab>("all");
    const [approvalLogs, setApprovalLogs] = useState<ApprovalLog[]>([]);
    const [canApprove, setCanApprove] = useState(false);
    const [approvalProjectIds, setApprovalProjectIds] = useState<string[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [budgetRequests, setBudgetRequests] = useState<BudgetRequest[]>([]);

    // Rejection Modal
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

    // Budget rejection modal
    const [showBudgetRejectModal, setShowBudgetRejectModal] = useState(false);
    const [rejectingBudget, setRejectingBudget] = useState<BudgetRequest | null>(null);
    const [budgetRejectionReason, setBudgetRejectionReason] = useState("");

    useEffect(() => {
        const u = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (u) setCurrentUser(JSON.parse(u));

        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const u = localStorage.getItem("user") || sessionStorage.getItem("user");
            if (!u) {
                setLoading(false);
                return;
            }

            const parsed = JSON.parse(u);
            const role = getUserRole(parsed);
            const userId = parsed.uid || parsed.id;

            const [txs, accs, allProjects, budgetReqs] = await Promise.all([
                getTransactions(),
                getAccounts(),
                getProjects(),
                getBudgetRequests()
            ]);

            setAccounts(accs);
            setAllProjects(allProjects);

            // ADMIN có full quyền
            if (role === "ADMIN") {
                setCanApprove(true);
                setPendingTransactions(txs.filter(t => t.status === "PENDING"));
                setApprovalProjectIds(allProjects.map(p => p.id));
                setBudgetRequests(budgetReqs);
            } else {
                // Lấy các project mà user có quyền approve_transactions
                const projectsWithApproval = allProjects.filter(p =>
                    hasProjectPermission(userId, p, "approve_transactions", parsed)
                );

                if (projectsWithApproval.length > 0) {
                    setCanApprove(true);
                    const projectIds = projectsWithApproval.map(p => p.id);
                    setApprovalProjectIds(projectIds);

                    // Lọc giao dịch PENDING thuộc các project có quyền
                    const filteredTxs = txs.filter(t =>
                        t.status === "PENDING" && t.projectId && projectIds.includes(t.projectId)
                    );
                    setPendingTransactions(filteredTxs);

                    const filteredBudgetRequests = budgetReqs.filter(br =>
                        !br.id_du_an || projectIds.includes(br.id_du_an)
                    );
                    setBudgetRequests(filteredBudgetRequests);
                } else {
                    setCanApprove(false);
                    setPendingTransactions([]);
                    setBudgetRequests([]);
                }
            }

            // Fetch recent approval logs from Supabase
            const { data: activityLogs, error: logsError } = await supabase
                .from("finance_activity_logs")
                .select("id, action, entity_id, user_name, details, logged_at")
                .in("action", ["APPROVE", "REJECT", "APPROVE_BUDGET", "REJECT_BUDGET"])
                .order("logged_at", { ascending: false })
                .limit(50);

            if (logsError) {
                console.error("Failed to fetch approval logs", logsError);
                setApprovalLogs([]);
            } else {
                const mappedLogs: ApprovalLog[] = (activityLogs || []).map((log: any) => {
                    let normalizedDetails = typeof log.details === "string" ? log.details : "";
                    let reason: string | undefined;

                    if (normalizedDetails.startsWith("{")) {
                        try {
                            const parsed = JSON.parse(normalizedDetails);
                            normalizedDetails = parsed.details || normalizedDetails;
                            reason = parsed.reason;
                        } catch (e) {
                            console.error("Failed to parse log details", e);
                        }
                    }

                    return {
                        id: log.id,
                        action: log.action,
                        transactionId: log.entity_id || "",
                        userName: log.user_name || "System",
                        reason,
                        details: normalizedDetails,
                        timestamp: new Date(log.logged_at).getTime()
                    };
                });

                setApprovalLogs(mappedLogs.slice(0, 10));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatMoneyVND = (amount: number) => {
        return `${Number(amount || 0).toLocaleString("vi-VN")} VND`;
    };

    const getFilteredTransactions = () => {
        if (activeTab === "high_value") {
            return pendingTransactions.filter(tx => {
                const isHighVND = tx.currency === "VND" && tx.amount > 5000000;
                const isHighOther = tx.currency !== "VND" && tx.amount > 100;
                return isHighVND || isHighOther;
            });
        }
        return pendingTransactions;
    };

    const handleApprove = async (tx: Transaction) => {
        if (!currentUser) return alert("Error: User not found");
        if (!confirm(t("verify_approve_tx"))) return;

        try {
            // 1. Update Status
            await updateTransactionStatus(tx.id, "APPROVED");

            // 2. Update transaction with approver info
            const txRef = doc(db, "finance_transactions", tx.id);
            await updateDoc(txRef, {
                approvedBy: currentUser.name || currentUser.displayName || "Admin",
                updatedAt: Date.now()
            });

            // 3. Log Activity
            const proj = allProjects.find(p => p.id === tx.projectId);
            const logMsg = `Đã duyệt: ${tx.category} - ${tx.amount.toLocaleString("vi-VN")} ${tx.currency} | Dự án: ${proj?.name || "N/A"}`;

            await logActivity(
                { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                "APPROVE",
                "TRANSACTION",
                tx.id,
                logMsg
            );

            // 4. Update Account Balance
            const account = accounts.find(a => a.id === tx.accountId);
            if (account) {
                const newBalance = tx.type === "IN"
                    ? account.balance + tx.amount
                    : account.balance - tx.amount;
                await updateAccountBalance(account.id, newBalance);
            }

            // Refresh
            fetchData();
        } catch (error) {
            console.error("Approval failed", error);
            alert(t("approve_error"));
        }
    };

    const openRejectModal = (tx: Transaction) => {
        setRejectingTx(tx);
        setRejectionReason("");
        setShowRejectModal(true);
    };

    const handleReject = async () => {
        if (!rejectingTx) return;
        if (!currentUser) return alert("Error: User not found");
        if (!rejectionReason.trim()) {
            alert(t("please_enter_reject_reason"));
            return;
        }

        try {
            // 1. Update Status
            await updateTransactionStatus(rejectingTx.id, "REJECTED");

            // 2. Update transaction with rejection info
            const txRef = doc(db, "finance_transactions", rejectingTx.id);
            await updateDoc(txRef, {
                rejectedBy: currentUser.name || currentUser.displayName || "Admin",
                rejectionReason: rejectionReason.trim(),
                updatedAt: Date.now()
            });

            // 3. Log Activity
            const proj = allProjects.find(p => p.id === rejectingTx.projectId);
            const logMsg = `Từ chối: ${rejectingTx.category} - ${rejectingTx.amount.toLocaleString("vi-VN")} ${rejectingTx.currency} | Dự án: ${proj?.name || "N/A"} | Lý do: ${rejectionReason.trim()}`;

            await logActivity(
                { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                "REJECT",
                "TRANSACTION",
                rejectingTx.id,
                logMsg
            );

            setShowRejectModal(false);
            setRejectingTx(null);
            fetchData();
        } catch (error) {
            console.error("Rejection failed", error);
            alert(t("reject_error"));
        }
    };

    const handleApproveBudget = async (request: BudgetRequest) => {
        if (!confirm("Bạn có chắc chắn muốn đồng ý yêu cầu ngân sách này?")) return;

        try {
            await updateBudgetStatus(request.id, "dong_y");

            await logActivity(
                { uid: currentUser?.id || currentUser?.uid || "admin", displayName: currentUser?.name || currentUser?.displayName || "Admin" },
                "APPROVE_BUDGET",
                "BUDGET_REQUEST",
                request.id,
                `Đồng ý duyệt ngân sách: ${formatMoneyVND(request.ngan_sach_xin)} | Dự án: ${request.du_an?.ten_du_an || "N/A"} | Agency: ${request.crm_agencies?.ten_agency || "N/A"}`
            );

            fetchData();
        } catch (error) {
            console.error("Budget approval failed", error);
            alert("Lỗi khi duyệt ngân sách");
        }
    };

    const openBudgetRejectModal = (request: BudgetRequest) => {
        setRejectingBudget(request);
        setBudgetRejectionReason("");
        setShowBudgetRejectModal(true);
    };

    const handleRejectBudget = async () => {
        if (!rejectingBudget) return;
        if (!budgetRejectionReason.trim()) {
            alert("Vui lòng nhập lý do từ chối");
            return;
        }

        try {
            await updateBudgetStatus(rejectingBudget.id, "tu_choi", budgetRejectionReason.trim());

            await logActivity(
                { uid: currentUser?.id || currentUser?.uid || "admin", displayName: currentUser?.name || currentUser?.displayName || "Admin" },
                "REJECT_BUDGET",
                "BUDGET_REQUEST",
                rejectingBudget.id,
                `Từ chối ngân sách: ${formatMoneyVND(rejectingBudget.ngan_sach_xin)} | Dự án: ${rejectingBudget.du_an?.ten_du_an || "N/A"} | Agency: ${rejectingBudget.crm_agencies?.ten_agency || "N/A"} | Lý do: ${budgetRejectionReason.trim()}`
            );

            setShowBudgetRejectModal(false);
            setRejectingBudget(null);
            fetchData();
        } catch (error) {
            console.error("Budget rejection failed", error);
            alert("Lỗi khi từ chối ngân sách");
        }
    };

    const filteredTxs = getFilteredTransactions();

    if (loading) {
        return <div className="p-8 text-[var(--muted)]">Đang tải...</div>;
    }

    // Kiểm tra quyền
    if (!canApprove) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
                <ShieldX size={64} className="text-red-400 mb-4" />
                <h1 className="text-2xl font-bold text-white mb-2">{t("access_denied")}</h1>
                <p className="text-[var(--muted)] mb-4">{t("approval_permission_required")}</p>
                <button
                    onClick={() => router.push("/finance")}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                    {t("back_to_dashboard")}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">{t("approval_title")}</h1>
                <p className="text-[var(--muted)]">{t("approval_desc")}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveMainTab("transactions")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeMainTab === "transactions"
                        ? "bg-blue-500/20 text-blue-300"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    Duyệt Giao Dịch ({pendingTransactions.length})
                </button>
                <button
                    onClick={() => setActiveMainTab("budgets")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeMainTab === "budgets"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    Duyệt Ngân Sách ({budgetRequests.length})
                </button>
            </div>

            {activeMainTab === "transactions" && (
                <>
                    <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "all"
                        ? "bg-white/10 text-white"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    {t("all_transactions")} ({pendingTransactions.length})
                </button>
                <button
                    onClick={() => setActiveTab("high_value")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "high_value"
                        ? "bg-red-500/20 text-red-400"
                        : "text-[var(--muted)] hover:text-white"
                        }`}
                >
                    {t("high_value_tx")} (&gt;5tr / &gt;$100)
                </button>
            </div>

                    {loading ? (
                <div className="text-center py-12 text-[var(--muted)]">{t("loading")}</div>
            ) : filteredTxs.length === 0 ? (
                <div className="glass-card p-12 text-center text-[var(--muted)] rounded-xl">
                    <div className="text-4xl mb-4">✓</div>
                    <p>{t("no_pending_tx")}</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredTxs.map(tx => {
                        const isHighValue = (tx.currency === "VND" && tx.amount > 5000000) ||
                            (tx.currency !== "VND" && tx.amount > 100);

                        return (
                            <div
                                key={tx.id}
                                className={`glass-card p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isHighValue ? "border-l-4 border-red-500" : ""
                                    }`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === "IN" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                            }`}>
                                            {tx.type === "IN" ? t("income") : t("expense")}
                                        </span>
                                        {isHighValue && (
                                            <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs font-bold">
                                                ⚠️ {t("high_value_warning")}
                                            </span>
                                        )}
                                        <span className="text-sm text-[var(--muted)]">{new Date(tx.date).toLocaleDateString()}</span>
                                        <span className="text-sm text-[var(--muted)]">{t("approved_by").replace("{name}", tx.createdBy)}</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-1">
                                        {tx.amount.toLocaleString("vi-VN")} {tx.currency}
                                    </h3>
                                    <div className="space-y-1">
                                        <p className="text-white font-medium">{tx.category}</p>
                                        <p className="text-[var(--muted)] text-sm">{tx.description}</p>
                                        {tx.beneficiary && (
                                            <p className="text-blue-400 text-xs font-bold uppercase">Thụ hưởng: {tx.beneficiary}</p>
                                        )}
                                        {tx.projectId && (
                                            <p className="text-[var(--muted)] text-[10px]">Dự án: {allProjects.find(p => p.id === tx.projectId)?.name || "N/A"}</p>
                                        )}
                                    </div>

                                    {tx.images && tx.images.length > 0 && (
                                        <div className="mt-2 flex gap-2">
                                            {tx.images.map((img, i) => (
                                                <a
                                                    key={i}
                                                    href={img}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-400 underline hover:text-blue-300"
                                                >
                                                    {t("view_image")} {i + 1}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => openRejectModal(tx)}
                                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium transition-colors"
                                    >
                                        {t("reject")}
                                    </button>
                                    <button
                                        onClick={() => handleApprove(tx)}
                                        className="px-6 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold transition-colors shadow-lg shadow-green-500/20"
                                    >
                                        {t("approve")}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
                </>
            )}

            {activeMainTab === "budgets" && (
                <div className="glass-card rounded-xl overflow-hidden">
                    {budgetRequests.length === 0 ? (
                        <div className="p-10 text-center text-[var(--muted)]">Không có yêu cầu ngân sách chờ duyệt</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Dự án / Agency</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Ngân sách xin</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Chứng từ</th>
                                        <th className="text-left px-4 py-3 font-semibold text-white/80">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {budgetRequests.map((request) => (
                                        <tr key={request.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-white">{request.du_an?.ten_du_an || "N/A"}</div>
                                                <div className="text-xs text-[var(--muted)]">{request.crm_agencies?.ten_agency || "N/A"}</div>
                                            </td>
                                            <td className="px-4 py-3 text-blue-300 font-semibold">{formatMoneyVND(request.ngan_sach_xin)}</td>
                                            <td className="px-4 py-3">
                                                {request.chung_tu_urls?.length ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {request.chung_tu_urls.map((url, index) => (
                                                            <a
                                                                key={`${request.id}-${index}`}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="px-2 py-1 rounded bg-white/10 text-blue-300 hover:bg-white/20"
                                                            >
                                                                Chứng từ {index + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-[var(--muted)]">Không có</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => openBudgetRejectModal(request)}
                                                        className="px-3 py-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 font-medium"
                                                    >
                                                        Từ chối
                                                    </button>
                                                    <button
                                                        onClick={() => handleApproveBudget(request)}
                                                        className="px-3 py-1.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 font-medium"
                                                    >
                                                        Đồng ý
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Approval History */}
            <div>
                <div className="mb-4">
                    <h3 className="text-lg font-bold text-white">{t("recent_approval_history")}</h3>
                </div>
                <DataTable
                    data={approvalLogs}
                    colorScheme="blue"
                    emptyMessage={t("no_approval_history")}
                    showIndex={false}
                    itemsPerPage={10}
                    columns={[
                        {
                            key: "timestamp",
                            header: t("time"),
                            render: (log) => (
                                <span className="text-white/70">
                                    {new Date(log.timestamp).toLocaleString("vi-VN")}
                                </span>
                            )
                        },
                        {
                            key: "userName",
                            header: t("approver"),
                            render: (log) => <span className="text-white font-medium">{log.userName}</span>
                        },
                        {
                            key: "action",
                            header: t("action"),
                            align: "center",
                            render: (log) => {
                                const isApprovedAction = log.action === "APPROVE" || log.action === "APPROVE_BUDGET";
                                return (
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${isApprovedAction
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-red-500/20 text-red-400"
                                        }`}>
                                        {isApprovedAction ? t("approved") : t("rejected_label")}
                                    </span>
                                );
                            }
                        },
                        {
                            key: "details",
                            header: t("details"),
                            render: (log) => {
                                let displayDetails = log.details || "";
                                // Khử JSON nếu log.details là chuỗi JSON (do API lưu JSON.stringify)
                                if (displayDetails.startsWith('{')) {
                                    try {
                                        const parsed = JSON.parse(displayDetails);
                                        displayDetails = parsed.details || displayDetails;
                                    } catch (e) {
                                        console.error("Failed to parse log details", e);
                                    }
                                }
                                return (
                                    <div className="max-w-[400px]">
                                        <div className="text-white/70 whitespace-normal break-words">{displayDetails === "{}" ? "-" : displayDetails}</div>
                                        {log.reason && (
                                            <div className="text-xs text-white/40 mt-1">{t("reason")}: {log.reason}</div>
                                        )}
                                    </div>
                                );
                            }
                        }
                    ]}
                />
            </div>

            {/* Rejection Modal */}
            {showRejectModal && rejectingTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button
                            onClick={() => setShowRejectModal(false)}
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-red-400">{t("reject_tx")}</h2>

                        <div className="mb-4 p-4 bg-white/5 rounded-lg">
                            <p className="text-sm text-[var(--muted)]">{t("transaction")}:</p>
                            <p className="text-lg font-bold text-white">
                                {rejectingTx.amount.toLocaleString("vi-VN")} {rejectingTx.currency}
                            </p>
                            <p className="text-sm text-[var(--muted)]">{rejectingTx.category} • {rejectingTx.createdBy}</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                {t("reject_reason")} *
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder={t("enter_reject_reason")}
                                className="glass-input w-full p-3 rounded-lg"
                                rows={3}
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-[var(--muted)] hover:text-white transition-colors"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                onClick={handleReject}
                                className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
                            >
                                {t("confirm_reject")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBudgetRejectModal && rejectingBudget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md p-6 rounded-2xl relative">
                        <button
                            onClick={() => setShowBudgetRejectModal(false)}
                            className="absolute top-4 right-4 text-[var(--muted)] hover:text-white"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-red-400">Từ chối yêu cầu ngân sách</h2>

                        <div className="mb-4 p-4 bg-white/5 rounded-lg">
                            <p className="text-sm text-[var(--muted)]">Yêu cầu ngân sách:</p>
                            <p className="text-lg font-bold text-white">{formatMoneyVND(rejectingBudget.ngan_sach_xin)}</p>
                            <p className="text-sm text-[var(--muted)]">
                                {rejectingBudget.du_an?.ten_du_an || "N/A"} • {rejectingBudget.crm_agencies?.ten_agency || "N/A"}
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-[var(--muted)] mb-2">Lý do từ chối *</label>
                            <textarea
                                value={budgetRejectionReason}
                                onChange={e => setBudgetRejectionReason(e.target.value)}
                                placeholder="Nhập lý do từ chối"
                                className="glass-input w-full p-3 rounded-lg"
                                rows={3}
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBudgetRejectModal(false)}
                                className="flex-1 px-4 py-3 rounded-lg bg-white/5 text-[var(--muted)] hover:text-white transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleRejectBudget}
                                className="flex-1 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
                            >
                                Xác nhận từ chối
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

