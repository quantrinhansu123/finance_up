"use client";

import { useState, useEffect } from "react";
import { getTransactions, updateTransactionStatus, updateAccountBalance, getAccounts, getProjects } from "@/lib/finance";
import { Transaction, Account } from "@/types/finance";
import { logActivity } from "@/lib/logger";
import { doc, updateDoc, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserRole, hasProjectPermission } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";
import DataTable, { DateCell } from "@/components/finance/DataTable";
import { useTranslation } from "@/lib/i18n";

type ApprovalTab = "all" | "high_value" | "pending";

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
    const [activeTab, setActiveTab] = useState<ApprovalTab>("all");
    const [approvalLogs, setApprovalLogs] = useState<ApprovalLog[]>([]);
    const [canApprove, setCanApprove] = useState(false);
    const [approvalProjectIds, setApprovalProjectIds] = useState<string[]>([]);

    // Rejection Modal
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectingTx, setRejectingTx] = useState<Transaction | null>(null);
    const [rejectionReason, setRejectionReason] = useState("");

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

            const [txs, accs, allProjects] = await Promise.all([
                getTransactions(),
                getAccounts(),
                getProjects()
            ]);

            setAccounts(accs);

            // ADMIN có full quyền
            if (role === "ADMIN") {
                setCanApprove(true);
                setPendingTransactions(txs.filter(t => t.status === "PENDING"));
                setApprovalProjectIds(allProjects.map(p => p.id));
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
                } else {
                    setCanApprove(false);
                    setPendingTransactions([]);
                }
            }

            // Fetch recent logs
            const logsSnapshot = await getDocs(
                query(
                    collection(db, "finance_logs"),
                    orderBy("timestamp", "desc"),
                    limit(50)
                )
            );

            const rawLogs = logsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalLog));
            const filteredLogs = rawLogs.filter(l => ["APPROVE", "REJECT"].includes(l.action));

            setApprovalLogs(filteredLogs.slice(0, 10));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredTransactions = () => {
        if (activeTab === "high_value") {
            return pendingTransactions.filter(tx => {
                const isHighVND = tx.currency === "VND" && tx.amount > 5000000;
                const isHighUSD = (tx.currency === "USD" || tx.currency === "KHR") && tx.amount > 100;
                return isHighVND || isHighUSD;
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
            await logActivity(
                { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                "APPROVE",
                "TRANSACTION",
                tx.id,
                `Đã duyệt giao dịch ${tx.id}: ${tx.amount} ${tx.currency}`
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
            await logActivity(
                { uid: currentUser.id || currentUser.uid || "admin", displayName: currentUser.name || currentUser.displayName || "Admin" },
                "REJECT",
                "TRANSACTION",
                rejectingTx.id,
                `Từ chối giao dịch ${rejectingTx.id}. Lý do: ${rejectionReason.trim()}`
            );

            setShowRejectModal(false);
            setRejectingTx(null);
            fetchData();
        } catch (error) {
            console.error("Rejection failed", error);
            alert(t("reject_error"));
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
                            ((tx.currency === "USD" || tx.currency === "KHR") && tx.amount > 100);

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
                                        {tx.amount.toLocaleString()} {tx.currency}
                                    </h3>
                                    <p className="text-[var(--muted)]">{tx.description || tx.category}</p>

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
                            render: (log) => (
                                <span className={`px-2 py-1 rounded text-xs font-bold ${log.action === "APPROVE"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                                    }`}>
                                    {log.action === "APPROVE" ? t("approved") : t("rejected_label")}
                                </span>
                            )
                        },
                        {
                            key: "details",
                            header: t("details"),
                            render: (log) => (
                                <div className="max-w-[400px]">
                                    <div className="text-white/70 truncate">{log.details}</div>
                                    {log.reason && (
                                        <div className="text-xs text-white/40 mt-1">{t("reason")}: {log.reason}</div>
                                    )}
                                </div>
                            )
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
                                {rejectingTx.amount.toLocaleString()} {rejectingTx.currency}
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
        </div>
    );
}
